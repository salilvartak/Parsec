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
const MAX_LEAVES_SHOWN = 8;

export function buildFlow(value, collapsed = {}) {
  const nodes = [];
  const edges = [];
  let truncated = false;

  function estHeight(leafCount) {
    const shown = Math.min(leafCount, MAX_LEAVES_SHOWN) + (leafCount > MAX_LEAVES_SHOWN ? 1 : 0);
    return HEAD_H + shown * LEAF_H + PAD;
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

    nodes.push({
      id,
      type: 'json',
      position: { x: 0, y: 0 },
      width: NODE_W,
      height: estHeight(leaves.length),
      data: {
        label, leaves, collapsible, collapsed: isCollapsed, path: id,
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
    nodes.push({
      id: 'root', type: 'json', position: { x: 0, y: 0 }, width: NODE_W, height: estHeight(1),
      data: { label: 'root', leaves: [{ key: '', value, type: value === null ? 'null' : typeof value }], collapsible: false, collapsed: false, path: 'root', count: 0, nodeType: typeof value, size: 0 },
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
