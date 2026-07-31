import React from 'react';
import { useJsonStore } from '../store/useJsonStore.js';

export default function HistoryPanel() {
  const history = useJsonStore(s => s.history);
  const loadHistoryEntry = useJsonStore(s => s.loadHistoryEntry);
  const removeHistoryEntry = useJsonStore(s => s.removeHistoryEntry);
  const clearHistory = useJsonStore(s => s.clearHistory);
  const closePanel = useJsonStore(s => s.closePanel);
  const historyEnabled = useJsonStore(s => s.settings.historyEnabled);
  const openPanel = useJsonStore(s => s.openPanel);

  return (
    <div>
      <div style={row}>
        <span style={{ font: "600 11px 'Inter',sans-serif", color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Recent documents{history.length ? ` · ${history.length}` : ''}
        </span>
        {history.length > 0 && <button onClick={clearHistory} style={linkBtn}>Clear all</button>}
      </div>

      {!historyEnabled && (
        <div style={{ ...note, borderBottom: '1px solid var(--border)' }}>
          History capture is off — new edits are not recorded.{' '}
          <button onClick={() => openPanel('settings')} style={{ ...linkBtn, fontSize: 12 }}>Turn on</button>
        </div>
      )}

      {history.length === 0 && (
        <div style={note}>No history yet. Valid documents are captured automatically as you type.</div>
      )}

      {history.map(h => (
        <div key={h.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => { loadHistoryEntry(h.id); closePanel(); }}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', padding: '11px 6px 11px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ font: "500 12.5px 'Inter',sans-serif", color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              <span style={{ font: "400 10.5px 'Inter',sans-serif", color: 'var(--text3)', flex: 'none' }}>{timeAgo(h.ts)}</span>
            </span>
            <span style={{ font: "400 11px 'JetBrains Mono',monospace", color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.preview}</span>
          </button>
          <button onClick={() => removeHistoryEntry(h.id)} title="Remove from history"
            style={{ flex: 'none', width: 38, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)' }}>
            <svg width="12" height="12" viewBox="0 0 13 13"><path d="M2.5 2.5l8 8M10.5 2.5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// Coarse relative time — the exact second never matters in this list.
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' };
const note = { padding: '16px', color: 'var(--text3)', font: "400 12.5px/1.5 'Inter',sans-serif" };
const linkBtn = { border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', font: "500 11.5px 'Inter',sans-serif", padding: 0 };
