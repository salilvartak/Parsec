// Deterministic JSON repair. No network, no model — pure text in, text out.
//
// This runs before any AI call and is expected to fix the overwhelming majority
// of real-world breakage (LLM output, hand-edited config, log scrapes). Only
// genuinely ambiguous damage — truncation, missing structure — should ever
// reach the model, because on the free API tier every avoided call is quota we
// keep for the cases that actually need judgement.
//
// Everything is done in a single character scan rather than with regexes: a
// regex that rewrites `'` → `"` or strips a trailing comma cannot tell whether
// it is inside a string literal, and silently corrupting the user's data is far
// worse than failing to repair it.

import { buildLineIndex, offsetToLine } from './parse.js';

// Barewords that are values, not keys. Mapped to their JSON equivalent.
const LITERALS = {
  True: 'true', False: 'false', None: 'null',      // Python
  TRUE: 'true', FALSE: 'false', NULL: 'null',      // SQL-ish dumps
  undefined: 'null', NaN: 'null',                  // JS
  Infinity: 'null', '-Infinity': 'null',
};

const SMART_QUOTES = { '“': '"', '”': '"', '‘': "'", '’': "'" };

// Public entry point. Never throws.
// → { text, fixes, changed }  fixes: [{ line, col, kind, message }]
export function repair(source) {
  const fixes = [];
  let text = source;

  text = stripWrapper(text, fixes);
  text = scan(text, fixes);

  return { text, fixes, changed: text !== source };
}

// Convenience: repair only if the input doesn't already parse. Returns the
// original untouched when it's already valid, so callers can use this blindly.
export function repairIfBroken(source) {
  try {
    JSON.parse(source);
    return { text: source, fixes: [], changed: false };
  } catch {
    return repair(source);
  }
}

// ---------------------------------------------------------------------------
// Pass 1 — peel off anything wrapping the actual JSON.
// ---------------------------------------------------------------------------

// Markdown fences, a BOM, and leading/trailing prose ("Here's the JSON:").
// Done line-wise before the scanner so the scanner only ever sees candidate
// JSON and doesn't have to reason about prose.
function stripWrapper(text, fixes) {
  let out = text;

  if (out.charCodeAt(0) === 0xfeff) {
    out = out.slice(1);
    fixes.push({ line: 1, col: 1, kind: 'bom', message: 'Removed byte-order mark' });
  }

  // ```json … ``` — take the fenced body. Tolerates a missing closing fence,
  // which is common when the generating model was cut off.
  const fence = out.match(/```[ \t]*[\w-]*[ \t]*\r?\n([\s\S]*?)(?:\r?\n[ \t]*```|$)/);
  if (fence) {
    out = fence[1];
    fixes.push({ line: 1, col: 1, kind: 'fence', message: 'Removed markdown code fence' });
    return out;
  }

  // No fence: trim to the outermost brace/bracket pair. Only trims when there
  // is actually something to trim, so clean input is left byte-identical.
  const start = firstStructural(out);
  if (start > 0) {
    out = out.slice(start);
    fixes.push({ line: 1, col: 1, kind: 'prose', message: 'Removed text before the JSON value' });
  }
  const end = lastStructural(out);
  if (end >= 0 && end < out.length - 1) {
    const tail = out.slice(end + 1);
    if (tail.trim() !== '') {
      out = out.slice(0, end + 1);
      fixes.push({ line: 1, col: 1, kind: 'prose', message: 'Removed text after the JSON value' });
    }
  }
  return out;
}

function firstStructural(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') return i;
  }
  return -1;
}

function lastStructural(text) {
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}' || text[i] === ']') return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Pass 2 — single scan that rewrites token-level damage.
// ---------------------------------------------------------------------------

