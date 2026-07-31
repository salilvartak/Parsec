import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import { useJsonStore } from '../store/useJsonStore.js';
import { useIsMobile } from '../lib/useMedia.js';

const ROW_H = 21;
const ROW_H_TOUCH = 28;
const MAX_DEPTH = 200;

function typeOf(v) {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
}
function valueMeta(type, value) {
  switch (type) {
    case 'string': return { text: `"${value}"`, color: 'var(--syn-string)' };
    case 'number': return { text: String(value), color: 'var(--syn-number)' };
    case 'boolean': return { text: String(value), color: 'var(--syn-bool)' };
    case 'null': return { text: 'null', color: 'var(--syn-null)' };
    default: return { text: '', color: 'var(--text2)' };
  }
}

// Flatten the tree into visible rows given the expanded set.
function flatten(value, expanded) {
  const rows = [];
  function walk(key, val, path, depth) {
    if (depth > MAX_DEPTH) return;
    const type = typeOf(val);
    const isBranch = type === 'object' || type === 'array';
    const entries = !isBranch ? [] : type === 'array'
      ? val.map((v, i) => [String(i), v, `${path}[${i}]`])
      : Object.keys(val).map(k => [k, val[k], path ? `${path}.${k}` : k]);
    const count = entries.length;
    const isExpandable = isBranch && count > 0;
    const isExpanded = expanded.has(path);
    rows.push({ key, path, type, isBranch, isExpandable, count, depth, value: val, isExpanded });
    if (isExpandable && isExpanded) {
      for (const [k, v, p] of entries) walk(k, v, p, depth + 1);
    }
  }
  walk(null, value, 'root', 0);
  return rows;
}

// Default-expand branches shallower than depth 2 (matches the design).
function defaultExpanded(value) {
  const set = new Set();
  function walk(val, path, depth) {
    const type = typeOf(val);
    if (type !== 'object' && type !== 'array') return;
    if (depth < 2) set.add(path);
    const entries = type === 'array'
      ? val.map((v, i) => [v, `${path}[${i}]`])
      : Object.keys(val).map(k => [val[k], path ? `${path}.${k}` : k]);
    for (const [v, p] of entries) walk(v, p, depth + 1);
  }
  walk(value, 'root', 0);
  return set;
}

function allBranchPaths(value) {
  const set = new Set();
  function walk(val, path) {
    const type = typeOf(val);
    if (type !== 'object' && type !== 'array') return;
    if ((type === 'array' && val.length) || (type === 'object' && Object.keys(val).length)) set.add(path);
    const entries = type === 'array'
      ? val.map((v, i) => [v, `${path}[${i}]`])
      : Object.keys(val).map(k => [val[k], path ? `${path}.${k}` : k]);
    for (const [v, p] of entries) walk(v, p);
  }
  walk(value, 'root');
  return set;
}

