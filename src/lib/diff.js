// Structural, semantic diff between two JSON values — jsondiff.com style.
//
// Builds a diff TREE (not flat lines). From that one tree we render both the
// merged collapsible view and the side-by-side view, so both benefit from:
//   • key-order-insensitive object comparison
//   • smart array matching (by id-like key, else LCS) so an inserted/removed/
//     reordered element diffs locally instead of cascading down the array
//   • a distinct "type" status for number→string, object→array, etc.
//
// Node shape:
//   { kind:'branch'|'leaf', status, label, labelKind, path, changed,
//     aType, bType, aValue, bValue, children? }
// status ∈ same | added | removed | changed | type
const MAX_DEPTH = 100;
const ID_KEYS = ['id', '_id', 'key', 'uuid', 'guid', 'name', 'slug'];

function typeOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function isPlainObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

export function diffJson(a, b) {
  const stats = { added: 0, removed: 0, changed: 0, type: 0, same: 0 };
  const root = diffNode(a, b, true, true, 'root', 'root', 'key', 0, stats);
  return { root, stats, identical: stats.added + stats.removed + stats.changed + stats.type === 0 };
}

function diffNode(a, b, ap, bp, label, path, labelKind, depth, stats) {
  if (ap && !bp) { stats.removed++; return oneSided('removed', a, label, path, labelKind); }
  if (bp && !ap) { stats.added++; return oneSided('added', b, label, path, labelKind); }

  const ta = typeOf(a), tb = typeOf(b);
  if (ta !== tb) {
    stats.type++;
    return { kind: 'leaf', status: 'type', label, labelKind, path, aType: ta, bType: tb, aValue: a, bValue: b, changed: true };
  }

  if (depth < MAX_DEPTH && ta === 'object') return diffObject(a, b, label, path, labelKind, depth, stats);
  if (depth < MAX_DEPTH && ta === 'array') return diffArray(a, b, label, path, labelKind, depth, stats);

  const same = eq(a, b);
  if (same) stats.same++; else stats.changed++;
  return { kind: 'leaf', status: same ? 'same' : 'changed', label, labelKind, path, aType: ta, bType: tb, aValue: a, bValue: b, changed: !same };
}

// A whole value present on only one side. Kept as a leaf carrying the value;
// renderers expand containers to full JSON.
function oneSided(status, value, label, path, labelKind) {
  const t = typeOf(value);
  return { kind: 'leaf', status, label, labelKind, path, aType: t, bType: t, value, changed: true };
}

function diffObject(a, b, label, path, labelKind, depth, stats) {
  const keys = union(Object.keys(a), Object.keys(b));
  const children = keys.map(k =>
    diffNode(
      a[k], b[k],
      Object.prototype.hasOwnProperty.call(a, k),
      Object.prototype.hasOwnProperty.call(b, k),
      k, `${path}.${k}`, 'key', depth + 1, stats,
    ),
  );
  const changed = children.some(c => c.changed);
  return { kind: 'branch', container: 'object', status: changed ? 'changed' : 'same', label, labelKind, path, children, changed };
}

function diffArray(a, b, label, path, labelKind, depth, stats) {
  const kf = commonKey(a, b);
  const children = kf
    ? matchByKey(a, b, kf, path, depth, stats)
    : matchByLcs(a, b, path, depth, stats);
  const changed = children.some(c => c.changed);
  return { kind: 'branch', container: 'array', status: changed ? 'changed' : 'same', label, labelKind, path, keyField: kf, children, changed };
}

// Pick an id-like field present (with a primitive, unique value) on every
// element of both arrays. That lets us match elements by identity.
function commonKey(a, b) {
  const all = [...a, ...b];
  if (all.length === 0 || !all.every(isPlainObj)) return null;
  for (const kf of ID_KEYS) {
    if (all.every(v => kf in v && v[kf] !== null && typeof v[kf] !== 'object')) {
      if (uniqueKeys(a, kf) && uniqueKeys(b, kf)) return kf;
    }
  }
  return null;
}
function uniqueKeys(arr, kf) {
  const s = new Set(arr.map(v => String(v[kf])));
  return s.size === arr.length;
}

function matchByKey(a, b, kf, path, depth, stats) {
  const aByKey = new Map(a.map((v, i) => [String(v[kf]), { v, i }]));
  const bKeys = new Set(b.map(v => String(v[kf])));
  const children = [];
  // walk B order: matched (maybe changed) or added
  b.forEach((bv, bi) => {
    const k = String(bv[kf]);
    const hit = aByKey.get(k);
    const lbl = `${kf}=${k}`;
    if (hit) children.push(diffNode(hit.v, bv, true, true, lbl, `${path}[${bi}]`, 'match', depth + 1, stats));
    else children.push(diffNode(undefined, bv, false, true, lbl, `${path}[${bi}]`, 'match', depth + 1, stats));
  });
  // then A-only: removed
  a.forEach((av, ai) => {
    const k = String(av[kf]);
    if (!bKeys.has(k)) children.push(diffNode(av, undefined, true, false, `${kf}=${k}`, `${path}[${ai}]`, 'match', depth + 1, stats));
  });
  return children;
}

