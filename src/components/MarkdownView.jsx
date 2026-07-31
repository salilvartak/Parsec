import React, { useMemo, useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useJsonStore } from '../store/useJsonStore.js';
import { cmExtensions } from '../lib/cmTheme.js';
import { markdownToHtml } from '../lib/markdown.js';
import { useIsMobile } from '../lib/useMedia.js';

export default function MarkdownView() {
  const isMobile = useIsMobile();
  const markdownText = useJsonStore(s => s.markdownText);
  const setMarkdownText = useJsonStore(s => s.setMarkdownText);
  const theme = useJsonStore(s => s.theme);

  // 'split' | 'edit' | 'preview' — preview-only is the read mode for a .md file
  const [viewPref, setView] = useState('split');
  // A phone has no room for two columns, so split collapses to preview there.
  const view = isMobile && viewPref === 'split' ? 'preview' : viewPref;
  const [copied, setCopied] = useState('');
  const fileRef = useRef(null);

  const html = useMemo(() => markdownToHtml(markdownText), [markdownText]);

  const flash = (m) => { setCopied(m); setTimeout(() => setCopied(''), 1400); };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setMarkdownText(String(reader.result)); setView('preview'); };
    reader.readAsText(file);
    e.target.value = '';
  };
  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setMarkdownText(String(reader.result)); setView('preview'); };
    reader.readAsText(file);
  };

  const copyHtml = async () => { try { await navigator.clipboard.writeText(html); flash('HTML copied'); } catch { flash('Copy failed'); } };
  const download = () => {
    const blob = new Blob([markdownText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'document.md'; a.click();
    URL.revokeObjectURL(url);
  };

  const mdBtn = isMobile ? { ...btn, height: 34, padding: '0 13px', borderRadius: 8, flex: 'none', whiteSpace: 'nowrap' } : btn;
  const showEditor = view === 'split' || view === 'edit';
  const showPreview = view === 'split' || view === 'preview';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      {/* toolbar */}
      <div className={isMobile ? 'hscroll' : undefined} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '8px 10px' : '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: 3, flex: 'none' }}>
          {(isMobile ? [['edit', 'Edit'], ['preview', 'Preview']] : [['edit', 'Edit'], ['split', 'Split'], ['preview', 'Preview']]).map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              border: 'none', background: view === id ? 'var(--accent-soft)' : 'transparent',
              color: view === id ? 'var(--accent)' : 'var(--text2)', font: "500 12px 'Inter',sans-serif",
              padding: isMobile ? '7px 14px' : '5px 12px', borderRadius: 5, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {copied && <span style={{ font: "500 11.5px 'Inter',sans-serif", color: 'var(--syn-string)', flex: 'none' }}>{copied}</span>}
        <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown" onChange={onFile} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} style={mdBtn}>Open{isMobile ? '' : ' .md'}</button>
        <button onClick={copyHtml} style={mdBtn}>{isMobile ? 'HTML' : 'Copy HTML'}</button>
        <button onClick={download} style={mdBtn}>{isMobile ? 'Save' : 'Download .md'}</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {showEditor && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: showPreview ? '1px solid var(--border)' : 'none' }}>
            <div style={paneHeader}>Markdown</div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <CodeMirror
                value={markdownText}
                onChange={setMarkdownText}
                height="100%"
                theme={theme === 'dark' ? 'dark' : 'light'}
                extensions={cmExtensions}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                style={{ height: '100%', fontSize: 13 }}
              />
            </div>
          </div>
        )}
        {showPreview && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {view === 'split' && <div style={paneHeader}>Preview</div>}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const btn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, height: 28, padding: '0 11px', font: "500 11.5px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer' };
const paneHeader = { flex: 'none', padding: '6px 14px', font: "600 11px 'Inter',sans-serif", color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' };
