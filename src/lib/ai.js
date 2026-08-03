// Client for the AI proxy. The API key lives server-side; this only ever talks
// to our own /api/ai endpoint.
//
// Nothing here is required for the app to work. Every call can fail, be rate
// limited, or be switched off entirely, and the editor carries on unchanged.

import { repairIfBroken } from './repair.js';

const ENDPOINT = '/api/ai';

export class AiError extends Error {
  constructor(message, { code, retryAfter, remaining } = {}) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
    this.remaining = remaining;
  }
}

async function call(op, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, ...body }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new AiError('Could not reach the AI service.', { code: 'network' });
  }

  // An absent header must stay undefined. Number(null) is 0, which would
  // display as "0 requests left" for any failure that never reached the
  // limiter at all.
  const header = res.headers.get('x-usage-remaining');
  const remaining = header === null || header === '' ? undefined : Number(header);
  const quota = Number.isFinite(remaining) ? remaining : undefined;

  // Anything that isn't JSON is infrastructure talking, not our API — a 404
  // HTML page, a proxy error, a gateway timeout.
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!isJson || data === null) {
    throw new AiError(transportMessage(res.status), { code: `http_${res.status}`, remaining: quota });
  }

  if (!res.ok) {
    throw new AiError(data.message || `The AI request failed (${res.status}).`, {
      code: data.error || 'unknown',
      retryAfter: data.retryAfter,
      remaining: quota,
    });
  }

  return { result: data.result, remaining: quota ?? data.remaining };
}

// The common failures here are setup problems, so name them instead of saying
// "request failed" and leaving the developer to guess.
function transportMessage(status) {
  if (status === 404) {
    return 'AI endpoint not found. Local API routes only run under `vercel dev` — plain `npm run dev` serves the UI alone.';
  }
  if (status === 401 || status === 403) return 'The AI endpoint rejected the request. Check GEMINI_API_KEY.';
  if (status === 500) return 'The AI endpoint errored. Check the server logs.';
  if (status === 504) return 'The AI request timed out.';
  return `The AI request failed (HTTP ${status}).`;
}

// ---------------------------------------------------------------------------
// Repair
// ---------------------------------------------------------------------------

// Full repair flow: deterministic pass first, model only if still broken.
//
// → { text, fixes, usedAi, summary, confident, remaining }
//   `fixes` is the combined list from both stages, for showing a diff before
//   the user commits to anything.
export async function repairDocument(source, { signal } = {}) {
  const local = repairIfBroken(source);

  // The deterministic pass handles the overwhelming majority of breakage. If it
  // parses now, we spend no quota at all.
  if (parses(local.text)) {
    return {
      text: local.text,
      fixes: local.fixes,
      usedAi: false,
      summary: local.changed ? describe(local.fixes) : 'Already valid JSON.',
      confident: true,
      remaining: undefined,
    };
  }

  const { result, remaining } = await call('repair', { text: local.text }, { signal });
  const applied = applyOps(local.text, result);

  if (!parses(applied.text)) {
    throw new AiError(
      "The suggested repair still doesn't parse. The document may be too badly damaged.",
      { code: 'repair_failed', remaining },
    );
  }

  return {
    text: applied.text,
    fixes: [...local.fixes, ...applied.fixes],
    usedAi: true,
    summary: result.summary || describe(applied.fixes),
    confident: result.confident !== false,
    remaining,
  };
}

// Apply the model's anchored edits. Every `find` must appear verbatim; anything
// that doesn't match is dropped rather than guessed at, and the caller re-checks
// that the result parses before showing it to anyone. The model is a suggestion
// engine here, not a trusted transform.
function applyOps(text, result) {
  const fixes = [];
  let out = text;

  for (const op of result.ops ?? []) {
    if (typeof op?.find !== 'string' || typeof op?.replace !== 'string') continue;
    if (op.find === '') continue;

    const index = out.indexOf(op.find);
    if (index === -1) continue;            // anchor not found — skip, don't guess
    if (out.indexOf(op.find, index + 1) !== -1) continue;  // ambiguous — skip

    out = out.slice(0, index) + op.replace + out.slice(index + op.find.length);
    fixes.push({ kind: 'ai', message: op.note || 'Applied a suggested edit', ai: true });
  }

  if (typeof result.append === 'string' && result.append !== '') {
    out += result.append;
    fixes.push({ kind: 'ai', message: `Closed truncated document with \`${result.append.trim()}\``, ai: true });
  }

  return { text: out, fixes };
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

// Generate sample data matching the shape of `source` (a JSON document or a
// JSON Schema). `hint` is optional free text, e.g. "20 records, all in the EU".
export async function generateMockData(source, { hint, signal } = {}) {
  const { result, remaining } = await call('mock', { text: source, hint }, { signal });
  return { data: result, remaining };
}

// ---------------------------------------------------------------------------

function parses(text) {
  try { JSON.parse(text); return true; } catch { return false; }
}

function describe(fixes) {
  if (fixes.length === 0) return 'No changes needed.';
  const counts = new Map();
  for (const f of fixes) counts.set(f.kind, (counts.get(f.kind) || 0) + 1);
  return [...counts]
    .map(([kind, n]) => {
      const [one, many] = LABELS[kind] || [kind, `${kind}s`];
      return `${n} ${n === 1 ? one : many}`;
    })
    .join(', ');
}

// [singular, plural] — several of these don't pluralise by adding "s".
const LABELS = {
  comma: ['trailing comma', 'trailing commas'],
  quotes: ['quote fix', 'quote fixes'],
  key: ['unquoted key', 'unquoted keys'],
  literal: ['invalid literal', 'invalid literals'],
  comment: ['comment', 'comments'],
  fence: ['code fence', 'code fences'],
  prose: ['stray text', 'stray text'],
  bom: ['byte-order mark', 'byte-order marks'],
  ai: ['AI edit', 'AI edits'],
};
