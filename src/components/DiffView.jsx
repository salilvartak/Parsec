import React, { useMemo, useState } from 'react';
import { useJsonStore } from '../store/useJsonStore.js';
import { parseJson } from '../lib/parse.js';
import { diffJson } from '../lib/diff.js';

const bgFor = (s) => s === 'added' ? 'var(--added-bg)' : s === 'removed' ? 'var(--removed-bg)' : s === 'changed' ? 'var(--changed-bg)' : 'transparent';
const markFor = (s) => s === 'added' ? '+' : s === 'changed' ? '~' : s === 'removed' ? '−' : '';
const markColorFor = (s) => s === 'added' ? 'var(--syn-string)' : s === 'changed' ? 'var(--syn-key)' : s === 'removed' ? 'var(--danger)' : 'var(--text3)';

export default function DiffView() {
  const diffA = useJsonStore(s => s.diffA);
  const diffB = useJsonStore(s => s.diffB);
  const setDiffA = useJsonStore(s => s.setDiffA);
  const setDiffB = useJsonStore(s => s.setDiffB);
  const [showInputs, setShowInputs] = useState(false);

  const pa = parseJson(diffA);
  const pb = parseJson(diffB);
  const bothValid = pa.success && pb.success;

  const { left, right, counts } = useMemo(() => {
    if (!bothValid) return { left: [], right: [], counts: null };
    const d = diffJson(pa.value, pb.value);
    let added = 0, removed = 0, changed = 0;
    d.right.forEach(l => { if (l.status === 'added') added++; if (l.status === 'changed') changed++; });
    d.left.forEach(l => { if (l.status === 'removed') removed++; });
    return { ...d, counts: { added, removed, changed } };
  }, [diffA, diffB, bothValid]); // eslint-disable-line

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10, borderBottom: '1px solid var(--border)', background: 'var(--surface)', font: "500 12px 'JetBrains Mono',monospace", color: 'var(--text2)', position: 'relative' }}>
        <span>document A</span><span style={{ color: 'var(--text3)' }}>→</span><span>document B</span>
        {counts && (
          <span style={{ marginLeft: 12, display: 'flex', gap: 10, font: "500 11px 'Inter',sans-serif" }}>
            <span style={{ color: 'var(--syn-string)' }}>+{counts.added}</span>
            <span style={{ color: 'var(--syn-key)' }}>~{counts.changed}</span>
            <span style={{ color: 'var(--danger)' }}>−{counts.removed}</span>
          </span>
        )}
        <button onClick={() => setShowInputs(v => !v)} style={{ position: 'absolute', right: 12, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '4px 10px', font: "500 11px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer' }}>{showInputs ? 'Hide inputs' : 'Edit inputs'}</button>
      </div>

      {showInputs && (
        <div style={{ display: 'flex', flex: 'none', height: 180, borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
            <div style={diffInHeader}>Document A {!pa.success && !pa.empty && <span style={{ color: 'var(--danger)' }}>— invalid</span>}</div>
            <textarea value={diffA} onChange={e => setDiffA(e.target.value)} spellCheck={false} style={diffTa} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={diffInHeader}>Document B {!pb.success && !pb.empty && <span style={{ color: 'var(--danger)' }}>— invalid</span>}</div>
            <textarea value={diffB} onChange={e => setDiffB(e.target.value)} spellCheck={false} style={diffTa} />
          </div>
        </div>
      )}

      {!bothValid ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', font: "400 13px 'Inter',sans-serif" }}>
          {(!pa.success && !pa.empty) || (!pb.success && !pb.empty) ? 'Both documents must be valid JSON to diff.' : 'Enter two JSON documents to compare.'}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
          <Pane lines={left} />
          <div style={{ width: 1, background: 'var(--border)' }} />
          <Pane lines={right} />
        </div>
      )}
    </div>
  );
}

function Pane({ lines }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {lines.map((ln, i) => (
        <div key={i} style={{ display: 'flex', padding: '1px 0', background: bgFor(ln.status) }}>
          <div style={{ width: 26, flex: 'none', textAlign: 'center', font: "500 12px 'JetBrains Mono',monospace", color: markColorFor(ln.status) }}>{markFor(ln.status)}</div>
          <div style={{ flex: 1, font: "400 12.5px/1.65 'JetBrains Mono',monospace", color: 'var(--text)', whiteSpace: 'pre', paddingRight: 12 }}>{ln.text}</div>
        </div>
      ))}
    </div>
  );
}

const diffInHeader = { padding: '7px 12px', font: "500 11px 'Inter',sans-serif", color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' };
const diffTa = { flex: 1, border: 'none', resize: 'none', background: 'var(--surface)', color: 'var(--text)', font: "400 12px 'JetBrains Mono',monospace", padding: 12, outline: 'none', whiteSpace: 'pre' };
