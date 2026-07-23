import { parseJson } from '../parse.js';

// Infer a TypeScript interface tree from sample JSON.
// - arrays: sample all elements, union member types
// - objects: mark a field optional (?) when absent from some array-of-object samples
// - depth guard prevents runaway recursion on pathological input
const MAX_DEPTH = 50;

export function jsonToTs(json, rootName = 'Root') {
  const r = parseJson(json);
  if (!r.success) return { success: false, error: r.error ? `${r.error.message} (line ${r.error.line})` : 'Empty input' };

  const interfaces = new Map(); // name -> body string
  const used = new Set();

  function uniqueName(base) {
    let name = pascal(base) || 'Obj';
    let i = 2;
    while (used.has(name)) name = pascal(base) + i++;
    used.add(name);
    return name;
  }

  function typeOf(value, keyHint, depth) {
    if (depth > MAX_DEPTH) return 'any';
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'any[]';
      const memberTypes = new Set();
      // if elements are objects, merge their shapes into one interface
      const objs = value.filter(v => v && typeof v === 'object' && !Array.isArray(v));
      if (objs.length === value.length) {
        return typeOf(mergeObjects(objs), keyHint, depth) + '[]';
      }
      for (const v of value) memberTypes.add(typeOf(v, keyHint, depth + 1));
      const union = [...memberTypes];
      const inner = union.length > 1 ? `(${union.join(' | ')})` : union[0];
      return `${inner}[]`;
    }
    if (typeof value === 'object') {
      const name = uniqueName(keyHint || 'Obj');
      const optionalKeys = value.__optional__ || new Set();
      const lines = [];
      for (const [k, v] of Object.entries(value)) {
        if (k === '__optional__') continue;
        const opt = optionalKeys.has(k) ? '?' : '';
        const t = typeOf(v, k, depth + 1);
        lines.push(`  ${safeKey(k)}${opt}: ${t};`);
      }
      interfaces.set(name, `interface ${name} {\n${lines.join('\n')}\n}`);
      return name;
    }
    return typeof value; // string | number | boolean
  }

  // Merge an array of objects, unioning value types and tracking which keys are
  // missing in some samples (→ optional).
  function mergeObjects(objs) {
    const allKeys = new Set();
    objs.forEach(o => Object.keys(o).forEach(k => allKeys.add(k)));
    const merged = {};
    const optional = new Set();
    for (const k of allKeys) {
      const present = objs.filter(o => k in o);
      if (present.length < objs.length) optional.add(k);
      // union of sample values under this key — pick a representative merge
      const vals = present.map(o => o[k]);
      merged[k] = vals.length === 1 ? vals[0] : reduceValues(vals);
    }
    merged.__optional__ = optional;
    return merged;
  }

  // For a key seen with multiple sample values, if all objects merge them; else keep first.
  function reduceValues(vals) {
    const objs = vals.filter(v => v && typeof v === 'object' && !Array.isArray(v));
    if (objs.length === vals.length && objs.length > 0) return mergeObjects(objs);
    return vals[0];
  }

  try {
    const rootType = typeOf(r.value, rootName, 0);
    let out = [...interfaces.values()].reverse().join('\n\n');
    // if root wasn't an object (e.g. primitive/array), emit a type alias
    if (!interfaces.has(rootType)) {
      out = out ? out + '\n\n' : '';
      out += `type ${pascal(rootName)} = ${rootType};`;
    }
    return { success: true, data: out || `type ${pascal(rootName)} = any;` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function pascal(s) {
  return String(s).replace(/(^\w|[-_ ]\w)/g, m => m.replace(/[-_ ]/, '').toUpperCase());
}
function safeKey(k) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
}
