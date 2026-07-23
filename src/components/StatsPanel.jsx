import React, { useMemo } from 'react';
import { computeStats, formatBytes } from '../lib/stats.js';

export default function StatsPanel({ value, rawText }) {
  const stats = useMemo(() => computeStats(value, rawText), [value, rawText]);
  const items = [
    ['Depth', stats.maxDepth],
    ['Keys', stats.keyCount],
    ['Nodes', stats.nodeCount],
    ['Size', formatBytes(stats.byteSize)],
  ];
  return (
    <div style={{ flex: 'none', display: 'flex', gap: 0, borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
      {items.map(([label, val], i) => (
        <div key={label} style={{ flex: 1, padding: '8px 12px', borderRight: i < items.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ font: "600 10px 'Inter',sans-serif", color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
          <span style={{ font: "500 13px 'JetBrains Mono',monospace", color: 'var(--text)' }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
