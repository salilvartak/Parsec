import LZString from 'lz-string';

const PARAM = 'doc';

// Serialize raw text into a URL-safe compressed string in the query param.
export function buildShareUrl(rawText) {
  const compressed = LZString.compressToEncodedURIComponent(rawText);
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, compressed);
  return url.toString();
}

// On load, read the param and return the decompressed text (or null).
export function readShareParam() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(PARAM);
  if (!raw) return null;
  try {
    const text = LZString.decompressFromEncodedURIComponent(raw);
    return text || null;
  } catch {
    return null;
  }
}

export function clearShareParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  window.history.replaceState({}, '', url.toString());
}
