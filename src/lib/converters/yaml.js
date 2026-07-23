import yaml from 'js-yaml';
import { parseJson } from '../parse.js';

export function yamlToJson(text) {
  try {
    const obj = yaml.load(text);
    if (obj === undefined) return { success: false, error: 'Empty YAML input' };
    return { success: true, data: JSON.stringify(obj, null, 2) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function jsonToYaml(json) {
  const r = parseJson(json);
  if (!r.success) return { success: false, error: r.error ? `${r.error.message} (line ${r.error.line})` : 'Empty input' };
  try {
    // sortKeys:false preserves insertion order
    return { success: true, data: yaml.dump(r.value, { sortKeys: false, lineWidth: -1 }) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
