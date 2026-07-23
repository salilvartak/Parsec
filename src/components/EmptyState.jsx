import React, { useRef, useState } from 'react';
import { useJsonStore } from '../store/useJsonStore.js';

export default function EmptyState() {
  const loadFromText = useJsonStore(s => s.loadFromText);
  const loadSample = useJsonStore(s => s.loadSample);
  const fileRef = useRef(null);
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [err, setErr] = useState('');

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFromText(String(reader.result), file.name);
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFromText(String(reader.result), file.name);
    reader.readAsText(file);
  };

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setFetching(true); setErr('');
    try {
      const res = await fetch(url);
      const text = await res.text();
      loadFromText(text, url.split('/').pop() || 'fetched.json');
    } catch (e) {
      setErr('Fetch failed: ' + e.message);
    } finally { setFetching(false); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div style={{ width: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}>
        <img src="/logo.png" alt="Parsec" width="52" height="52" style={{ borderRadius: 10, display: 'block' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No document loaded</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>Paste a JSON payload, drop a file, or fetch one from a URL to start inspecting it.</div>
        </div>
        <textarea placeholder="Paste JSON here…" onChange={e => { if (e.target.value.trim()) loadFromText(e.target.value, 'pasted.json'); }}
          style={{ width: '100%', height: 120, resize: 'none', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, padding: 12 }} />
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <input ref={fileRef} type="file" accept=".json,.txt,application/json" onChange={onFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ flex: 1, height: 36, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: "500 12.5px 'Inter',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5v7.6M3.2 6l3.3 3.3L9.8 6M2 11.3h9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Upload file
          </button>
          <div style={{ flex: 1.4, display: 'flex', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', overflow: 'hidden' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" style={{ flex: 'none', margin: '0 0 0 10px', alignSelf: 'center' }}><path d="M5.2 7.8a2.4 2.4 0 003.4 0l1.6-1.6a2.4 2.4 0 10-3.4-3.4L5.9 3.7M7.8 5.2a2.4 2.4 0 00-3.4 0L2.8 6.8a2.4 2.4 0 103.4 3.4l.9-.9" fill="none" stroke="var(--text3)" strokeWidth="1.3" strokeLinecap="round" /></svg>
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUrl()} placeholder="https://api.example.com/data" style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', font: "400 12px 'Inter',sans-serif", padding: '0 8px', outline: 'none' }} />
            <button onClick={fetchUrl} disabled={fetching} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', font: "500 12px 'Inter',sans-serif", padding: '0 12px', cursor: 'pointer' }}>{fetching ? '…' : 'Fetch'}</button>
          </div>
        </div>
        {err && <span style={{ font: "400 12px 'JetBrains Mono',monospace", color: 'var(--danger)' }}>{err}</span>}
        <button onClick={loadSample} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', font: "500 12px 'Inter',sans-serif", cursor: 'pointer' }}>Or load sample document</button>
      </div>
    </div>
  );
}
