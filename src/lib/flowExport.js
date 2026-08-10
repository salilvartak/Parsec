// Export the flowchart as a standalone SVG.
//
// The graph is drawn from the node/edge model rather than serialised out of the
// DOM. ReactFlow renders nodes as HTML divs, so a DOM dump would have to wrap
// them in <foreignObject>, which Illustrator, Inkscape and most PDF pipelines
// render as an empty box. Drawing real SVG shapes costs a little geometry code
// and produces a file that opens anywhere.

import { leafText, wrapLeaf, NODE_METRICS } from './flow.js';

const { HEAD_H, LEAF_H, PAD_X } = NODE_METRICS;

const FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const HEAD_SIZE = 12;
const LEAF_SIZE = 11;
const MARGIN = 40;

// Design tokens the export needs, read off the live theme so the file matches
// what's on screen — including the user's accent choice.
const TOKENS = [
  '--surface', '--surface2', '--border', '--text', '--text2', '--text3',
  '--accent', '--syn-key', '--syn-string', '--syn-number', '--syn-bool', '--syn-null',
];

export function readThemeColors(root = document.querySelector('.theme-light, .theme-dark')) {
  const cs = root ? getComputedStyle(root) : null;
  const out = {};
  for (const name of TOKENS) {
    // Fall back to a mid grey rather than emitting `var(--x)`, which would be an
    // unresolvable reference once the file leaves the page.
    out[name] = (cs?.getPropertyValue(name) || '').trim() || '#888888';
  }
  return out;
}

const LEAF_COLOR = {
  string: '--syn-string', number: '--syn-number',
  boolean: '--syn-bool', null: '--syn-null',
};

