import { parseJson } from './parse.js';

// indent: 2 | 4 | 'tab'
export function indentString(indent) {
  if (indent === 'tab') return '\t';
  return indent; // number → JSON.stringify handles it
}

export function formatJson(text, indent = 2) {
  const r = parseJson(text);
  if (!r.success) return { success: false, error: r.error ? errMsg(r.error) : 'Empty document' };
  return { success: true, data: JSON.stringify(r.value, null, indentString(indent)) };
}

export function minifyJson(text) {
  const r = parseJson(text);
  if (!r.success) return { success: false, error: r.error ? errMsg(r.error) : 'Empty document' };
  return { success: true, data: JSON.stringify(r.value) };
}

function errMsg(e) {
  return `${e.message} (line ${e.line}, column ${e.col})`;
}