function scan(text, fixes) {
  const lines = buildLineIndex(text);
  const at = (offset) => {
    const line = offsetToLine(lines, offset);
    return { line, col: offset - lines[line - 1] + 1 };
  };
  const note = (offset, kind, message) => fixes.push({ ...at(offset), kind, message });

  let out = '';
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];

    // --- strings (any flavour of quote) ---------------------------------
    const quote = SMART_QUOTES[c] || c;
    if (quote === '"' || quote === "'") {
      const res = readString(text, i);
      if (quote !== '"' || SMART_QUOTES[c]) {
        note(i, 'quotes', quote === "'" ? 'Converted single-quoted string to double quotes' : 'Converted smart quotes to straight quotes');
      }
      out += JSON.stringify(res.value);
      i = res.end;
      continue;
    }

    // --- comments --------------------------------------------------------
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      const end = skipComment(text, i);
      note(i, 'comment', 'Removed comment');
      // Replace with a space so `1/*x*/2` doesn't silently become `12`.
      out += ' ';
      i = end;
      continue;
    }

    // --- trailing commas -------------------------------------------------
    if (c === ',') {
      const next = nextMeaningful(text, i + 1);
      if (next.char === '}' || next.char === ']') {
        note(i, 'comma', 'Removed trailing comma');
        i++;
        continue;
      }
      if (next.char === '') {
        note(i, 'comma', 'Removed trailing comma at end of input');
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    // --- barewords: literals and unquoted keys ---------------------------
    if (isWordStart(c)) {
      const word = readWord(text, i);

      if (word.value === 'true' || word.value === 'false' || word.value === 'null') {
        out += word.value;
        i = word.end;
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(LITERALS, word.value)) {
        const mapped = LITERALS[word.value];
        note(i, 'literal', `Replaced \`${word.value}\` with \`${mapped}\``);
        out += mapped;
        i = word.end;
        continue;
      }

      // A bareword followed by `:` is an unquoted key — quote it. Anything
      // else is an unquotable value we can't safely guess at, so it is left
      // alone for the parser (and then the model) to report.
      const after = nextMeaningful(text, word.end);
      if (after.char === ':') {
        note(i, 'key', `Quoted unquoted key \`${word.value}\``);
        out += JSON.stringify(word.value);
      } else {
        out += word.value;
      }
      i = word.end;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

// Read a string starting at a quote char (straight or smart). Returns the
// decoded value plus the offset just past the closing quote. An unterminated
// string runs to end of input — that is truncation, which we surface rather
// than guess at, but we still return a well-formed value so the rest of the
// scan can continue.
function readString(text, start) {
  const open = SMART_QUOTES[text[start]] || text[start];
  // Smart quotes come in pairs, so accept either the same char or its partner.
  const closers = new Set([open]);
  if (open === '"') { closers.add('“'); closers.add('”'); }
  if (open === "'") { closers.add('‘'); closers.add('’'); }

  let value = '';
  let i = start + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const esc = text[i + 1];
      if (esc === undefined) break;
      // `\'` is legal in JS but not JSON; unescaping it here means the
      // re-encode below emits a plain apostrophe rather than an invalid escape.
      if (esc === "'") { value += "'"; i += 2; continue; }
      if (esc === 'u') { value += decodeEscape(text.slice(i, i + 6)); i += 6; continue; }
      value += decodeEscape(text.slice(i, i + 2));
      i += 2;
      continue;
    }
    if (closers.has(c) && (SMART_QUOTES[c] || c) === open) { i++; return { value, end: i }; }
    value += c;
    i++;
  }
  return { value, end: i, unterminated: true };
}

function decodeEscape(seq) {
  switch (seq[1]) {
    case 'n': return '\n';
    case 't': return '\t';
    case 'r': return '\r';
    case 'b': return '\b';
    case 'f': return '\f';
    case '"': return '"';
    case '\\': return '\\';
    case '/': return '/';
    case 'u': {
      const code = parseInt(seq.slice(2), 16);
      return Number.isNaN(code) ? seq : String.fromCharCode(code);
    }
    default: return seq[1];
  }
}

function skipComment(text, start) {
  if (text[start + 1] === '/') {
    const nl = text.indexOf('\n', start);
    return nl === -1 ? text.length : nl;
  }
  const close = text.indexOf('*/', start + 2);
  return close === -1 ? text.length : close + 2;
}

// Next non-whitespace, non-comment character at or after `from`.
function nextMeaningful(text, from) {
  let i = from;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) { i = skipComment(text, i); continue; }
    return { char: c, index: i };
  }
  return { char: '', index: i };
}

function isWordStart(c) {
  return /[A-Za-z_$]/.test(c);
}

function readWord(text, start) {
  let i = start;
  while (i < text.length && /[A-Za-z0-9_$.-]/.test(text[i])) i++;
  return { value: text.slice(start, i), end: i };
}
