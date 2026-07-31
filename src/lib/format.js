import { parseJson } from './parse.js';

// indent: 2 | 4 | 'tab'
export function indentString(indent) {
  if (indent === 'tab') return '\t';
  return indent; // number → JSON.stringify handles it
}

export function formatJson(text, indent = 2, sortKeys = false) {
  const r = parseJson(text);
  if (!r.success) return { success: false, error: r.error ? errMsg(r.error) : 'Empty document' };
  const value = sortKeys ? sortDeep(r.value) : r.value;
  return { success: true, data: JSON.stringify(value, null, indentString(indent)) };
}

// Rebuild objects with their keys in lexicographic order. Array order is data,
// so it is never touched.
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}

export function minifyJson(text) {
  const r = parseJson(text);
  if (!r.success) return { success: false, error: r.error ? errMsg(r.error) : 'Empty document' };
  return { success: true, data: JSON.stringify(r.value) };
}

function errMsg(e) {
  return `${e.message} (line ${e.line}, column ${e.col})`;
}