// Longest-common-subsequence alignment on exact element equality; a delete
// immediately followed by an insert is folded into an in-place "change" so
// element edits recurse instead of showing as remove+add.
function matchByLcs(a, b, path, depth, stats) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { ops.push({ op: 'same', ai: i, bj: j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'del', ai: i }); i++; }
    else { ops.push({ op: 'ins', bj: j }); j++; }
  }
  while (i < n) { ops.push({ op: 'del', ai: i }); i++; }
  while (j < m) { ops.push({ op: 'ins', bj: j }); j++; }

  const merged = [];
  for (let k = 0; k < ops.length; k++) {
    const o = ops[k], nx = ops[k + 1];
    if (o.op === 'del' && nx && nx.op === 'ins') { merged.push({ op: 'change', ai: o.ai, bj: nx.bj }); k++; }
    else merged.push(o);
  }

  return merged.map(o => {
    const idx = o.bj ?? o.ai;
    const lbl = `[${idx}]`;
    if (o.op === 'same') return diffNode(a[o.ai], b[o.bj], true, true, lbl, `${path}[${o.bj}]`, 'index', depth + 1, stats);
    if (o.op === 'change') return diffNode(a[o.ai], b[o.bj], true, true, lbl, `${path}[${o.bj}]`, 'index', depth + 1, stats);
    if (o.op === 'del') return diffNode(a[o.ai], undefined, true, false, `[${o.ai}]`, `${path}[${o.ai}]`, 'index', depth + 1, stats);
    return diffNode(undefined, b[o.bj], false, true, lbl, `${path}[${o.bj}]`, 'index', depth + 1, stats);
  });
}

function union(a, b) {
  const seen = new Set(), out = [];
  for (const k of a) if (!seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of b) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
}

// ---------- side-by-side projection ----------
// Flatten the tree into index-aligned left/right line arrays for the classic
// two-pane view. Blanks pad the shorter side so panes never shear apart.

function labelPrefix(node) {
  if (node.labelKind === 'key') return `"${node.label}": `;
  if (node.labelKind === 'match') return `${node.label} ⇒ `;
  return ''; // positional index — no prefix, matches a plain array dump
}

export function flatten(root) {
  const left = [], right = [];
  const pushL = (indent, text, status, path) => left.push({ text: '  '.repeat(indent) + text, status, path });
  const pushR = (indent, text, status, path) => right.push({ text: '  '.repeat(indent) + text, status, path });
  const blankL = () => left.push({ text: '', status: 'blank', path: null });
  const blankR = () => right.push({ text: '', status: 'blank', path: null });
  const align = () => { while (left.length < right.length) blankL(); while (right.length < left.length) blankR(); };

  const dumpSide = (value, indent, prefix, status, path, side) => {
    const lines = (typeOf(value) === 'object' || typeOf(value) === 'array')
      ? JSON.stringify(value, null, 2).split('\n')
      : [JSON.stringify(value)];
    lines.forEach((ln, k) => (side === 'L' ? pushL : pushR)(indent, k === 0 ? prefix + ln : ln, status, path));
  };

  const walk = (node, indent) => {
    const prefix = labelPrefix(node);

    if (node.kind === 'branch') {
      const open = node.container === 'array' ? '[' : '{';
      const close = node.container === 'array' ? ']' : '}';
      pushL(indent, prefix + open, 'same', node.path);
      pushR(indent, prefix + open, 'same', node.path);
      for (const c of node.children) walk(c, indent + 1);
      pushL(indent, close, 'same', node.path);
      pushR(indent, close, 'same', node.path);
      return;
    }

    // leaves
    if (node.status === 'added') { dumpSide(node.value, indent, prefix, 'added', node.path, 'R'); align(); return; }
    if (node.status === 'removed') { dumpSide(node.value, indent, prefix, 'removed', node.path, 'L'); align(); return; }

    if (node.status === 'same') {
      const t = JSON.stringify(node.aValue);
      pushL(indent, prefix + t, 'same', node.path);
      pushR(indent, prefix + t, 'same', node.path);
      return;
    }
    // changed or type: old on the left, new on the right
    const st = node.status; // 'changed' | 'type'
    dumpSide(node.aValue, indent, prefix, st, node.path, 'L');
    const rTarget = right.length;
    dumpSide(node.bValue, indent, prefix, st, node.path, 'R');
    // keep the two multi-line dumps aligned
    void rTarget; align();
  };

  // root is usually a branch; if the whole doc is a changed scalar, still fine
  walk(root, 0);
  return { left, right };
}

// Row indices that differ — for next/prev navigation in the side-by-side view.
// `enabled` optionally restricts to specific statuses (the stat-pill filters).
export function changeRows(left, right, enabled = null) {
  const rows = [];
  const differs = (s) => s && s !== 'same' && s !== 'blank' && (!enabled || enabled[s]);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (differs(left[i]?.status) || differs(right[i]?.status)) rows.push(i);
  }
  return rows;
}

// Consecutive differing rows collapse to one logical change for navigation.
export function changeGroups(rows) {
  const groups = [];
  for (let i = 0; i < rows.length; i++) if (i === 0 || rows[i] !== rows[i - 1] + 1) groups.push(rows[i]);
  return groups;
}

// Collapse long unchanged runs, keeping `context` rows either side.
export function collapseUnchanged(left, right, context = 3) {
  const total = Math.max(left.length, right.length);
  const changed = new Set(changeRows(left, right));
  const keep = new Set();
  for (const i of changed) for (let j = i - context; j <= i + context; j++) if (j >= 0 && j < total) keep.add(j);
  const out = [];
  let run = 0;
  for (let i = 0; i < total; i++) {
    if (keep.has(i)) { if (run) { out.push({ type: 'gap', count: run }); run = 0; } out.push({ type: 'row', i }); }
    else run++;
  }
  if (run) out.push({ type: 'gap', count: run });
  return out;
}
