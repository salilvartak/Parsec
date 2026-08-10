// Tunables for the AI proxy. Everything that depends on Google's free-tier
// quota lives here so there is exactly one place to edit when the tier changes.

// Free-tier ceilings for MODEL, from the AI Studio rate-limit dashboard
// (https://aistudio.google.com/rate-limit). Per-project, and no longer published
// in Google's docs, so these are read off the dashboard by hand.
export const GEMINI_RPD = 500;    // confirmed: dashboard shows a 0/500 daily bar

// The dashboard reports no RPM for this model, so this is a deliberately
// conservative guess rather than a known value. It does not need to be exact:
// a 429 from Google trips the cooldown in limit.js, which backs us off
// automatically. Raise it if `busy` rejections show up while quota remains.
export const GEMINI_RPM = 10;

export const MODEL = 'gemini-3.1-flash-lite';

// Spend at most this share of the daily allowance. The headroom means hitting
// our own ceiling returns a clean "quota used up" instead of Google's 429, and
// leaves room for retries.
export const GLOBAL_RESERVE = 0.85;

// Per-user daily cap. Roughly (RPD * GLOBAL_RESERVE) / expected daily users —
// at 500 RPD that is 425 usable calls, so 10 each spreads across ~42 users a
// day. Lower it if you expect more traffic than that; the global cap will hold
// the line either way, it just starts rejecting earlier in the day.
export const PER_USER_DAILY = 10;

// How long to stop sending after Google rate-limits us. Short enough that a
// brief burst doesn't disable the feature for long, long enough to actually
// clear a per-minute window.
export const COOLDOWN_SECONDS = 90;

// Whether a shared counter store (Upstash Redis) is mandatory in production.
//
// Serverless instances don't share memory, so without Redis each instance
// counts on its own and the global cap is enforced per-instance rather than
// per-project. On the FREE tier that degradation is tolerable: there is no
// billing attached, so the worst case is the daily quota draining sooner and
// Google returning 429s, which trips the cooldown in limit.js. The user sees
// "AI busy" instead of a bill.
//
// Turn this on the moment billing is enabled on the Google project. At that
// point an unenforced cap costs real money, and refusing to start is much
// better than discovering the problem on an invoice.
// Read on each call rather than captured at import: a module-load snapshot is
// invisible to tests and silently stale if anything sets the variable late.
export const requireSharedLimiter = () => process.env.REQUIRE_SHARED_LIMITER === 'true';

// Reject oversized documents before they cost a request. 100KB of JSON is far
// past the point where a repair is useful anyway.
export const MAX_INPUT_BYTES = 100_000;

// Output ceilings. Repair returns a patch list, not the document, so it needs
// far less room than a naive "return the fixed JSON" design would.
export const MAX_OUTPUT_TOKENS = { repair: 2048, mock: 4096 };

export const globalDailyCap = () => Math.floor(GEMINI_RPD * GLOBAL_RESERVE);
export const globalMinuteCap = () => Math.max(1, Math.floor(GEMINI_RPM * GLOBAL_RESERVE));
