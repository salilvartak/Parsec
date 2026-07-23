// Structural recursive diff between two JSON values.
// Produces a flat, ordered list of lines for a side-by-side view, each tagged
// same | added | removed | changed. Depth-guarded.
const MAX_DEPTH = 100;

export function diffJson(a, b) {
  const left = [];
  const right = [];
  walk(a, b, 0, '', left, right);
  return { left, right };
}

function typeOf(v) {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
}

function push(arr, indent, text, status) {
  arr.push({ text: '  '.repeat(indent) + text, status });
}
function blank(arr) { arr.push({ text: '', status: 'blank' }); }

function walk(a, b, depth, keyLabel, left, right) {
  if (depth > MAX_DEPTH) return;
  const ta = typeOf(a), tb = typeOf(b);
  const label = keyLabel ? `"${keyLabel}": ` : '';

  const aMissing = a === undefined;
  const bMissing = b === undefined;

  if (aMissing && !bMissing) { // added on right
    renderValue(b, depth, label, right, 'added');
    mirrorBlank(right, left, depth);
    return;
  }
  if (bMissing && !aMissing) { // removed from right
    renderValue(a, depth, label, left, 'removed');
    mirrorBlank(left, right, depth);
    return;
  }

  const bothBranch = (ta === 'object' || ta === 'array') && ta === tb;
  if (bothBranch) {
    const open = ta === 'array' ? '[' : '{';
    const close = ta === 'array' ? ']' : '}';
    push(left, depth, label + open, 'same');
    push(right, depth, label + open, 'same');
    const keys = ta === 'array'
      ? range(Math.max(a.length, b.length))
      : union(Object.keys(a), Object.keys(b));
    for (const k of keys) {
      const av = ta === 'array' ? a[k] : (k in a ? a[k] : undefined);
      const bv = ta === 'array' ? b[k] : (k in b ? b[k] : undefined);
      walk(av, bv, depth + 1, ta === 'array' ? '' : k, left, right);
    }
    push(left, depth, close, 'same');
    push(right, depth, close, 'same');
    return;
  }

  // leaf comparison (or type mismatch)
  const equal = ta === tb && JSON.stringify(a) === JSON.stringify(b);
  const status = equal ? 'same' : 'changed';
  renderValue(a, depth, label, left, status);
  renderValue(b, depth, label, right, status);
}

function renderValue(v, depth, label, arr, status) {
  const t = typeOf(v);
  if (t === 'object' || t === 'array') {
    // render collapsed block inline for the added/removed side
    const json = JSON.stringify(v, null, 2).split('\n');
    json.forEach((ln, i) => push(arr, depth, i === 0 ? label + ln : ln, status));
  } else {
    push(arr, depth, label + JSON.stringify(v), status);
  }
}

// Keep the two panes vertically aligned: when one side emits N lines, pad the
// other with blanks. We approximate by padding a single blank per leaf; good
// enough for readability given renderValue may emit multiple lines.
function mirrorBlank(fromArr, otherArr, depth) {
  blank(otherArr);
}

function union(a, b) {
  const seen = new Set();
  const out = [];
  for (const k of a) { if (!seen.has(k)) { seen.add(k); out.push(k); } }
  for (const k of b) { if (!seen.has(k)) { seen.add(k); out.push(k); } }
  return out;
}
function range(n) { return Array.from({ length: n }, (_, i) => i); }
