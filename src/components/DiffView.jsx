import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { useJsonStore } from '../store/useJsonStore.js';
import { parseJson } from '../lib/parse.js';
import { cmExtensions } from '../lib/cmTheme.js';
import { diffJson, flatten, changeRows, changeGroups, collapseUnchanged } from '../lib/diff.js';
import { useIsMobile } from '../lib/useMedia.js';

const ROW_H = 21;
const MIN_EDITOR_H = 120;

const STATUS = {
  added: { color: 'var(--syn-string)', bg: 'var(--added-bg)', mark: '+', label: 'added' },
  removed: { color: 'var(--danger)', bg: 'var(--removed-bg)', mark: '−', label: 'removed' },
  changed: { color: 'var(--syn-key)', bg: 'var(--changed-bg)', mark: '~', label: 'changed' },
  type: { color: 'var(--syn-bool)', bg: 'var(--accent-soft)', mark: '⇄', label: 'type change' },
  same: { color: 'var(--text3)', bg: 'transparent', mark: '', label: 'same' },
  blank: { color: 'transparent', bg: 'transparent', mark: '', label: '' },
};
const st = (s) => STATUS[s] || STATUS.same;

export default function DiffView() {
  const diffA = useJsonStore(s => s.diffA);
  const diffB = useJsonStore(s => s.diffB);
  const setDiffA = useJsonStore(s => s.setDiffA);
  const setDiffB = useJsonStore(s => s.setDiffB);
  const theme = useJsonStore(s => s.theme);
  const indent = useJsonStore(s => s.indent);

  const isMobile = useIsMobile();
  const tBtn = isMobile ? { ...btn, height: 34, padding: '0 12px', borderRadius: 8 } : btn;
  const [showInputs, setShowInputs] = useState(true);
  const [layoutPref, setLayout] = useState('tree'); // 'tree' | 'split' — semantic tree is the headline view
  // Side-by-side needs two readable columns; a phone has room for one, so the
  // semantic tree is the only layout offered there.
  const layout = isMobile ? 'tree' : layoutPref;
  // Which editor a phone shows — both at once leaves neither usable.
  const [mobileDoc, setMobileDoc] = useState('a');
  const [onlyChanges, setOnlyChanges] = useState(false);
  // which change types are shown; clicking a stat pill toggles its type
  const [filters, setFilters] = useState({ added: true, removed: true, changed: true, type: true });
  const toggleFilter = (k) => setFilters(f => ({ ...f, [k]: !f[k] }));
  const [editorH, setEditorH] = useState(220);
  const [cursor, setCursor] = useState(-1);

  const scrollRef = useRef(null);
  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const syncing = useRef(false);

  const pa = parseJson(diffA);
  const pb = parseJson(diffB);
  const aBad = !pa.success && !pa.empty;
  const bBad = !pb.success && !pb.empty;
  const bothValid = pa.success && pb.success;

  const { root, stats, identical } = useMemo(() => {
    if (!bothValid) return { root: null, stats: null, identical: false };
    return diffJson(pa.value, pb.value);
  }, [diffA, diffB, bothValid]); // eslint-disable-line

  const { left, right } = useMemo(() => (root ? flatten(root) : { left: [], right: [] }), [root]);
  // navigation only steps through change types that are currently shown
  const changes = useMemo(() => changeGroups(changeRows(left, right, filters)), [left, right, filters]);
  const rows = useMemo(
    () => (onlyChanges ? collapseUnchanged(left, right, 3) : Array.from({ length: Math.max(left.length, right.length) }, (_, i) => ({ type: 'row', i }))),
    [left, right, onlyChanges],
  );

  useEffect(() => { setCursor(-1); }, [diffA, diffB]);

  const jump = (dir) => {
    if (!changes.length) return;
    const next = dir > 0
      ? changes.find(i => i > cursor) ?? changes[0]
      : [...changes].reverse().find(i => i < cursor) ?? changes[changes.length - 1];
    setCursor(next);
    if (layout !== 'split') return;
    const visualIndex = rows.findIndex(r => r.type === 'row' && r.i === next);
    if (visualIndex >= 0 && scrollRef.current) {
      const target = visualIndex * ROW_H - scrollRef.current.clientHeight / 2;
      scrollRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  };

  const syncScroll = useCallback((from, to) => {
    if (syncing.current) return;
    syncing.current = true;
    if (to.current && from.current) to.current.scrollLeft = from.current.scrollLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

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
      {/* toolbar */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '8px 10px' : '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexWrap: 'wrap' }}>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
            {[['tree', 'Tree'], ['split', 'Side by side']].map(([id, label]) => (
              <button key={id} onClick={() => setLayout(id)} style={{
                border: 'none', background: layout === id ? 'var(--accent-soft)' : 'transparent',
                color: layout === id ? 'var(--accent)' : 'var(--text2)', font: "500 11.5px 'Inter',sans-serif",
                padding: '5px 11px', borderRadius: 5, cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>
        )}
        <button onClick={() => setShowInputs(v => !v)} style={tBtn}>{showInputs ? 'Hide editors' : 'Edit documents'}</button>
        <button onClick={formatBoth} style={tBtn} disabled={!bothValid} title="Pretty-print both">{isMobile ? 'Format' : 'Format both'}</button>
        <button onClick={swap} style={tBtn} title="Swap A and B">Swap A ↔ B</button>

        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: "500 11.5px 'Inter',sans-serif", color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
          Only changes
        </label>
        <button onClick={() => jump(-1)} style={{ ...tBtn, padding: '0 10px' }} disabled={!changes.length} title="Previous change">↑</button>
        <button onClick={() => jump(1)} style={{ ...tBtn, padding: '0 10px' }} disabled={!changes.length} title="Next change">↓</button>
        <span style={{ font: "400 11px 'JetBrains Mono',monospace", color: 'var(--text3)' }}>{changes.length ? `${cursor >= 0 ? changes.indexOf(cursor) + 1 : 0}/${changes.length}` : '—'}</span>

        <div style={{ flex: 1 }} />

        {stats && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill s="added" n={stats.added} on={filters.added} onClick={() => toggleFilter('added')} tip="Added — keys or elements only in B (the after)." />
            <Pill s="removed" n={stats.removed} on={filters.removed} onClick={() => toggleFilter('removed')} tip="Removed — keys or elements only in A (the before)." />
            <Pill s="changed" n={stats.changed} on={filters.changed} onClick={() => toggleFilter('changed')} tip="Changed — same key, same type, different value." />
            {stats.type > 0 && <Pill s="type" n={stats.type} on={filters.type} onClick={() => toggleFilter('type')} tip="Type change — value switched type (e.g. number → string)." />}
          </div>
        )}
      </div>

      {/* editors */}
      {showInputs && (isMobile ? (
        /* one editor at a time on a phone, picked by an A/B switch */
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', height: 'min(42dvh, 300px)', borderBottom: '1px solid var(--border)' }}>
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
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {mobileDoc === 'a'
              ? <EditorPane label="Document A" sub="before" bad={aBad} err={pa.error} value={diffA} onChange={setDiffA} theme={theme} />
              : <EditorPane label="Document B" sub="after" bad={bBad} err={pb.error} value={diffB} onChange={setDiffB} theme={theme} />}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flex: 'none', height: editorH, borderBottom: '1px solid var(--border)' }}>
            <EditorPane label="Document A" sub="before" bad={aBad} err={pa.error} value={diffA} onChange={setDiffA} theme={theme} border />
            <EditorPane label="Document B" sub="after" bad={bBad} err={pb.error} value={diffB} onChange={setDiffB} theme={theme} />
          </div>
          <div onMouseDown={startDrag} title="Drag to resize" style={{ flex: 'none', height: 7, cursor: 'row-resize', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 34, height: 3, borderRadius: 2, background: 'var(--border)' }} />
          </div>
        </>
      ))}

      {/* result */}
      {!bothValid ? (
        <Message>
          {aBad || bBad
            ? `${aBad ? 'Document A' : 'Document B'} is not valid JSON — line ${(aBad ? pa.error : pb.error)?.line}. The diff updates as soon as it parses.`
            : 'Paste JSON into both editors. The diff runs as you type — there is no compare button.'}
        </Message>
      ) : identical ? (
        <Message>
          <span style={{ color: 'var(--syn-string)', fontWeight: 600 }}>Documents are identical.</span>
          <span style={{ display: 'block', marginTop: 6, color: 'var(--text3)' }}>Same values and types. Object key order and array element position (when items carry an id) are ignored.</span>
        </Message>
      ) : layout === 'tree' ? (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '8px 0' }}>
          <TreeDiff node={root} onlyChanges={onlyChanges} filters={filters} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 'none', display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <div style={paneHeader}>A <span style={{ color: 'var(--text3)' }}>— before</span></div>
            <div style={{ ...paneHeader, borderLeft: '1px solid var(--border)' }}>B <span style={{ color: 'var(--text3)' }}>— after</span></div>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'flex', minHeight: '100%' }}>
              <SplitPane lines={left} rows={rows} cursor={cursor} filters={filters} scrollRef={leftScrollRef} onScroll={() => syncScroll(leftScrollRef, rightScrollRef)} />
              <div style={{ width: 1, background: 'var(--border)', flex: 'none' }} />
              <SplitPane lines={right} rows={rows} cursor={cursor} filters={filters} scrollRef={rightScrollRef} onScroll={() => syncScroll(rightScrollRef, leftScrollRef)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- merged tree view ----------

// A node counts as visible when it (or a descendant) has a change whose type is
// currently enabled. Used to prune filtered branches from the tree entirely.
function hasVisibleChange(node, filters) {
  if (node.kind === 'leaf') return node.changed && (filters?.[node.status] ?? true);
  return node.children.some(c => hasVisibleChange(c, filters));
}

function TreeDiff({ node, onlyChanges, filters }) {
  if (!node) return null;
  if (node.kind !== 'branch') return <TreeNode node={node} depth={0} onlyChanges={onlyChanges} filters={filters} />;
  return (
    <div style={{ font: "400 12.5px/1.7 'JetBrains Mono',monospace" }}>
      {node.children.map((c, i) => <TreeNode key={c.path + i} node={c} depth={0} onlyChanges={onlyChanges} filters={filters} />)}
    </div>
  );
}

function labelText(node) {
  if (node.labelKind === 'key') return node.label;
  if (node.labelKind === 'match') return node.label;     // id=5
  if (node.labelKind === 'index') return node.label;     // [0]
  return node.label;
}

function valueText(v) {
  const s = JSON.stringify(v);
  return s === undefined ? 'undefined' : s;
}

function TreeNode({ node, depth, onlyChanges, filters }) {
  const [open, setOpen] = useState(true);

  // leaf whose change type is filtered off → hide it
  if (node.kind === 'leaf' && node.changed && !(filters?.[node.status] ?? true)) return null;
  if (onlyChanges && !node.changed) return null;
  // branch with nothing visible under the current filters → hide it
  if (node.kind === 'branch' && node.changed && !hasVisibleChange(node, filters)) return null;

  const pad = 10 + depth * 16;
  const info = st(node.status);

  if (node.kind === 'branch') {
    const counts = countChildren(node);
    const visibleKids = (onlyChanges ? node.children.filter(c => c.changed) : node.children)
      .filter(c => !c.changed || hasVisibleChange(c, filters) || (c.kind === 'leaf' && (filters?.[c.status] ?? true)));
    return (
      <div>
        <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 12px 2px 0', paddingLeft: pad, cursor: 'pointer', background: node.changed ? 'transparent' : 'transparent' }}>
          <span style={{ width: 12, color: 'var(--text3)', fontSize: 10, flex: 'none' }}>{open ? '▾' : '▸'}</span>
          <span style={{ color: 'var(--syn-key)' }}>{labelText(node)}</span>
          <span style={{ color: 'var(--text3)' }}>{node.container === 'array' ? `[${node.children.length}]` : `{${node.children.length}}`}</span>
          {node.keyField && <span style={{ color: 'var(--text3)', fontSize: 10 }}>matched by {node.keyField}</span>}
          {node.changed && <ChangeBadges counts={counts} />}
        </div>
        {open && visibleKids.map((c, i) => <TreeNode key={c.path + i} node={c} depth={depth + 1} onlyChanges={onlyChanges} filters={filters} />)}
      </div>
    );
  }

  // leaf
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '2px 12px 2px 0', paddingLeft: pad, background: info.bg }}>
      <span style={{ width: 12, flex: 'none', textAlign: 'center', color: info.color, fontWeight: 600 }}>{info.mark}</span>
      <span style={{ color: node.status === 'same' ? 'var(--text3)' : 'var(--syn-key)', flex: 'none' }}>{labelText(node)}:</span>
      <LeafValue node={node} info={info} />
    </div>
  );
}

function LeafValue({ node, info }) {
  const wrap = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
  if (node.status === 'added') return <span style={{ color: info.color, ...wrap }}>{valueText(node.value)}</span>;
  if (node.status === 'removed') return <span style={{ color: info.color, ...wrap }}>{valueText(node.value)}</span>;
  if (node.status === 'same') return <span style={{ color: 'var(--text2)', ...wrap }}>{valueText(node.aValue)}</span>;
  // changed / type — show old → new
  return (
    <span style={wrap}>
      <span style={{ color: 'var(--danger)', textDecoration: 'line-through', opacity: .8 }}>{valueText(node.aValue)}</span>
      {node.status === 'type' && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({node.aType})</span>}
      <span style={{ color: 'var(--text3)' }}> → </span>
      <span style={{ color: 'var(--syn-string)' }}>{valueText(node.bValue)}</span>
      {node.status === 'type' && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({node.bType})</span>}
    </span>
  );
}

function countChildren(node) {
  const c = { added: 0, removed: 0, changed: 0, type: 0 };
  const walk = (n) => {
    if (n.kind === 'leaf') { if (n.status in c) c[n.status]++; return; }
    n.children.forEach(walk);
  };
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

// ---------- side-by-side view ----------

function SplitPane({ lines, rows, cursor, filters, scrollRef, onScroll }) {
  return (
    <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
      {rows.map((r, ri) => {
        if (r.type === 'gap') {
          return (
            <div key={`g${ri}`} style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'var(--surface2)', color: 'var(--text3)', font: "400 11px 'Inter',sans-serif", borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              ⋯ {r.count} unchanged line{r.count === 1 ? '' : 's'}
            </div>
          );
        }
        const ln = lines[r.i] || { text: '', status: 'blank' };
        // a filtered-off type still occupies its row (dropping it would shear the
        // panes) but renders neutral — no highlight, no marker
        const shown = ln.status === 'same' || ln.status === 'blank' || (filters?.[ln.status] ?? true);
        const info = st(shown ? ln.status : 'same');
        const isCursor = r.i === cursor;
        return (
          <div key={r.i} style={{ display: 'flex', height: ROW_H, alignItems: 'center', background: info.bg, boxShadow: isCursor ? 'inset 0 0 0 1.5px var(--accent)' : 'none' }}>
            <div style={{ width: 40, flex: 'none', textAlign: 'right', paddingRight: 6, font: "400 10.5px 'JetBrains Mono',monospace", color: 'var(--text3)', userSelect: 'none' }}>{ln.status === 'blank' ? '' : r.i + 1}</div>
            <div style={{ width: 18, flex: 'none', textAlign: 'center', font: "600 12px 'JetBrains Mono',monospace", color: info.color, userSelect: 'none' }}>{info.mark}</div>
            <div style={{ flex: 1, font: "400 12.5px 'JetBrains Mono',monospace", color: ln.status === 'blank' ? 'transparent' : 'var(--text)', whiteSpace: 'pre', paddingRight: 16 }}>{ln.text}</div>
          </div>
        );
      })}
    </div>
  );
}

function EditorPane({ label, sub, bad, err, value, onChange, theme, border }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: border ? '1px solid var(--border)' : 'none' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', font: "500 11px 'Inter',sans-serif", color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text3)' }}>{sub}</span>
        <div style={{ flex: 1 }} />
        {bad
          ? <span style={{ color: 'var(--danger)', font: "500 10.5px 'JetBrains Mono',monospace" }}>invalid · line {err?.line}</span>
          : <span style={{ color: 'var(--syn-string)', font: "500 10.5px 'JetBrains Mono',monospace" }}>valid</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CodeMirror value={value} onChange={onChange} height="100%" theme={theme === 'dark' ? 'dark' : 'light'}
          extensions={[json(), ...cmExtensions]} basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, bracketMatching: true }} style={{ height: '100%', fontSize: 12 }} />
      </div>
    </div>
  );
}

const PILL_MARK = { added: '+', removed: '−', changed: '~', type: '⇄' };
function Pill({ s, n, on, onClick, tip }) {
  const info = st(s);
  return (
    <button
      onClick={onClick}
      title={`${tip}\n\nClick to ${on ? 'hide' : 'show'} these.`}
      style={{
        font: "500 11px 'Inter',sans-serif", cursor: 'pointer',
        color: on ? info.color : 'var(--text3)',
        background: on ? info.bg : 'transparent',
        border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
        padding: '2px 9px', borderRadius: 5, opacity: on ? 1 : 0.6,
        textDecoration: on ? 'none' : 'line-through',
      }}>
      {PILL_MARK[s]}{n}
    </button>
  );
}

function Message({ children }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40, color: 'var(--text2)', font: "400 13px 'Inter',sans-serif", lineHeight: 1.6 }}>
      <div style={{ maxWidth: 480 }}>{children}</div>
    </div>
  );
}

const btn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, height: 28, padding: '0 10px', font: "500 11.5px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer' };
const paneHeader = { flex: 1, padding: '6px 12px', font: "600 11px 'Inter',sans-serif", color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.03em' };
