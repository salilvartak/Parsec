// Base64 encode / decode, UTF-8 safe.
//
// btoa/atob only handle Latin-1, so raw use corrupts any non-ASCII text (emoji,
// accented chars, CJK). We round-trip through TextEncoder/TextDecoder to encode
// the real UTF-8 bytes. Also supports URL-safe base64 on decode (accepts -_ and
// missing padding), since JWT segments and query params use that alphabet.

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000; // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  // normalize URL-safe alphabet + restore padding
  let s = b64.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Plain text (or any string) → base64.
export function encodeBase64(text) {
  if (text === '') return { success: false, error: 'Nothing to encode' };
  try {
    const bytes = new TextEncoder().encode(text);
    return { success: true, data: bytesToBase64(bytes) };
  } catch (e) {
    return { success: false, error: 'Encode failed: ' + e.message };
  }
}

// Base64 → text. Rejects input that isn't valid base64 rather than returning mojibake.
export function decodeBase64(text) {
  const s = text.trim();
  if (s === '') return { success: false, error: 'Nothing to decode' };
  if (!/^[A-Za-z0-9+/\-_=\s]+$/.test(s)) {
    return { success: false, error: 'Input contains characters that are not valid base64' };
  }
  try {
    const bytes = base64ToBytes(s);
    // fatal:true throws on malformed UTF-8 (e.g. base64 of binary, not text)
    const out = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { success: true, data: out };
  } catch {
    return { success: false, error: 'Not valid base64, or the bytes are not UTF-8 text' };
  }
}
