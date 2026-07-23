import { parseJson } from '../parse.js';

// Detect and unwrap stringified JSON. If the parsed value is itself a string
// that contains JSON, re-parse it — recursively, up to a depth guard.
const MAX_UNWRAP = 20;

export function unwrapStringified(text) {
  const r = parseJson(text);
  if (!r.success) return { success: false, error: r.error ? `${r.error.message} (line ${r.error.line})` : 'Empty input' };

  let value = r.value;
  let unwrapped = 0;
  while (typeof value === 'string' && unwrapped < MAX_UNWRAP) {
    try {
      const inner = JSON.parse(value);
      // only continue if it actually produced structured data or another string
      value = inner;
      unwrapped++;
    } catch {
      break;
    }
  }
  if (unwrapped === 0) {
    return { success: false, error: 'Input is not a stringified JSON payload' };
  }
  return { success: true, data: JSON.stringify(value, null, 2), levels: unwrapped };
}

// Wrap: stringify + escape the current JSON so it can be embedded as a string literal.
export function wrapStringified(text) {
  const r = parseJson(text);
  if (!r.success) return { success: false, error: r.error ? `${r.error.message} (line ${r.error.line})` : 'Empty input' };
  const minified = JSON.stringify(r.value);
  return { success: true, data: JSON.stringify(minified) };
}
