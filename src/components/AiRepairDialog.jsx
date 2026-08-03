import React, { useEffect, useRef, useState } from 'react';
import Modal, { modalBtn, modalBtnPrimary } from './Modal.jsx';
import { useJsonStore } from '../store/useJsonStore.js';
import { repairDocument, AiError } from '../lib/ai.js';

// Repair flow. Runs on open, then shows what it wants to change and waits for
// the user to accept. Nothing is written to the document until Apply is clicked
// — a repair the user can't inspect first is just silent data loss.
export default function AiRepairDialog({ source, onClose }) {
  const replaceRawText = useJsonStore(s => s.replaceRawText);
  const setAiRemaining = useJsonStore(s => s.setAiRemaining);

  const [state, setState] = useState({ status: 'running' });
  const abortRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let live = true;

    repairDocument(source, { signal: controller.signal })
      .then(result => {
        if (!live) return;
        if (result.remaining !== undefined) setAiRemaining(result.remaining);
        setState({ status: 'done', result });
      })
      .catch(err => {
        if (!live || err.name === 'AbortError') return;
        if (err instanceof AiError && err.remaining !== undefined) setAiRemaining(err.remaining);
        setState({ status: 'error', error: err });
      });

    return () => { live = false; controller.abort(); };
  }, [source, setAiRemaining]);

  const close = () => { abortRef.current?.abort(); onClose(); };

  const apply = () => {
    replaceRawText(state.result.text);
    onClose();
  };

  const canApply = state.status === 'done' && state.result.text !== source;

  return (
    <Modal
      title="Repair JSON"
      subtitle={subtitleFor(state)}
      onClose={close}
      width={620}
      footer={
        <>
          <div style={{ flex: 1, font: "400 11px 'Inter',sans-serif", color: 'var(--text3)' }}>
            {state.status === 'done' && state.result.usedAi && 'Reviewed by AI — check the changes before applying.'}
            {state.status === 'done' && !state.result.usedAi && 'Fixed locally. No AI request used.'}
          </div>
          <button onClick={close} style={modalBtn}>Cancel</button>
          <button onClick={apply} disabled={!canApply}
            style={{ ...modalBtnPrimary, opacity: canApply ? 1 : .45, cursor: canApply ? 'pointer' : 'default' }}>
            Apply
          </button>
        </>
      }>

      {state.status === 'running' && (
        <div style={{ padding: '24px 0', textAlign: 'center', font: "400 12.5px 'Inter',sans-serif", color: 'var(--text3)' }}>
          Checking the document…
        </div>
      )}

      {state.status === 'error' && <ErrorBlock error={state.error} />}

      {state.status === 'done' && <Result result={state.result} unchanged={!canApply} />}
    </Modal>
  );
}

function subtitleFor(state) {
  if (state.status === 'running') return 'Trying a local fix first, then AI if needed.';
  if (state.status === 'error') return null;
  return state.result.usedAi
    ? 'The local pass could not fix this alone, so AI suggested the rest.'
    : 'Fixed without an AI request.';
}

function Result({ result, unchanged }) {
  if (unchanged) {
    return (
      <div style={{ font: "400 12.5px 'Inter',sans-serif", color: 'var(--text2)' }}>
        This document is already valid JSON — nothing to repair.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!result.confident && (
        <div style={{ padding: '9px 11px', borderRadius: 7, background: 'var(--danger-soft)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flex: 'none', color: 'var(--danger)', font: '12px sans-serif' }}>⚠</span>
          <span style={{ font: "400 11.5px 'Inter',sans-serif", color: 'var(--danger)' }}>
            The document was damaged enough that the intended structure had to be guessed. Check the result carefully.
          </span>
        </div>
      )}

      <Section label={`${result.fixes.length} change${result.fixes.length === 1 ? '' : 's'}`}>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {result.fixes.map((fix, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{
                flex: 'none', font: "500 10px 'JetBrains Mono',monospace", padding: '1px 5px', borderRadius: 3,
                background: fix.ai ? 'var(--accent-soft)' : 'var(--surface2)',
                color: fix.ai ? 'var(--accent)' : 'var(--text3)',
              }}>{fix.ai ? 'AI' : 'local'}</span>
              <span style={{ font: "400 12px 'Inter',sans-serif", color: 'var(--text2)' }}>
                {fix.message}
                {fix.line !== undefined && <span style={{ color: 'var(--text3)' }}> · line {fix.line}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Result">
        <pre style={{
          margin: 0, padding: 10, borderRadius: 7, background: 'var(--surface2)',
          border: '1px solid var(--border)', maxHeight: 240, overflow: 'auto',
          font: "400 11.5px 'JetBrains Mono',monospace", color: 'var(--text)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{result.text.slice(0, 4000)}{result.text.length > 4000 ? '\n…' : ''}</pre>
      </Section>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ font: "600 10.5px 'Inter',sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

export function ErrorBlock({ error }) {
  const quota = error.code === 'user_daily' || error.code === 'global_daily';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ font: "500 12.5px 'Inter',sans-serif", color: quota ? 'var(--text)' : 'var(--danger)' }}>
        {error.message}
      </div>
      {error.retryAfter > 0 && (
        <div style={{ font: "400 11.5px 'Inter',sans-serif", color: 'var(--text3)' }}>
          Try again in {formatWait(error.retryAfter)}.
        </div>
      )}
    </div>
  );
}

function formatWait(seconds) {
  if (seconds < 90) return `${Math.ceil(seconds)} seconds`;
  const mins = Math.round(seconds / 60);
  if (mins < 90) return `${mins} minute${mins === 1 ? '' : 's'}`;
  return `${Math.round(mins / 60)} hours`;
}
