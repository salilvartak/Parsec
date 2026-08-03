// AI proxy. The API key lives here and never reaches the browser.
//
// Two operations, both returning schema-shaped JSON:
//   repair — anchored edits that make a broken document parse
//   mock   — sample data matching an inferred shape
//
// The client is expected to have already run the deterministic repair pass, so
// anything arriving here is genuinely ambiguous (truncation, missing structure).

import { randomUUID, createHash } from 'node:crypto';
import { claim, refund, tripCooldown } from './_lib/limit.js';
import { generateJson, GeminiError } from './_lib/gemini.js';
import { MODEL, MAX_INPUT_BYTES, MAX_OUTPUT_TOKENS } from './_lib/config.js';

const COOKIE = 'pj_uid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'method_not_allowed' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return send(res, 500, { error: 'server_misconfigured', message: 'GEMINI_API_KEY is not set' });
  }

  const { userId, setCookie } = identify(req);
  if (setCookie) res.setHeader('set-cookie', setCookie);

  const { op, text, hint } = req.body ?? {};

  if (op !== 'repair' && op !== 'mock') {
    return send(res, 400, { error: 'bad_op', message: 'op must be "repair" or "mock"' });
  }
  if (typeof text !== 'string' || text.trim() === '') {
    return send(res, 400, { error: 'bad_input', message: 'text is required' });
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_INPUT_BYTES) {
    return send(res, 413, {
      error: 'too_large',
      message: `Input exceeds ${Math.round(MAX_INPUT_BYTES / 1000)}KB`,
    });
  }

  const slot = await claim(userId);
  res.setHeader('x-usage-remaining', String(slot.remaining));
  if (!slot.ok) {
    res.setHeader('retry-after', String(slot.retryAfter));
    return send(res, 429, {
      error: slot.reason,
      message: MESSAGES[slot.reason],
      retryAfter: slot.retryAfter,
      remaining: slot.remaining,
    });
  }

  try {
    const spec = op === 'repair' ? repairSpec(text) : mockSpec(text, hint);
    const { value } = await generateJson({
      model: MODEL,
      system: spec.system,
      prompt: spec.prompt,
      schema: spec.schema,
      maxOutputTokens: MAX_OUTPUT_TOKENS[op],
      thinkingBudget: spec.thinkingBudget,
    });
    return send(res, 200, { op, result: value, remaining: slot.remaining });
  } catch (err) {
    // Don't charge the user for our upstream falling over.
    if (!(err instanceof GeminiError) || err.retryable) await refund(userId);

    // We outran Google's real per-minute limit. Back everyone off — our
    // configured RPM is only a guess, so this is the authoritative signal.
    if (err instanceof GeminiError && err.status === 429) await tripCooldown();

    const status = err instanceof GeminiError ? err.status : 502;
    console.error('[ai]', op, err.message);
    return send(res, status === 429 ? 503 : status, {
      error: 'upstream',
      message: err instanceof GeminiError && !err.retryable
        ? err.message
        : 'The AI service is unavailable right now. Try again shortly.',
    });
  }
}

const MESSAGES = {
  global_daily: "Today's shared AI quota is used up. It resets at midnight UTC.",
  user_daily: "You've used your AI requests for today. They reset at midnight UTC.",
  busy: 'Too many AI requests at once. Try again in a few seconds.',
};

// ---------------------------------------------------------------------------
// Operation specs
// ---------------------------------------------------------------------------

// Repair returns anchored text edits rather than the rebuilt document. Two
// reasons: output tokens scale with the document if we return the whole thing,
// and models are unreliable at counting line/column numbers — an edit that
// lands one line off corrupts data silently. A literal `find` string is
// something the client can locate and verify itself.
const REPAIR_SCHEMA = {
  type: 'object',
  properties: {
    ops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          find: { type: 'string', description: 'Exact literal substring from the input to replace. Must appear verbatim.' },
          replace: { type: 'string', description: 'Replacement text.' },
          note: { type: 'string', description: 'Short human explanation of this edit.' },
        },
        required: ['find', 'replace', 'note'],
      },
    },
    append: {
      type: 'string',
      description: 'Text to append at the very end, for truncated input. Empty string if not needed.',
    },
    summary: { type: 'string' },
    confident: {
      type: 'boolean',
      description: 'False when the intended structure had to be guessed.',
    },
  },
  required: ['ops', 'append', 'summary', 'confident'],
};

function repairSpec(text) {
  return {
    schema: REPAIR_SCHEMA,
    // A little reasoning budget: deciding how a truncated document was meant to
    // close is the one genuinely non-mechanical part of this job.
    thinkingBudget: 512,
    system: [
      'You repair malformed JSON.',
      'Mechanical damage (trailing commas, single quotes, unquoted keys, comments, Python literals) has ALREADY been fixed before you see the input. Do not report those.',
      'Return the minimum set of edits that make the document parse as JSON.',
      'Each `find` MUST be an exact substring of the input, copied verbatim, and long enough to be unambiguous.',
      'Use `append` for input that was cut off mid-document — usually just the closing brackets and braces.',
      'Never invent data. If a value is missing, use null rather than guessing a plausible value.',
      'Set `confident` to false when you had to guess the intended structure.',
    ].join(' '),
    prompt: `Repair this JSON:\n\n${text}`,
  };
}

function mockSpec(text, hint) {
  return {
    // No response schema: the output shape is whatever the user's data looks
    // like, so constraining it would mean returning JSON-as-an-escaped-string
    // and paying escaping overhead on every value.
    schema: null,
    thinkingBudget: 0,
    system: [
      'You generate realistic sample data matching the structure of a JSON document or JSON Schema.',
      'Return ONLY the generated JSON value, matching the input structure exactly: same keys, same types, same nesting.',
      'Values must be realistic and varied — real-looking names, plausible dates in ISO 8601, coherent related fields.',
      'Never use placeholders like "string", "foo", or "example".',
      'Respect any format, enum, minimum, or maximum constraints present in the input.',
    ].join(' '),
    prompt: [
      hint ? `Requirement: ${hint}` : 'Generate 5 records if the input is an array, otherwise one object.',
      '',
      'Match this structure:',
      '',
      text,
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

// A cookie the user can clear, falling back to a hashed IP. Neither is
// tamper-proof, and that is fine: this counter only enforces fairness between
// users. The un-bypassable ceiling is the global daily cap behind it.
function identify(req) {
  const existing = readCookie(req.headers.cookie, COOKIE);
  if (existing) return { userId: existing, setCookie: null };

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const id = ip
    ? 'ip_' + createHash('sha256').update(ip + (process.env.UID_SALT || '')).digest('hex').slice(0, 24)
    : randomUUID();

  return {
    userId: id,
    setCookie: `${COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
  };
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=') || null;
  }
  return null;
}

function send(res, status, body) {
  res.status(status).json(body);
}
