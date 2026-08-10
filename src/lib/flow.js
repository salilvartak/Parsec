import dagre from 'dagre';

// Build ReactFlow nodes/edges from parsed JSON.
// One node per object/array. Primitive values fold into the parent node as
// leaf rows (not separate nodes). Node sizes are estimated so dagre can lay
// out a non-overlapping hierarchical tree.
const MAX_NODES = 600;
const NODE_W = 260;
const HEAD_H = 30;
const LEAF_H = 16;
const PAD = 16;

// Sizing constants for "fit" mode, where nodes grow to show their full content
// instead of clipping it. The node font is JetBrains Mono, so a character's
// advance is a fixed fraction of the size and text width can be computed rather
// than measured — measuring would mean rendering every node twice.
const CHAR_W_LEAF = 6.6;   // 11px monospace
const CHAR_W_HEAD = 7.2;   // 12px monospace
// Deliberately wider than CHAR_W_LEAF when counting how many characters fit on
// a line. The two failure directions aren't symmetric: overestimating rows just
// leaves a little slack inside a node, while underestimating them makes the
// node outgrow the box dagre reserved and overlap its neighbours. The webfont
// may also not have loaded when this runs, so assume the pessimistic metric.
const WRAP_CHAR_W = 7.1;
const PAD_X = 24;          // .rf-node horizontal padding, both sides
const HEAD_EXTRA = 78;     // type dot, size badge, collapse button, gaps
const MAX_FIT_W = 760;     // past this a node stops being readable as a card
const MIN_CHARS = 8;       // guard so a pathological width can't divide by ~0

// The text a leaf row renders, used for width and wrap calculations. Must stay
// in step with the JSX in Flowchart.jsx.
function leafText(l) {
  const key = l.key === '' ? '' : `${l.key}: `;
  return key + (l.type === 'string' ? `"${l.value}"` : String(l.value));
}

export function buildFlow(value, collapsed = {}, fit = false) {
  const nodes = [];
  const edges = [];
  let truncated = false;

  function estHeight(leafCount) {
    return HEAD_H + leafCount * LEAF_H + PAD;
  }

  // In fit mode a node widens to its longest line, capped at MAX_FIT_W. Lines
  // longer than the cap wrap rather than clip, so the height has to count
  // wrapped rows — otherwise dagre reserves too little space and nodes overlap.
  function fitSize(label, leaves) {
    const texts = leaves.map(leafText);
    const headW = label.length * CHAR_W_HEAD + HEAD_EXTRA;
    const widest = texts.reduce((max, t) => Math.max(max, t.length * CHAR_W_LEAF), 0);
    const width = Math.min(MAX_FIT_W, Math.max(NODE_W, Math.ceil(Math.max(headW, widest)) + PAD_X));

    const perLine = Math.max(MIN_CHARS, Math.floor((width - PAD_X) / WRAP_CHAR_W));
    const rows = texts.reduce((n, t) => n + Math.max(1, Math.ceil(t.length / perLine)), 0);
    return { width, height: HEAD_H + rows * LEAF_H + PAD };
  }

  function walk(key, val, path, parentId) {
    if (nodes.length >= MAX_NODES) { truncated = true; return; }
    const type = val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val;
    const isBranch = type === 'object' || type === 'array';
    if (!isBranch) return;

    const id = path;
    const entries = type === 'array'
      ? val.map((v, i) => [String(i), v, `${path}[${i}]`])
      : Object.keys(val).map(k => [k, val[k], `${path}.${k}`]);

    const leaves = entries
      .filter(([, v]) => v === null || typeof v !== 'object')
      .map(([k, v]) => ({ key: k, value: v, type: v === null ? 'null' : typeof v }));

    const childBranches = entries.filter(([, v]) => v && typeof v === 'object');
    const collapsible = childBranches.length > 0;
    const isCollapsed = !!collapsed[id];

    const label = key === null ? 'root' : (type === 'array' ? `${key}` : key);
    const size = fit ? fitSize(label, leaves) : { width: NODE_W, height: estHeight(leaves.length) };

    nodes.push({
      id,
      type: 'json',
      position: { x: 0, y: 0 },
      width: size.width,
      height: size.height,
      data: {
        label, leaves, collapsible, collapsed: isCollapsed, path: id, fit,
        count: childBranches.length, nodeType: type, size: entries.length,
      },
    });
    if (parentId) edges.push({ id: `${parentId}->${id}`, source: parentId, target: id });

    if (isCollapsed) return;
    for (const [k, v, p] of childBranches) walk(k, v, p, id);
  }

  if (value !== undefined && value !== null && typeof value === 'object') {
    walk(null, value, 'root', null);
  } else if (value !== undefined) {
    const leaves = [{ key: '', value, type: value === null ? 'null' : typeof value }];
    const size = fit ? fitSize('root', leaves) : { width: NODE_W, height: estHeight(1) };
    nodes.push({
      id: 'root', type: 'json', position: { x: 0, y: 0 }, width: size.width, height: size.height,
      data: { label: 'root', leaves, collapsible: false, collapsed: false, path: 'root', fit, count: 0, nodeType: typeof value, size: 0 },
    });
  }

  return { nodes, edges, truncated, count: nodes.length };
}

// Lay out nodes with dagre. direction: 'LR' | 'TB'.
export function layout(nodes, edges, direction = 'LR') {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 24, ranksep: 70, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) g.setNode(n.id, { width: n.width, height: n.height });
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  const laid = nodes.map(n => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - n.width / 2, y: p.y - n.height / 2 },
      sourcePosition: direction === 'LR' ? 'right' : 'bottom',
      targetPosition: direction === 'LR' ? 'left' : 'top',
      style: { width: n.width },
    };
  });
  return laid;
}
