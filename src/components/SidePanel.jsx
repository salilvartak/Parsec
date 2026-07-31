import React, { useEffect, useRef } from 'react';
import { useJsonStore } from '../store/useJsonStore.js';
import HistoryPanel from './HistoryPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';

const TITLES = { history: 'History', settings: 'Settings' };

// Right-hand drawer shared by History and Settings. Mounted once at the app
// root so it overlays every pane, and unmounted entirely while closed.
export default function SidePanel() {
  const sidePanel = useJsonStore(s => s.sidePanel);
  const closePanel = useJsonStore(s => s.closePanel);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!sidePanel) return;
    const onKey = (e) => { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidePanel, closePanel]);

  // Move focus into the drawer so Tab lands inside it. Focus is deliberately NOT
  // handed back to the opener on close: Chrome paints a :focus-visible ring on
  // programmatic focus, which reads as a stuck "selected" toolbar button.
  useEffect(() => { if (sidePanel) panelRef.current?.focus(); }, [sidePanel]);

  if (!sidePanel) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div className="drawer-scrim" onClick={closePanel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.38)' }} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={TITLES[sidePanel]}
        className="drawer"
        style={{
          position: 'relative', width: 'min(384px, 100vw)', height: '100%',
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          boxShadow: '-14px 0 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column',
          outline: 'none',
        }}
      >
        <header style={{
          flex: 'none', height: 52, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 10px 0 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        }}>
          <span style={{ font: "600 13.5px 'Inter',sans-serif", letterSpacing: '-.01em' }}>{TITLES[sidePanel]}</span>
          <div style={{ flex: 1 }} />
          <button onClick={closePanel} title="Close (Esc)" style={{
            width: 32, height: 32, border: '1px solid var(--border)', background: 'var(--surface)',
            borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M2.5 2.5l8 8M10.5 2.5l-8 8" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {sidePanel === 'history' ? <HistoryPanel /> : <SettingsPanel />}
        </div>
      </aside>
    </div>
  );
}
