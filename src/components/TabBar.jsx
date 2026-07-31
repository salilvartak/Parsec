import React, { useState, useRef, useEffect } from 'react';
import { useJsonStore } from '../store/useJsonStore.js';
import { useIsMobile } from '../lib/useMedia.js';

export default function TabBar() {
  const isMobile = useIsMobile();
  const documents = useJsonStore(s => s.documents);
  const activeDocId = useJsonStore(s => s.activeDocId);
  const switchTab = useJsonStore(s => s.switchTab);
  const closeTab = useJsonStore(s => s.closeTab);
  const addTab = useJsonStore(s => s.addTab);
  const renameTab = useJsonStore(s => s.renameTab);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (editingId) inputRef.current?.select(); }, [editingId]);

  const beginRename = (doc) => { setEditingId(doc.id); setDraft(doc.name); };
  const commit = () => {
    if (editingId) {
      const name = draft.trim();
      if (name) renameTab(editingId, name);
    }
    setEditingId(null);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className="hscroll" style={{ height: isMobile ? 42 : 36, flex: 'none', display: 'flex', alignItems: 'stretch', gap: 2, padding: '0 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
      {documents.map(doc => {
        const active = doc.id === activeDocId;
        const editing = doc.id === editingId;
        return (
          <div key={doc.id}
            onClick={() => !editing && switchTab(doc.id)}
            onDoubleClick={() => beginRename(doc)}
            title={editing ? undefined : 'Double-click to rename'}
            style={{
              display: 'flex', alignItems: 'center', gap: isMobile ? 9 : 6, padding: isMobile ? '0 10px 0 12px' : '0 8px 0 10px', cursor: editing ? 'text' : 'pointer', flex: 'none',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              color: active ? 'var(--text)' : 'var(--text2)', font: "500 12px 'Inter',sans-serif", whiteSpace: 'nowrap',
            }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                onClick={e => e.stopPropagation()}
                spellCheck={false}
                style={{
                  font: "500 12px 'Inter',sans-serif", color: 'var(--text)', background: 'var(--surface)',
                  border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 5px', outline: 'none',
                  width: Math.max(60, draft.length * 7 + 16),
                }}
              />
            ) : (
              <span onClick={active ? (e) => { e.stopPropagation(); beginRename(doc); } : undefined}>{doc.name}</span>
            )}
            {!editing && (
              <button onClick={e => { e.stopPropagation(); beginRename(doc); }} title="Rename tab"
                style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', padding: isMobile ? '6px 2px' : 0, display: 'flex', alignItems: 'center' }}>
                <svg width={isMobile ? 13 : 11} height={isMobile ? 13 : 11} viewBox="0 0 12 12"><path d="M8.5 1.5l2 2L4 10l-2.5.5L2 8 8.5 1.5z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>
              </button>
            )}
            {!editing && documents.length > 1 && (
              <button onClick={e => { e.stopPropagation(); closeTab(doc.id); }} title="Close tab" style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: isMobile ? 15 : 13, lineHeight: 1, padding: isMobile ? '6px 2px' : 0 }}>✕</button>
            )}
          </div>
        );
      })}
      <button onClick={addTab} title="New tab" style={{ border: 'none', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: isMobile ? 20 : 16, padding: '0 12px', flex: 'none' }}>+</button>
    </div>
  );
}
