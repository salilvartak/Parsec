// Rate limiting for the AI proxy.
//
// On the free tier there is no billing risk — requests past Google's quota just
// fail. So the job here is not protecting a wallet, it is rationing a fixed
// daily pool so one user cannot drain it by 9am and leave the feature dead for
// everyone else.
//
// Three counters, all in Redis so they hold across serverless instances:
//   global:day    — the real ceiling. Cannot be bypassed.
//   global:minute — smooths bursts so we hit our own limit instead of Google's.
//   user:day      — soft per-user fairness. Bypassable by clearing a cookie;
//                   that is acceptable because the global cap is behind it.

import { Redis } from '@upstash/redis';
import { globalDailyCap, globalMinuteCap, PER_USER_DAILY, COOLDOWN_SECONDS } from './config.js';

// Thrown when the limiter cannot run safely. Distinct from a runtime failure so
// the handler can report it as a setup problem rather than a generic outage.
export class LimiterConfigError extends Error {}

let store = null;

// Built on first use, not at import time. A throw during module evaluation
// takes down the whole function with an opaque 500 and no way to explain why —
// deferring it means the handler can catch this and say what's actually wrong.
function getStore() {
  if (store) return store;
  store = createStore();
  return store;
}

// Upstash when it's configured, an in-memory map otherwise.
//
// The fallback exists so `vercel dev` works before you've provisioned Redis —
// it is NOT viable in production: every serverless instance gets its own map,
// so the counters fragment and the global cap stops being global. Guarded on
// the Vercel production flag rather than trusted to a comment.
function createStore() {
  const configured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (configured) return Redis.fromEnv();

  if (process.env.VERCEL_ENV === 'production') {
    throw new LimiterConfigError(
      'Upstash Redis is not configured. Add the Upstash integration in the Vercel dashboard ' +
      '(Storage → Upstash Redis) and connect it to this project. The in-memory limiter cannot ' +
      'enforce a shared quota across serverless instances, so it is refused in production.',
    );
  }

  console.warn('[limit] Upstash not configured — using in-memory counters (dev only, not shared across instances).');
  return memoryStore();
}

// Minimal subset of the Upstash client: incr / expire / get / ttl / decr / set.
function memoryStore() {
  const values = new Map();   // key -> number | string
  const expiry = new Map();   // key -> epoch ms

  const live = (key) => {
    const at = expiry.get(key);
    if (at !== undefined && Date.now() > at) { values.delete(key); expiry.delete(key); return false; }
    return values.has(key);
  };

  return {
    async incr(key) {
      const next = (live(key) ? Number(values.get(key)) : 0) + 1;
      values.set(key, next);
      return next;
    },
    async decr(key) {
      const next = (live(key) ? Number(values.get(key)) : 0) - 1;
      values.set(key, next);
      return next;
    },
    async get(key) { return live(key) ? values.get(key) : null; },
    async expire(key, seconds) { expiry.set(key, Date.now() + seconds * 1000); return 1; },
    async set(key, value, opts) {
      values.set(key, value);
      if (opts?.ex) expiry.set(key, Date.now() + opts.ex * 1000);
      return 'OK';
    },
    async ttl(key) {
      if (!live(key)) return -2;
      const at = expiry.get(key);
      return at === undefined ? -1 : Math.ceil((at - Date.now()) / 1000);
    },
  };
}

const DAY = 60 * 60 * 24;
const MINUTE = 60;
const COOLDOWN_KEY = 'g:cooldown';

const dayKey = () => new Date().toISOString().slice(0, 10);       // UTC date
const minuteKey = () => new Date().toISOString().slice(0, 16);    // UTC minute

// Increment a counter and set its TTL on first write. Returns the new value.
async function bump(key, ttl) {
  const value = await getStore().incr(key);
  if (value === 1) await getStore().expire(key, ttl);
  return value;
}

// Read counters without incrementing — used to report remaining quota on
// responses and rejections.
async function peek(key) {
  const value = await getStore().get(key);
  return Number(value) || 0;
}

// Claim one request slot.
// → { ok: true, remaining } | { ok: false, reason, retryAfter, remaining }
export async function claim(userId) {
  // Resolve the store before anything else. getStore() throws synchronously
  // when Redis is missing, and doing that midway through building a
  // Promise.all array would leave the sibling promises rejected with nobody
  // listening — an unhandled rejection that can kill the process instead of
  // surfacing as a catchable error.
  getStore();

  const gDay = `g:d:${dayKey()}`;
  const gMin = `g:m:${minuteKey()}`;
  const uDay = `u:${userId}:${dayKey()}`;

  // Check before incrementing, so a rejected request doesn't burn quota it was
  // never allowed to use.
  const [globalUsed, minuteUsed, userUsed, cooling] = await Promise.all([
    peek(gDay), peek(gMin), peek(uDay), getStore().ttl(COOLDOWN_KEY),
  ]);

  // Google rate-limited us recently. Our configured RPM is a guess, so this is
  // the mechanism that actually keeps us inside their real limit.
  if (cooling > 0) {
    return {
      ok: false,
      reason: 'busy',
      retryAfter: cooling,
      remaining: Math.max(0, PER_USER_DAILY - userUsed),
    };
  }

  if (globalUsed >= globalDailyCap()) {
    return {
      ok: false,
      reason: 'global_daily',
      retryAfter: secondsUntilUtcMidnight(),
      remaining: 0,
    };
  }

  if (userUsed >= PER_USER_DAILY) {
    return {
      ok: false,
      reason: 'user_daily',
      retryAfter: secondsUntilUtcMidnight(),
      remaining: 0,
    };
  }

  if (minuteUsed >= globalMinuteCap()) {
    return {
      ok: false,
      reason: 'busy',
      retryAfter: 60 - new Date().getUTCSeconds(),
      remaining: Math.max(0, PER_USER_DAILY - userUsed),
    };
  }

  const [, , userNow] = await Promise.all([
    bump(gDay, DAY), bump(gMin, MINUTE), bump(uDay, DAY),
  ]);

  return { ok: true, remaining: Math.max(0, PER_USER_DAILY - userNow) };
}

// Called when Google returns 429. Stops all sending for a short window so we
// stop pushing against a limit we've demonstrably already hit.
export async function tripCooldown() {
  try {
    await getStore().set(COOLDOWN_KEY, '1', { ex: COOLDOWN_SECONDS });
  } catch { /* best effort */ }
}

// Hand a slot back when the upstream call failed for a reason that isn't the
// user's fault. Without this a Gemini outage would silently eat everyone's
// daily allowance.
export async function refund(userId) {
  try {
    await Promise.all([
      getStore().decr(`g:d:${dayKey()}`),
      getStore().decr(`g:m:${minuteKey()}`),
      getStore().decr(`u:${userId}:${dayKey()}`),
    ]);
  } catch { /* best effort — a lost refund is not worth failing the request */ }
}

function secondsUntilUtcMidnight() {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
  );
  return Math.ceil((midnight - now.getTime()) / 1000);
}