export default function TreeView({ value, height }) {
  const isMobile = useIsMobile();
  const rowH = isMobile ? ROW_H_TOUCH : ROW_H;
  const selectedPath = useJsonStore(s => s.selectedPath);
  const setSelectedPath = useJsonStore(s => s.setSelectedPath);
  const matches = useJsonStore(s => s.jsonPathMatches);
  const [expanded, setExpanded] = useState(() => defaultExpanded(value));
  const [hovered, setHovered] = useState(null);
  const [copied, setCopied] = useState(null);
  const listRef = useRef(null);

  // reset expansion when the document identity changes materially
  const valKey = useMemo(() => {
    try { return JSON.stringify(value).length + ':' + typeOf(value); } catch { return 'x'; }
  }, [value]);
  useEffect(() => { setExpanded(defaultExpanded(value)); }, [valKey]); // eslint-disable-line

  // when jsonpath matches change, expand ancestors of first match + scroll to it
  const matchSet = useMemo(() => new Set(matches), [matches]);
  useEffect(() => {
    if (!matches.length) return;
    setExpanded(prev => {
      const next = new Set(prev);
      for (const m of matches) {
        // add all ancestor paths
        let acc = 'root';
        next.add('root');
        const rest = m.replace(/^root/, '');
        const parts = rest.match(/\.[^.[\]]+|\[\d+\]/g) || [];
        for (const part of parts) { acc += part; next.add(acc); }
      }
      return next;
    });
  }, [matches]);

  const rows = useMemo(() => flatten(value, expanded), [value, expanded]);

  // scroll to first match after rows recompute
  useEffect(() => {
    if (!matches.length || !listRef.current) return;
    const idx = rows.findIndex(r => matchSet.has(r.path));
    if (idx >= 0) listRef.current.scrollToItem(idx, 'center');
  }, [rows, matches, matchSet]);

  const toggle = useCallback((path) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const expandAll = () => setExpanded(allBranchPaths(value));
  const collapseAll = () => setExpanded(new Set());

  const copy = async (text, kind, path) => {
    try { await navigator.clipboard.writeText(text); setCopied(path + kind); setTimeout(() => setCopied(null), 1200); } catch { /* */ }
  };

  // Touch has no hover, so the copy buttons only appear on the selected row —
  // they need a bigger box there to stay tappable.
  const mini = isMobile ? { ...miniBtn, height: 22, lineHeight: '20px', padding: '0 8px', fontSize: 11 } : miniBtn;

  const Row = ({ index, style }) => {
    const r = rows[index];
    const isSelected = selectedPath === r.path;
    const isMatch = matchSet.has(r.path);
    const meta = valueMeta(r.type, r.value);
    const bg = isSelected ? 'var(--accent-soft)' : isMatch ? 'var(--changed-bg)' : (hovered === r.path ? 'var(--accent-soft)' : 'transparent');
    const bracketOpen = r.type === 'array' ? '[' : '{';
    const bracketClose = r.type === 'array' ? ']' : '}';
    const countLabel = r.type === 'array' ? `${r.count} item${r.count === 1 ? '' : 's'}` : `${r.count} key${r.count === 1 ? '' : 's'}`;

    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: r.depth * (isMobile ? 11 : 14), flex: 'none' }} />
        <div
          onClick={() => { setSelectedPath(r.path); if (r.isExpandable) toggle(r.path); }}
          onMouseEnter={() => setHovered(r.path)}
          onMouseLeave={() => setHovered(h => (h === r.path ? null : h))}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 6px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: rowH, background: bg, flex: 1, minWidth: 0 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ flex: 'none', visibility: r.isExpandable ? 'visible' : 'hidden', transform: r.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .12s' }}>
            <path d="M3 1.5L7 5L3 8.5" fill="none" stroke="var(--text2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {r.key !== null && (
            <><span style={{ color: 'var(--syn-key)' }}>{r.key}</span><span style={{ color: 'var(--text3)', marginRight: 2 }}>:</span></>
          )}
          {!r.isBranch && <span style={{ color: meta.color }}>{meta.text}</span>}
          {r.isBranch && r.count === 0 && <span style={{ color: 'var(--text3)' }}>{bracketOpen + bracketClose}</span>}
          {r.isExpandable && (
            <span style={{ color: 'var(--text3)' }}>{bracketOpen}
              {!r.isExpanded && <><span style={{ color: 'var(--text2)', fontStyle: 'italic', margin: '0 4px', fontSize: 11.5 }}>{countLabel}</span><span style={{ color: 'var(--text3)' }}>{bracketClose}</span></>}
            </span>
          )}
          {/* copy actions on hover/selected */}
          {(hovered === r.path || isSelected) && (
            <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              <button title="Copy JSONPath" onClick={() => copy(toJsonPath(r.path), 'p', r.path)} style={mini}>{copied === r.path + 'p' ? '✓' : 'path'}</button>
              <button title="Copy value" onClick={() => copy(JSON.stringify(r.value, null, 2), 'v', r.path)} style={mini}>{copied === r.path + 'v' ? '✓' : 'value'}</button>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flex: 'none' }}>
        <button onClick={expandAll} style={treeBtn}>Expand all</button>
        <button onClick={collapseAll} style={treeBtn}>Collapse all</button>
        <div style={{ flex: 1 }} />
        <span style={{ font: "400 11px 'JetBrains Mono',monospace", color: 'var(--text3)', alignSelf: 'center' }}>{rows.length} nodes</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <FixedSizeList
          ref={listRef}
          height={Math.max(120, height - 34)}
          itemCount={rows.length}
          itemSize={rowH}
          width="100%"
          overscanCount={12}
          style={{ font: "400 12.5px 'JetBrains Mono',monospace" }}
        >
          {Row}
        </FixedSizeList>
      </div>
    </div>
  );
}

// Convert internal path (root.a.b[0]) to a JSONPath expression ($.a.b[0]).
function toJsonPath(path) {
  const rest = path.replace(/^root/, '');
  return '$' + rest;
}

const treeBtn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 5, padding: '3px 9px', font: "500 11px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer' };
const miniBtn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 4, padding: '0 6px', font: "500 10px 'JetBrains Mono',monospace", color: 'var(--text2)', cursor: 'pointer', height: 16, lineHeight: '14px' };
