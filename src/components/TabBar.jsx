import React from 'react';
import { useJsonStore } from '../store/useJsonStore.js';

export default function TabBar() {
  const documents = useJsonStore(s => s.documents);
  const activeDocId = useJsonStore(s => s.activeDocId);
  const switchTab = useJsonStore(s => s.switchTab);
  const closeTab = useJsonStore(s => s.closeTab);
  const addTab = useJsonStore(s => s.addTab);

  return (
    <div style={{ height: 36, flex: 'none', display: 'flex', alignItems: 'stretch', gap: 2, padding: '0 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', overflowX: 'auto' }}>
      {documents.map(doc => {
        const active = doc.id === activeDocId;
        return (
          <div key={doc.id} onClick={() => switchTab(doc.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', cursor: 'pointer',
            borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
            color: active ? 'var(--text)' : 'var(--text2)', font: "500 12px 'Inter',sans-serif", whiteSpace: 'nowrap',
          }}>
            <span>{doc.name}</span>
            {documents.length > 1 && (
              <button onClick={e => { e.stopPropagation(); closeTab(doc.id); }} title="Close tab" style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
            )}
          </div>
        );
      })}
      <button onClick={addTab} title="New tab" style={{ border: 'none', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, padding: '0 10px' }}>+</button>
    </div>
  );
}
