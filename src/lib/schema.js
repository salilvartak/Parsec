import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Validate a JSON value against a JSON Schema.
export function validateSchema(value, schemaText) {
  let schema;
  try {
    schema = typeof schemaText === 'string' ? JSON.parse(schemaText) : schemaText;
  } catch (e) {
    return { success: false, error: 'Invalid schema JSON: ' + e.message };
  }
  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const valid = validate(value);
    return { success: true, valid, errors: validate.errors || [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Infer a JSON Schema (draft-07) from a sample value.
const MAX_DEPTH = 50;
export function inferSchema(value) {
  const schema = { $schema: 'http://json-schema.org/draft-07/schema#', ...build(value, 0) };
  return schema;
}

function build(value, depth) {
  if (depth > MAX_DEPTH) return {};
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: 'array', items: {} };
    // merge item schemas
    const objs = value.filter(v => v && typeof v === 'object' && !Array.isArray(v));
    if (objs.length === value.length) {
      return { type: 'array', items: build(mergeSamples(objs), depth + 1) };
    }
    return { type: 'array', items: build(value[0], depth + 1) };
  }
  if (typeof value === 'object') {
    const properties = {};
    const required = [];
    const optional = value.__optional__ || new Set();
    for (const [k, v] of Object.entries(value)) {
      if (k === '__optional__') continue;
      properties[k] = build(v, depth + 1);
      if (!optional.has(k)) required.push(k);
    }
    const out = { type: 'object', properties };
    if (required.length) out.required = required;
    return out;
  }
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  return { type: typeof value }; // string | boolean
}

function mergeSamples(objs) {
  const allKeys = new Set();
  objs.forEach(o => Object.keys(o).forEach(k => allKeys.add(k)));
  const merged = {};
  const optional = new Set();
  for (const k of allKeys) {
    const present = objs.filter(o => k in o);
    if (present.length < objs.length) optional.add(k);
    merged[k] = present[0][k];
  }
  merged.__optional__ = optional;
  return merged;
}
