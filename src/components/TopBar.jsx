import React, { useState, useRef, useEffect } from 'react';
import { useJsonStore, useRawText } from '../store/useJsonStore.js';
import { buildShareUrl } from '../lib/share.js';
import { toggleThemeAnimated } from '../lib/themeTransition.js';
import { useIsMobile } from '../lib/useMedia.js';

const iconBtn = {
  width: 32, height: 32, border: '1px solid var(--border)', background: 'var(--surface)',
  borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
// Phones get a 38px square so the target clears the finger-size guidance.
const iconBtnTouch = { ...iconBtn, width: 38, height: 38, borderRadius: 9 };

export default function TopBar() {
  const mode = useJsonStore(s => s.mode);
  const theme = useJsonStore(s => s.theme);
  const indent = useJsonStore(s => s.indent);
  const setMode = useJsonStore(s => s.setMode);
  const toggleTheme = useJsonStore(s => s.toggleTheme);
  const themeIsExplicit = useJsonStore(s => s.themeIsExplicit);
  const setTheme = useJsonStore(s => s.setTheme);
  const matchSystemTheme = useJsonStore(s => s.useSystemTheme);
  const setIndent = useJsonStore(s => s.setIndent);
  const addTab = useJsonStore(s => s.addTab);
  const history = useJsonStore(s => s.history);
  const loadHistoryEntry = useJsonStore(s => s.loadHistoryEntry);
  const clearHistory = useJsonStore(s => s.clearHistory);
  const activeDoc = useJsonStore(s => s.documents.find(d => d.id === s.activeDocId));
  const rawText = useRawText();

  const isMobile = useIsMobile();
  const btn = isMobile ? iconBtnTouch : iconBtn;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState('');

  const tabDefs = [['editor', 'Editor'], ['converters', 'Converters'], ['flowchart', 'Flowchart'], ['diff', 'Diff'], ['markdown', 'Markdown']];

  const flash = (msg) => { setCopied(msg); setTimeout(() => setCopied(''), 1600); };

  const doCopy = async (text) => { try { await navigator.clipboard.writeText(text); flash('Copied'); } catch { flash('Copy failed'); } };
  const download = () => {
    const blob = new Blob([rawText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = activeDoc?.name || 'document.json'; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };
  const shareLink = async () => {
    const url = buildShareUrl(rawText);
    await doCopy(url);
    setExportOpen(false);
  };

  const modeSwitch = (
    <div className={isMobile ? 'hscroll' : undefined}
      style={isMobile
        ? { flex: 'none', display: 'flex', gap: 4, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }
        : { display: 'flex', gap: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
      {tabDefs.map(([id, label]) => (
        <button key={id} onClick={() => setMode(id)} style={{
          border: isMobile ? '1px solid var(--border)' : 'none',
          background: mode === id ? 'var(--accent-soft)' : (isMobile ? 'var(--surface2)' : 'transparent'),
          borderColor: isMobile && mode === id ? 'var(--accent)' : 'var(--border)',
          color: mode === id ? 'var(--accent)' : 'var(--text2)', font: "500 12.5px 'Inter',sans-serif",
          padding: isMobile ? '8px 14px' : '6px 13px', borderRadius: isMobile ? 8 : 6, cursor: 'pointer',
          flex: 'none', whiteSpace: 'nowrap',
        }}>{label}</button>
      ))}
    </div>
  );

  return (
    <>
    <div style={{ height: isMobile ? 56 : 52, flex: 'none', display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 20, padding: isMobile ? '0 10px' : '0 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        <img src="/logo.png" alt="" width="26" height="26" style={{ borderRadius: 6, display: 'block', flex: 'none' }} />
        {!isMobile && <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.01em' }}>Parsec</span>}
      </div>

      {/* On a phone the mode pills move to their own swipeable row below. */}
      {!isMobile && modeSwitch}

      <div style={{ flex: 1 }} />

      {copied && <span style={{ font: "500 12px 'Inter',sans-serif", color: 'var(--syn-string)' }}>{copied}</span>}

      {/* History */}
      <div style={{ position: 'relative' }}>
        <button title="History" onClick={() => { setHistoryOpen(o => !o); setExportOpen(false); setSettingsOpen(false); }} style={btn}>
          <svg width="15" height="15" viewBox="0 0 15 15"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="var(--text2)" strokeWidth="1.4" /><path d="M7.5 4.3v3.5l2.3 1.4" stroke="var(--text2)" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
        </button>
        {historyOpen && (
          <Dropdown onClose={() => setHistoryOpen(false)} width={320}>
            <div style={dropHeader}>
              <span>Recent documents</span>
              {history.length > 0 && <button onClick={clearHistory} style={linkBtn}>Clear</button>}
            </div>
            {history.length === 0 && <div style={{ padding: '14px 12px', color: 'var(--text3)', font: "400 12px 'Inter',sans-serif" }}>No history yet.</div>}
            {history.map(h => (
              <button key={h.id} onClick={() => { loadHistoryEntry(h.id); setHistoryOpen(false); }} style={dropItem}>
                <div style={{ font: "500 12px 'Inter',sans-serif", color: 'var(--text)' }}>{h.name}</div>
                <div style={{ font: "400 11px 'JetBrains Mono',monospace", color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.preview}</div>
              </button>
            ))}
          </Dropdown>
        )}
      </div>

      <button onClick={addTab} title="New document (new tab)" style={btn}>
        <svg width="15" height="15" viewBox="0 0 15 15"><path d="M7.5 2v11M2 7.5h11" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>

      <button onClick={(e) => toggleThemeAnimated(toggleTheme, { x: e.clientX, y: e.clientY })} title={themeIsExplicit ? `Theme: ${theme} (pinned)` : `Theme: ${theme} (following system)`} style={btn}>
        {theme === 'light'
          ? <svg width="15" height="15" viewBox="0 0 15 15"><circle cx="7.5" cy="7.5" r="3" fill="none" stroke="var(--text2)" strokeWidth="1.5" /><path d="M7.5 1v1.6M7.5 12.4V14M1 7.5h1.6M12.4 7.5H14M3 3l1.2 1.2M10.8 10.8L12 12M12 3l-1.2 1.2M4.2 10.8L3 12" stroke="var(--text2)" strokeWidth="1.4" strokeLinecap="round" /></svg>
          : <svg width="15" height="15" viewBox="0 0 15 15"><path d="M12.8 9.3A5.6 5.6 0 016 2.3a5.7 5.7 0 106.8 7z" fill="var(--text2)" /></svg>}
      </button>

      {/* Settings */}
      <div style={{ position: 'relative' }}>
        <button title="Settings" onClick={() => { setSettingsOpen(o => !o); setExportOpen(false); setHistoryOpen(false); }} style={btn}>
          {/* toothed cog — deliberately not the ray-and-circle shape used by the theme toggle */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        {settingsOpen && (
          <Dropdown onClose={() => setSettingsOpen(false)} width={220}>
            <div style={dropHeader}><span>Indentation</span></div>
            {[[2, '2 spaces'], [4, '4 spaces'], ['tab', 'Tabs']].map(([v, label]) => (
              <button key={String(v)} onClick={() => setIndent(v)} style={{ ...dropItem, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: "500 12px 'Inter',sans-serif", color: 'var(--text)' }}>{label}</span>
                {indent === v && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>
            ))}
            <div style={dropHeader}><span>Appearance</span></div>
            {[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, label]) => {
              const active = v === 'system' ? !themeIsExplicit : (themeIsExplicit && theme === v);
              return (
                <button key={v} onClick={(e) => toggleThemeAnimated(() => (v === 'system' ? matchSystemTheme() : setTheme(v)), { x: e.clientX, y: e.clientY })} style={{ ...dropItem, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ font: "500 12px 'Inter',sans-serif", color: 'var(--text)' }}>{label}</span>
                  {active && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </button>
              );
            })}
          </Dropdown>
        )}
      </div>

      {/* Export */}
      <div style={{ position: 'relative' }}>
        <button title="Export" onClick={() => { setExportOpen(o => !o); setSettingsOpen(false); setHistoryOpen(false); }}
          style={isMobile
            ? btn
            : { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 7, padding: '0 12px', height: 32, cursor: 'pointer', font: "500 12.5px 'Inter',sans-serif", color: 'var(--text)' }}>
          <svg width={isMobile ? 15 : 13} height={isMobile ? 15 : 13} viewBox="0 0 13 13"><path d="M6.5 1.5v7M4 4l2.5-2.5L9 4M2.5 8.5v2.3a1 1 0 001 1h6a1 1 0 001-1V8.5" fill="none" stroke={isMobile ? 'var(--text2)' : 'currentColor'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {!isMobile && 'Export'}
        </button>
        {exportOpen && (
          <Dropdown onClose={() => setExportOpen(false)} width={200}>
            <button onClick={download} style={dropItemRow}>Download .json</button>
            <button onClick={() => { doCopy(rawText); setExportOpen(false); }} style={dropItemRow}>Copy JSON</button>
            <button onClick={shareLink} style={dropItemRow}>Copy share link</button>
          </Dropdown>
        )}
      </div>
    </div>
    {isMobile && modeSwitch}
    </>
  );
}

function Dropdown({ children, onClose, width }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    // touchstart too: on iOS a tap outside fires no mousedown until it also
    // lands on a focusable element, so the sheet could stay stuck open.
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [onClose]);
  return (
    // width is clamped to the viewport so a 320px menu never overflows a phone.
    <div ref={ref} style={{ position: 'absolute', top: 40, right: 0, width: `min(${width}px, calc(100vw - 20px))`, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', maxHeight: 'min(400px, 60dvh)', overflowY: 'auto' }}>
      {children}
    </div>
  );
}

const dropHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: '1px solid var(--border)', font: "600 11px 'Inter',sans-serif", color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.03em' };
const dropItem = { display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '9px 12px', cursor: 'pointer' };
const dropItemRow = { display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '10px 12px', cursor: 'pointer', font: "500 12px 'Inter',sans-serif", color: 'var(--text)' };
const linkBtn = { border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', font: "500 11px 'Inter',sans-serif" };
