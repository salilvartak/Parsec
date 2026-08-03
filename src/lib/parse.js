// Pure JSON parsing / error extraction. Never throws — returns result objects.

// Turn a JSON.parse error message into {line, col, message}.
// Handles both V8 ("position N (line L column C)") and older shapes.
export function parseErrorInfo(msg, text) {
  let m = msg.match(/line (\d+) column (\d+)/);
  if (m) return { line: +m[1], col: +m[2], message: msg.replace(/\s*\(line.*\)$/, '') };
  m = msg.match(/position (\d+)/);
  if (m) {
    const pos = +m[1];
    const upto = text.slice(0, pos);
    const line = upto.split('\n').length;
    const col = pos - upto.lastIndexOf('\n');
    return { line, col, message: msg, pos };
  }
  return { line: 1, col: 1, message: msg };
}

// Convert a {line, col} (1-based) to a 0-based character offset in text.
export function lineColToOffset(text, line, col) {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) offset += lines[i].length + 1;
  return offset + Math.max(0, col - 1);
}

// Parse raw text. { success, value, error } — error is {line,col,message}.
export function parseJson(text) {
  if (text.trim() === '') return { success: false, empty: true, value: undefined, error: null };
  try {
    const value = JSON.parse(text);
    return { success: true, value, error: null };
  } catch (e) {
    return { success: false, value: undefined, error: parseErrorInfo(e.message, text) };
  }
}

// JSON.parse silently keeps the last of duplicate keys. Detect them so we can warn.
// Uses a reviver-tracked path stack. Returns array of { path, key, line, from, to }
// where `line` is 1-based and from/to are character offsets of the key token.
export function findDuplicateKeys(text) {
  const dups = [];
  try {
    // Lightweight tokenizing scan for object contexts. Falls back silently on any error.
    const tokens = tokenize(text);
    const lineIndex = buildLineIndex(text);
    // Each object frame tracks whether the next string is a key or a value.
    // Without that, `{"a": "b"}` would register "b" as a key name and every
    // reported offset would land one token to the right.
    const stack = []; // frame: { type:'object'|'array', keys:Map, path, expect:'key'|'value' }
    let pendingKey = null;
    for (const t of tokens) {
      const top = stack[stack.length - 1];
      if (t.type === 'lbrace') { stack.push({ type: 'object', keys: new Map(), path: childPath(top), expect: 'key' }); pendingKey = null; }
      else if (t.type === 'lbracket') { stack.push({ type: 'array', keys: null, path: childPath(top), expect: 'value', idx: 0 }); pendingKey = null; }
      else if (t.type === 'rbrace' || t.type === 'rbracket') { stack.pop(); pendingKey = null; }
      else if (t.type === 'comma') {
        if (top && top.type === 'object') { top.expect = 'key'; pendingKey = null; }
        else if (top && top.type === 'array') top.idx++;
      }
      else if (t.type === 'string') {
        if (top && top.type === 'object' && top.expect === 'key' && pendingKey === null) pendingKey = t;
      } else if (t.type === 'colon') {
        if (top && top.type === 'object' && pendingKey !== null) {
          top.expect = 'value';
          const k = pendingKey.value;
          top.lastKey = k; // so a container opening next knows its own path
          const first = top.keys.get(k);
          if (first !== undefined) {
            // report the first occurrence too, once, so every copy gets highlighted
            if (!first.reported) {
              first.reported = true;
              dups.push({ path: top.path, key: k, line: offsetToLine(lineIndex, first.from), from: first.from, to: first.to, first: true });
            }
            dups.push({ path: top.path, key: k, line: offsetToLine(lineIndex, pendingKey.from), from: pendingKey.from, to: pendingKey.to, first: false });
          } else {
            top.keys.set(k, { from: pendingKey.from, to: pendingKey.to, reported: false });
          }
          pendingKey = null;
        }
      }
    }
  } catch { /* ignore — duplicate detection is best-effort */ }
  dups.sort((a, b) => a.from - b.from);
  return dups;
}

// Sorted array of line-start offsets, for O(log n) offset → line lookups.
export function buildLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}
export function offsetToLine(starts, offset) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

// Path of a container about to be pushed, given its parent frame.
function childPath(parent) {
  if (!parent) return 'root';
  if (parent.type === 'array') return `${parent.path}[${parent.idx}]`;
  return parent.lastKey === undefined ? parent.path : `${parent.path}.${parent.lastKey}`;
}

// Minimal JSON tokenizer (strings, braces, brackets, colon, comma). Enough for dup-key scan.
function tokenize(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1, val = '';
      while (j < n) {
        if (text[j] === '\\') { val += text[j + 1]; j += 2; continue; }
        if (text[j] === '"') break;
        val += text[j]; j++;
      }
      tokens.push({ type: 'string', value: val, from: i, to: Math.min(j + 1, n) });
      i = j + 1;
    } else if (c === '{') { tokens.push({ type: 'lbrace' }); i++; }
    else if (c === '}') { tokens.push({ type: 'rbrace' }); i++; }
    else if (c === '[') { tokens.push({ type: 'lbracket' }); i++; }
    else if (c === ']') { tokens.push({ type: 'rbracket' }); i++; }
    else if (c === ':') { tokens.push({ type: 'colon' }); i++; }
    else if (c === ',') { tokens.push({ type: 'comma' }); i++; }
    else i++;
  }
  return tokens;
}
