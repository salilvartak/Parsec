import React, { useRef, useState } from 'react';
import Modal, { modalBtn, modalBtnPrimary } from './Modal.jsx';
import { useJsonStore } from '../store/useJsonStore.js';
import { generateMockData, AiError } from '../lib/ai.js';
import { ErrorBlock } from './AiRepairDialog.jsx';

// Generate sample data shaped like the current document (or a JSON Schema).
// Unlike repair, this doesn't run on open — generation always costs a request,
// so it waits for an explicit click and for any hint the user wants to add.
export default function AiMockDialog({ source, indent, onClose }) {
  const addTab = useJsonStore(s => s.addTab);
  const replaceRawText = useJsonStore(s => s.replaceRawText);
  const renameTab = useJsonStore(s => s.renameTab);
  const setAiRemaining = useJsonStore(s => s.setAiRemaining);
  const aiRemaining = useJsonStore(s => s.aiRemaining);

  const [hint, setHint] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const abortRef = useRef(null);

  const run = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'running' });
    try {
      const { data, remaining } = await generateMockData(source, { hint: hint.trim() || undefined, signal: controller.signal });
      if (remaining !== undefined) setAiRemaining(remaining);
      setState({ status: 'done', text: JSON.stringify(data, null, indent) });
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err instanceof AiError && err.remaining !== undefined) setAiRemaining(err.remaining);
      setState({ status: 'error', error: err });
    }
  };

  const close = () => { abortRef.current?.abort(); onClose(); };

  // New tab by default: overwriting the document the shape came from is almost
  // never what someone wants, and it's unrecoverable.
  const openInNewTab = () => {
    addTab();
    const id = useJsonStore.getState().activeDocId;
    replaceRawText(state.text);
    renameTab(id, 'mock-data.json');
    onClose();
  };

  const busy = state.status === 'running';

  return (
    <Modal
      title="Generate mock data"
      subtitle="Creates sample records matching the structure of the current document."
      onClose={close}
      width={620}
      footer={
        <>
          <div style={{ flex: 1, font: "400 11px 'Inter',sans-serif", color: 'var(--text3)' }}>
            {aiRemaining !== null && `${aiRemaining} AI request${aiRemaining === 1 ? '' : 's'} left today`}
          </div>
          <button onClick={close} style={modalBtn}>Cancel</button>
          {state.status === 'done'
            ? <button onClick={openInNewTab} style={modalBtnPrimary}>Open in new tab</button>
            : <button onClick={run} disabled={busy} style={{ ...modalBtnPrimary, opacity: busy ? .45 : 1, cursor: busy ? 'default' : 'pointer' }}>
                {busy ? 'Generating…' : 'Generate'}
              </button>}
        </>
      }>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="mock-hint" style={{ display: 'block', font: "600 10.5px 'Inter',sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 7 }}>
            What do you want? <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="mock-hint"
            value={hint}
            onChange={e => setHint(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy && state.status !== 'done') run(); }}
            disabled={busy}
            placeholder="e.g. 20 records, all European addresses, dates in 2025"
            style={{
              width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--surface2)', color: 'var(--text)', padding: '8px 10px', outline: 'none',
              font: "400 12px 'Inter',sans-serif",
            }} />
        </div>

        {state.status === 'error' && <ErrorBlock error={state.error} />}

        {state.status === 'done' && (
          <div>
            <div style={{ font: "600 10.5px 'Inter',sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 7 }}>Preview</div>
            <pre style={{
              margin: 0, padding: 10, borderRadius: 7, background: 'var(--surface2)',
              border: '1px solid var(--border)', maxHeight: 300, overflow: 'auto',
              font: "400 11.5px 'JetBrains Mono',monospace", color: 'var(--text)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{state.text.slice(0, 6000)}{state.text.length > 6000 ? '\n…' : ''}</pre>
          </div>
        )}
      </div>
    </Modal>
  );
}
