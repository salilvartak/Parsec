import React, { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { useJsonStore } from '../store/useJsonStore.js';
import { parseJson } from '../lib/parse.js';
import { cmExtensions, lineDiffHighlighter } from '../lib/cmTheme.js';
import { diffJson } from '../lib/diff.js';
import { lineDiff } from '../lib/linediff.js';
import { useIsMobile } from '../lib/useMedia.js';

const MIN_EDITOR_H = 110;

const STATUS = {
  added: { color: 'var(--syn-string)', bg: 'var(--added-bg)', mark: '+', label: 'Added' },
  removed: { color: 'var(--danger)', bg: 'var(--removed-bg)', mark: '−', label: 'Removed' },
  changed: { color: 'var(--syn-key)', bg: 'var(--changed-bg)', mark: '~', label: 'Changed' },
  type: { color: 'var(--syn-bool)', bg: 'var(--accent-soft)', mark: '⇄', label: 'Type' },
  same: { color: 'var(--text3)', bg: 'transparent', mark: '', label: 'Same' },
};
const st = (s) => STATUS[s] || STATUS.same;

export default function DiffView() {
  const diffA = useJsonStore(s => s.diffA);
  const diffB = useJsonStore(s => s.diffB);
  const setDiffA = useJsonStore(s => s.setDiffA);
  const setDiffB = useJsonStore(s => s.setDiffB);
  const theme = useJsonStore(s => s.theme);
  const indent = useJsonStore(s => s.settings.indent);

  const isMobile = useIsMobile();
  const tBtn = isMobile ? { ...btn, height: 34, padding: '0 12px', borderRadius: 8 } : btn;

  // 'inline' paints the diff onto the A/B editors; 'tree' is the semantic view
  const [view, setView] = useState('inline');
  const [showInputs, setShowInputs] = useState(true);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [filters, setFilters] = useState({ added: true, removed: true, changed: true, type: true });
  const toggleFilter = (k) => setFilters(f => ({ ...f, [k]: !f[k] }));
  const [editorH, setEditorH] = useState(200);
  const [mobileDoc, setMobileDoc] = useState('a');

  const pa = parseJson(diffA);
  const pb = parseJson(diffB);
  const aBad = !pa.success && !pa.empty;
  const bBad = !pb.success && !pb.empty;
  const bothValid = pa.success && pb.success;

  const { root, stats, identical } = useMemo(() => {
    if (!bothValid) return { root: null, stats: null, identical: false };
    return diffJson(pa.value, pb.value);
  }, [diffA, diffB, bothValid]); // eslint-disable-line

  const total = stats ? stats.added + stats.removed + stats.changed + stats.type : 0;

  // textual line diff — paints the editors; works even while a side is invalid
  const lines = useMemo(() => lineDiff(diffA, diffB), [diffA, diffB]);
  const lc = lines.counts;

  const startDrag = (e) => {
    e.preventDefault();
    const startY = e.clientY, startH = editorH;
    const onMove = (ev) => setEditorH(Math.max(MIN_EDITOR_H, startH + ev.clientY - startY));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const step = indent === 'tab' ? '\t' : indent;
  const formatBoth = () => { if (pa.success) setDiffA(JSON.stringify(pa.value, null, step)); if (pb.success) setDiffB(JSON.stringify(pb.value, null, step)); };
  const swap = () => { const a = diffA; setDiffA(diffB); setDiffB(a); };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* top toolbar */}
      <div className={isMobile ? 'hscroll' : undefined} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '8px 10px' : '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: 3, flex: 'none' }}>
          {[['inline', 'Inline'], ['tree', 'Tree']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              border: 'none', background: view === id ? 'var(--accent-soft)' : 'transparent',
              color: view === id ? 'var(--accent)' : 'var(--text2)', font: "500 12px 'Inter',sans-serif",
              padding: isMobile ? '7px 13px' : '5px 12px', borderRadius: 5, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
        {view === 'tree' && !isMobile && <button onClick={() => setShowInputs(v => !v)} style={tBtn}>{showInputs ? 'Hide editors' : 'Show editors'}</button>}
        <button onClick={formatBoth} style={tBtn} disabled={!bothValid} title="Pretty-print both">{isMobile ? 'Format' : 'Format both'}</button>
        <button onClick={swap} style={tBtn} title="Swap A and B">Swap A ↔ B</button>
        <div style={{ flex: 1 }} />
        {view === 'inline'
          ? <span style={{ display: 'flex', gap: 8, font: "600 11.5px 'Inter',sans-serif", whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--syn-string)' }}>+{lc.added}</span>
              <span style={{ color: 'var(--danger)' }}>−{lc.removed}</span>
              <span style={{ color: 'var(--syn-key)' }}>~{lc.changed}</span>
              <span style={{ color: 'var(--text3)', fontWeight: 400 }}>lines</span>
            </span>
          : <span style={{ font: "500 12px 'Inter',sans-serif", color: identical ? 'var(--syn-string)' : 'var(--text2)', whiteSpace: 'nowrap' }}>
              {!bothValid ? '—' : identical ? '✓ identical' : `${total} difference${total === 1 ? '' : 's'}`}
            </span>}
      </div>

      {/* mobile A/B switch (shared by both views) */}
      {isMobile && (view === 'inline' || showInputs) && (
        <div style={{ flex: 'none', display: 'flex', gap: 4, padding: '6px 10px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {[['a', 'A · before', aBad], ['b', 'B · after', bBad]].map(([id, label, bad]) => (
            <button key={id} onClick={() => setMobileDoc(id)} style={{
              flex: 1, height: 30, borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${mobileDoc === id ? 'var(--accent)' : 'var(--border)'}`,
              background: mobileDoc === id ? 'var(--accent-soft)' : 'var(--surface)',
              color: bad ? 'var(--danger)' : (mobileDoc === id ? 'var(--accent)' : 'var(--text2)'),
              font: "500 11.5px 'Inter',sans-serif",
            }}>{label}{bad ? ' · invalid' : ''}</button>
          ))}
        </div>
      )}

      {view === 'inline' ? (
        /* INLINE — the diff is painted onto the editors; they fill the screen */
        <div style={{ flex: 1, display: 'flex', minHeight: 0, borderTop: isMobile ? 'none' : undefined }}>
          {isMobile ? (
            mobileDoc === 'a'
              ? <EditorPane label="A" sub="before" bad={aBad} err={pa.error} value={diffA} onChange={setDiffA} theme={theme} diffStatus={lines.aStatus} />
              : <EditorPane label="B" sub="after" bad={bBad} err={pb.error} value={diffB} onChange={setDiffB} theme={theme} diffStatus={lines.bStatus} />
          ) : (
            <>
              <EditorPane label="A" sub="before" bad={aBad} err={pa.error} value={diffA} onChange={setDiffA} theme={theme} diffStatus={lines.aStatus} border />
              <EditorPane label="B" sub="after" bad={bBad} err={pb.error} value={diffB} onChange={setDiffB} theme={theme} diffStatus={lines.bStatus} />
            </>
          )}
        </div>
      ) : (
        /* TREE — compact editors on top (still highlighted), semantic tree below */
        <>
          {showInputs && !isMobile && (
            <>
              <div style={{ display: 'flex', flex: 'none', height: editorH, borderBottom: '1px solid var(--border)' }}>
                <EditorPane label="A" sub="before" bad={aBad} err={pa.error} value={diffA} onChange={setDiffA} theme={theme} diffStatus={lines.aStatus} border />
                <EditorPane label="B" sub="after" bad={bBad} err={pb.error} value={diffB} onChange={setDiffB} theme={theme} diffStatus={lines.bStatus} />
              </div>
              <div onMouseDown={startDrag} title="Drag to resize" style={{ flex: 'none', height: 7, cursor: 'row-resize', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 34, height: 3, borderRadius: 2, background: 'var(--border)' }} />
              </div>
            </>
          )}
          {isMobile && showInputs && (
            <div style={{ flex: 'none', height: 'min(34dvh, 260px)', display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {mobileDoc === 'a'
                ? <EditorPane label="A" sub="before" bad={aBad} err={pa.error} value={diffA} onChange={setDiffA} theme={theme} diffStatus={lines.aStatus} />
                : <EditorPane label="B" sub="after" bad={bBad} err={pb.error} value={diffB} onChange={setDiffB} theme={theme} diffStatus={lines.bStatus} />}
            </div>
          )}

          {!bothValid ? (
            <Message>
              {aBad || bBad
                ? `${aBad ? 'Document A' : 'Document B'} isn’t valid JSON — line ${(aBad ? pa.error : pb.error)?.line}. The tree updates the moment it parses.`
                : 'Paste JSON into both editors. The diff runs live as you type — there’s no compare button.'}
            </Message>
          ) : identical ? (
            <Message>
              <span style={{ color: 'var(--syn-string)', fontWeight: 600, fontSize: 14 }}>The documents are identical.</span>
              <span style={{ display: 'block', marginTop: 6, color: 'var(--text3)' }}>Object key order and array position (for items with an id) are ignored.</span>
            </Message>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexWrap: 'wrap' }}>
                <span style={{ font: "600 11px 'Inter',sans-serif", color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Differences</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Pill s="added" n={stats.added} on={filters.added} onClick={() => toggleFilter('added')} tip="keys or elements only in B (the after)." />
                  <Pill s="removed" n={stats.removed} on={filters.removed} onClick={() => toggleFilter('removed')} tip="keys or elements only in A (the before)." />
                  <Pill s="changed" n={stats.changed} on={filters.changed} onClick={() => toggleFilter('changed')} tip="same key & type, different value." />
                  {stats.type > 0 && <Pill s="type" n={stats.type} on={filters.type} onClick={() => toggleFilter('type')} tip="value switched type (e.g. number → string)." />}
                </div>
                <div style={{ flex: 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: "500 11.5px 'Inter',sans-serif", color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
                  Only changes
                </label>
              </div>
              <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '6px 0' }}>
                <TreeDiff node={root} onlyChanges={onlyChanges} filters={filters} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- unified diff tree ----------

// Does this node (or a descendant) carry a change whose type is enabled?
function visible(node, onlyChanges, filters) {
  if (node.kind === 'leaf') {
    if (node.changed) return filters?.[node.status] ?? true;   // a real change → obey filter
    return !onlyChanges;                                        // unchanged leaf → only if showing all
  }
  // branch
  if (!node.changed) return !onlyChanges;
  return node.children.some(c => visible(c, onlyChanges, filters));
}

function TreeDiff({ node, onlyChanges, filters }) {
  if (!node) return null;
  const kids = node.kind === 'branch' ? node.children : [node];
  const shown = kids.filter(c => visible(c, onlyChanges, filters));
  if (shown.length === 0) {
    return <div style={{ padding: '18px 16px', color: 'var(--text3)', font: "400 12.5px 'Inter',sans-serif" }}>Nothing matches the current filters.</div>;
  }
  return (
    <div style={{ font: "400 12.5px/1.75 'JetBrains Mono',monospace" }}>
      {shown.map((c, i) => <TreeNode key={c.path + i} node={c} depth={0} onlyChanges={onlyChanges} filters={filters} />)}
    </div>
  );
}

function TreeNode({ node, depth, onlyChanges, filters }) {
  const [open, setOpen] = useState(true);
  if (!visible(node, onlyChanges, filters)) return null;

  const pad = 12 + depth * 15;
  const info = st(node.status);

  if (node.kind === 'branch') {
    const counts = countChildren(node);
    const kids = node.children.filter(c => visible(c, onlyChanges, filters));
    return (
      <div>
        <div onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 12px 1px 0', paddingLeft: pad, cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ width: 12, color: 'var(--text3)', fontSize: 10, flex: 'none' }}>{open ? '▾' : '▸'}</span>
          <span style={{ color: 'var(--syn-key)' }}>{node.label}</span>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>{node.container === 'array' ? `[${node.children.length}]` : `{${node.children.length}}`}</span>
          {node.keyField && <span style={{ color: 'var(--text3)', fontSize: 10 }}>· by {node.keyField}</span>}
          {node.changed && <ChangeBadges counts={counts} />}
        </div>
        {open && kids.map((c, i) => <TreeNode key={c.path + i} node={c} depth={depth + 1} onlyChanges={onlyChanges} filters={filters} />)}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '1px 12px 1px 0', paddingLeft: pad, background: info.bg }}>
      <span style={{ width: 12, flex: 'none', textAlign: 'center', color: info.color, fontWeight: 700 }}>{info.mark}</span>
      <span style={{ color: node.status === 'same' ? 'var(--text3)' : 'var(--syn-key)', flex: 'none' }}>{node.label}:</span>
      <LeafValue node={node} info={info} />
    </div>
  );
}

function valueText(v) { const s = JSON.stringify(v); return s === undefined ? 'undefined' : s; }

function LeafValue({ node, info }) {
  const wrap = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
  if (node.status === 'added' || node.status === 'removed') return <span style={{ color: info.color, ...wrap }}>{valueText(node.value)}</span>;
  if (node.status === 'same') return <span style={{ color: 'var(--text2)', ...wrap }}>{valueText(node.aValue)}</span>;
  return (
    <span style={wrap}>
      <span style={{ color: 'var(--danger)', textDecoration: 'line-through', opacity: .75 }}>{valueText(node.aValue)}</span>
      {node.status === 'type' && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({node.aType})</span>}
      <span style={{ color: 'var(--text3)' }}> → </span>
      <span style={{ color: 'var(--syn-string)' }}>{valueText(node.bValue)}</span>
      {node.status === 'type' && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({node.bType})</span>}
    </span>
  );
}

function countChildren(node) {
  const c = { added: 0, removed: 0, changed: 0, type: 0 };
  const walk = (n) => { if (n.kind === 'leaf') { if (n.status in c) c[n.status]++; return; } n.children.forEach(walk); };
  if (node.children) node.children.forEach(walk);
  return c;
}

function ChangeBadges({ counts }) {
  const items = [['added', '+'], ['removed', '−'], ['changed', '~'], ['type', '⇄']];
  return (
    <span style={{ display: 'flex', gap: 5, marginLeft: 2 }}>
      {items.map(([k, m]) => counts[k] > 0 && (
        <span key={k} style={{ font: "600 9.5px 'Inter',sans-serif", color: st(k).color, background: st(k).bg, padding: '1px 5px', borderRadius: 4 }}>{m}{counts[k]}</span>
      ))}
    </span>
  );
}

function EditorPane({ label, sub, bad, err, value, onChange, theme, border, diffStatus }) {
  // Rebuild the highlighter whenever the line-status map changes. A signature
  // string keeps it stable across renders that don't actually change the diff.
  const sig = diffStatus ? [...diffStatus.entries()].map(([k, v]) => `${k}${v}`).join(',') : '';
  const exts = useMemo(
    () => (diffStatus ? [json(), ...cmExtensions, lineDiffHighlighter(diffStatus)] : [json(), ...cmExtensions]),
    [sig], // eslint-disable-line
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: border ? '1px solid var(--border)' : 'none' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', font: "600 11px 'Inter',sans-serif", color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{sub}</span>
        <div style={{ flex: 1 }} />
        {bad
          ? <span style={{ color: 'var(--danger)', font: "500 10.5px 'JetBrains Mono',monospace" }}>invalid · line {err?.line}</span>
          : <span style={{ color: 'var(--syn-string)', font: "500 10.5px 'JetBrains Mono',monospace" }}>valid</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CodeMirror value={value} onChange={onChange} height="100%" theme={theme === 'dark' ? 'dark' : 'light'}
          extensions={exts} basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, bracketMatching: true }} style={{ height: '100%', fontSize: 12 }} />
      </div>
    </div>
  );
}

const PILL_MARK = { added: '+', removed: '−', changed: '~', type: '⇄' };
function Pill({ s, n, on, onClick, tip }) {
  const info = st(s);
  return (
    <button onClick={onClick} title={`${info.label} — ${tip}\n\nClick to ${on ? 'hide' : 'show'}.`}
      style={{
        font: "600 11px 'Inter',sans-serif", cursor: 'pointer',
        color: on ? info.color : 'var(--text3)',
        background: on ? info.bg : 'transparent',
        border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
        padding: '2px 9px', borderRadius: 5, opacity: on ? 1 : 0.55,
        textDecoration: on ? 'none' : 'line-through',
      }}>
      {PILL_MARK[s]}{n}
    </button>
  );
}

function Message({ children }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40, color: 'var(--text2)', font: "400 13px 'Inter',sans-serif", lineHeight: 1.6 }}>
      <div style={{ maxWidth: 460 }}>{children}</div>
    </div>
  );
}

const btn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, height: 28, padding: '0 10px', font: "500 11.5px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer' };