// XML text escaping. Values come from arbitrary user JSON, so this is the
// difference between an exported file and a malformed one.
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Orthogonal connector matching the on-screen smoothstep edges: out of the
// source, along a midpoint, into the target.
function edgePath(a, b, direction) {
  if (direction === 'TB') {
    const x1 = a.position.x + a.width / 2;
    const y1 = a.position.y + a.height;
    const x2 = b.position.x + b.width / 2;
    const y2 = b.position.y;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`;
  }
  const x1 = a.position.x + a.width;
  const y1 = a.position.y + a.height / 2;
  const x2 = b.position.x;
  const y2 = b.position.y + b.height / 2;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
}

function nodeSvg(n, c) {
  const { x, y } = n.position;
  const d = n.data;
  const accent = d.nodeType === 'array' ? c['--syn-number'] : d.nodeType === 'object' ? c['--accent'] : c['--border'];
  const parts = [];

  parts.push(
    `<rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="7" ` +
    `fill="${c['--surface']}" stroke="${d.collapsible ? accent : c['--border']}" stroke-width="1.3"/>`,
  );

  // Header: type marker, label, size badge.
  const cy = y + 15;
  parts.push(d.nodeType === 'array'
    ? `<rect x="${x + 12}" y="${cy - 3.5}" width="7" height="7" rx="2" fill="${accent}"/>`
    : `<circle cx="${x + 15.5}" cy="${cy}" r="3.5" fill="${accent}"/>`);

  const labelX = x + 26;
  parts.push(
    `<text x="${labelX}" y="${cy + 4}" font-family="${FONT}" font-size="${HEAD_SIZE}" ` +
    `font-weight="700" fill="${c['--text']}">${esc(d.label)}</text>`,
  );
  const badge = d.nodeType === 'array' ? `[${d.size}]` : `{${d.size}}`;
  parts.push(
    `<text x="${labelX + d.label.length * 7.2 + 8}" y="${cy + 4}" font-family="${FONT}" ` +
    `font-size="10" fill="${c['--text3']}">${esc(badge)}</text>`,
  );

  if (d.leaves.length) {
    const sepY = y + HEAD_H - 4;
    parts.push(`<line x1="${x + 1}" y1="${sepY}" x2="${x + n.width - 1}" y2="${sepY}" stroke="${c['--border']}" stroke-width="1"/>`);
  }

  // Leaf rows. In fit mode long rows wrap, using the same metric the node was
  // measured with; otherwise they're clipped to the node width as on screen.
  let rowY = y + HEAD_H + 8;
  for (const l of d.leaves) {
    const text = leafText(l);
    const rows = d.fit ? wrapLeaf(text, n.width) : [clip(text, n.width)];
    const keyLen = l.key === '' ? 0 : l.key.length + 2;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Only the first visual row can contain the key, so only it is split into
      // two coloured spans.
      if (i === 0 && keyLen > 0 && row.length > keyLen) {
        parts.push(
          `<text x="${x + 12}" y="${rowY}" font-family="${FONT}" font-size="${LEAF_SIZE}">` +
          `<tspan fill="${c['--syn-key']}">${esc(row.slice(0, keyLen))}</tspan>` +
          `<tspan fill="${c[LEAF_COLOR[l.type]] || c['--text2']}">${esc(row.slice(keyLen))}</tspan>` +
          `</text>`,
        );
      } else {
        const fill = i === 0 && keyLen > 0 ? c['--syn-key'] : (c[LEAF_COLOR[l.type]] || c['--text2']);
        parts.push(
          `<text x="${x + 12}" y="${rowY}" font-family="${FONT}" font-size="${LEAF_SIZE}" ` +
          `fill="${fill}">${esc(row)}</text>`,
        );
      }
      rowY += LEAF_H;
    }
  }

  return parts.join('\n');
}

// Non-fit nodes clip rather than wrap on screen; mirror that with an ellipsis so
// the export doesn't silently run text past the card edge.
function clip(text, width) {
  const max = Math.floor((width - PAD_X) / 6.6);
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text;
}

// → SVG source string. `nodes` should be the laid-out nodes currently on screen,
// so any manual dragging is preserved in the export.
export function buildSvg(nodes, edges, direction, colors = readThemeColors()) {
  if (!nodes.length) return null;

  const minX = Math.min(...nodes.map(n => n.position.x));
  const minY = Math.min(...nodes.map(n => n.position.y));
  const maxX = Math.max(...nodes.map(n => n.position.x + n.width));
  const maxY = Math.max(...nodes.map(n => n.position.y + n.height));
  const w = Math.ceil(maxX - minX + MARGIN * 2);
  const h = Math.ceil(maxY - minY + MARGIN * 2);

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edgeSvg = edges
    .map(e => {
      const a = byId[e.source], b = byId[e.target];
      if (!a || !b) return '';
      return `<path d="${edgePath(a, b, direction)}" fill="none" stroke="${colors['--border']}" stroke-width="1.4"/>`;
    })
    .filter(Boolean)
    .join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="${colors['--surface2']}"/>`,
    // One translate puts the graph's own coordinates into the margin box, so
    // node geometry can be emitted unmodified.
    `<g transform="translate(${MARGIN - minX} ${MARGIN - minY})">`,
    edgeSvg,
    nodes.map(n => nodeSvg(n, colors)).join('\n'),
    `</g>`,
    `</svg>`,
  ].join('\n');
}

export function downloadSvg(svg, filename = 'flowchart.svg') {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// PDF goes through the browser's own print pipeline rather than a PDF library.
// jsPDF plus an SVG bridge is ~350KB for a feature used occasionally, and the
// print dialog gives paper size, orientation and margins for free.
export function printSvg(svg, title = 'Flowchart') {
  const win = window.open('', '_blank');
  if (!win) return false;   // popup blocked — caller tells the user

  win.document.write(
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>@page{margin:12mm}html,body{margin:0;padding:0}` +
    `svg{width:100%;height:auto;display:block}</style>${svg}`,
  );
  win.document.close();
  win.focus();
  // Give the document a frame to lay out before the dialog blocks the thread,
  // otherwise some browsers print an empty page.
  setTimeout(() => win.print(), 250);
  return true;
}
