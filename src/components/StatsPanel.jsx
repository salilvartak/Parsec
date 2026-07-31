import React, { useMemo } from 'react';
import { computeStats, formatBytes } from '../lib/stats.js';
import { useIsMobile } from '../lib/useMedia.js';

export default function StatsPanel({ value, rawText }) {
  const isMobile = useIsMobile();
  const stats = useMemo(() => computeStats(value, rawText), [value, rawText]);
  const items = [
    ['Depth', stats.maxDepth],
    ['Keys', stats.keyCount],
    ['Nodes', stats.nodeCount],
    ['Size', formatBytes(stats.byteSize)],
  ];
  return (
    // Four columns squeeze to ~80px on a phone, so the tiles wrap to a 2×2 grid.
    <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
      {items.map(([label, val], i) => (
        <div key={label} style={{
          padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
          borderRight: isMobile ? (i % 2 === 0 ? '1px solid var(--border)' : 'none') : (i < items.length - 1 ? '1px solid var(--border)' : 'none'),
          borderTop: isMobile && i > 1 ? '1px solid var(--border)' : 'none',
        }}>
          <span style={{ font: "600 10px 'Inter',sans-serif", color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
          <span style={{ font: "500 13px 'JetBrains Mono',monospace", color: 'var(--text)' }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
