import React, { useMemo, useRef, useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { useJsonStore, useRawText } from '../store/useJsonStore.js';
import { cmExtensions, duplicateHighlighter } from '../lib/cmTheme.js';
import { formatJson, minifyJson } from '../lib/format.js';
import { queryJsonPath } from '../lib/jsonpath.js';
import { unwrapStringified, wrapStringified } from '../lib/converters/wrap.js';
import TreeView from './TreeView.jsx';
import StatsPanel from './StatsPanel.jsx';

const toolBtn = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '0 10px', height: 28, cursor: 'pointer', font: "500 12px 'Inter',sans-serif", color: 'var(--text)' };

export default function EditorView() {
  const rawText = useRawText();
  const setRawText = useJsonStore(s => s.setRawText);
  const parseActive = useJsonStore(s => s.parseActive);
  const replaceRawText = useJsonStore(s => s.replaceRawText);
  const parsedValue = useJsonStore(s => s.parsedValue);
  const parseError = useJsonStore(s => s.parseError);
  const duplicateKeys = useJsonStore(s => s.duplicateKeys);
  const isEmpty = useJsonStore(s => s.isEmpty);
  const indent = useJsonStore(s => s.indent);
  const theme = useJsonStore(s => s.theme);
  const selectedPath = useJsonStore(s => s.selectedPath);
  const setJsonPathResults = useJsonStore(s => s.setJsonPathResults);
  const jsonPathError = useJsonStore(s => s.jsonPathError);
  const jsonPathMatches = useJsonStore(s => s.jsonPathMatches);
  const pushHistory = useJsonStore(s => s.pushHistory);
  const loadSample = useJsonStore(s => s.loadSample);
  const resetToEmpty = useJsonStore(s => s.resetToEmpty);

  const [query, setQuery] = useState('');
  const [showDups, setShowDups] = useState(false);
  const [treeH, setTreeH] = useState(400);
  const treePaneRef = useRef(null);
  const debounceRef = useRef(null);
  const histRef = useRef(null);

  // debounced parse on edit
  const onChange = (val) => {
    setRawText(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parseActive(), 180);
    clearTimeout(histRef.current);
    histRef.current = setTimeout(() => pushHistory(), 1500);
  };

  const doFormat = () => { const r = formatJson(rawText, indent); if (r.success) replaceRawText(r.data); else parseActive(); };
  const doMinify = () => { const r = minifyJson(rawText); if (r.success) replaceRawText(r.data); else parseActive(); };
  const doValidate = () => parseActive();

  const doUnwrap = () => { const r = unwrapStringified(rawText); if (r.success) replaceRawText(r.data); };
  const doWrap = () => { const r = wrapStringified(rawText); if (r.success) replaceRawText(r.data); };
  // is the current doc a stringified-JSON candidate?
  const canUnwrap = typeof parsedValue === 'string' && (() => { try { JSON.parse(parsedValue); return true; } catch { return false; } })();

  // run jsonpath query
  const runQuery = (q) => {
    setQuery(q);
    if (!q.trim()) { setJsonPathResults([], null); return; }
    if (parsedValue === undefined) { setJsonPathResults([], 'No valid document'); return; }
    const r = queryJsonPath(parsedValue, q);
    if (r.success) setJsonPathResults(r.paths, r.paths.length ? null : 'No matches');
    else setJsonPathResults([], r.error);
  };

  // measure tree pane height for virtualization
  useEffect(() => {
    const measure = () => { if (treePaneRef.current) setTreeH(treePaneRef.current.clientHeight); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // duplicate-key highlighting: only mount the decorator while the badge is toggled on
  const dupExtensions = useMemo(
    () => (showDups && duplicateKeys.length ? [duplicateHighlighter(duplicateKeys)] : []),
    [showDups, duplicateKeys],
  );
  const dupRepeatCount = duplicateKeys.filter(d => !d.first).length;
  const dupLines = [...new Set(duplicateKeys.map(d => d.line))];

  const hasError = !!parseError;
  const statusLabel = isEmpty ? 'Empty' : hasError ? 'Error' : 'Valid';
  const statusColor = hasError ? 'var(--danger)' : isEmpty ? 'var(--text3)' : 'var(--syn-string)';
  const statusBg = hasError ? 'var(--danger-soft)' : 'var(--accent-soft)';
  const errorText = parseError ? `Invalid JSON — ${parseError.message} (line ${parseError.line}, column ${parseError.col})` : '';
  const breadcrumbSegs = selectedPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={doFormat} style={toolBtn}>Format</button>
        <button onClick={doMinify} style={toolBtn}>Minify</button>
        <button onClick={doValidate} style={toolBtn}>Validate</button>
        <button onClick={doWrap} style={toolBtn} title="Stringify + escape for embedding">Wrap</button>
        <button onClick={doUnwrap} disabled={!canUnwrap} style={toolBtn} title="Re-parse stringified JSON">Unwrap</button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: "500 11.5px 'JetBrains Mono',monospace", padding: '0 9px', height: 26, borderRadius: 5, background: statusBg, color: statusColor }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />{statusLabel}
        </div>
        {dupRepeatCount > 0 && (
          <button
            onClick={() => setShowDups(v => !v)}
            title={`${showDups ? 'Hide' : 'Show'} duplicate keys in the editor\n\n` + duplicateKeys.filter(d => !d.first).map(d => `line ${d.line}  ${d.path} → "${d.key}"`).join('\n')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, font: "500 11.5px 'JetBrains Mono',monospace",
              padding: '0 9px', height: 26, borderRadius: 5, cursor: 'pointer',
              background: showDups ? 'var(--syn-key)' : 'var(--changed-bg)',
              color: showDups ? 'var(--accent-fg)' : 'var(--syn-key)',
              border: `1px solid ${showDups ? 'var(--syn-key)' : 'transparent'}`,
            }}>
            ⚠ {dupRepeatCount} duplicate key{dupRepeatCount === 1 ? '' : 's'}
            <span style={{ opacity: .75, fontSize: 10.5 }}>{showDups ? `· ${dupLines.length} line${dupLines.length === 1 ? '' : 's'} shown` : '· show'}</span>
          </button>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: "400 12px 'JetBrains Mono',monospace", color: 'var(--text2)' }}>
          <span style={{ color: 'var(--text3)' }}>jsonpath</span>
          {breadcrumbSegs.map((seg, i) => (
            <React.Fragment key={i}><span style={{ color: 'var(--text3)' }}>›</span><span style={{ color: 'var(--text)' }}>{seg}</span></React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* left: editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', position: 'relative', minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <CodeMirror
              value={rawText}
              onChange={onChange}
              height="100%"
              theme={theme === 'dark' ? 'dark' : 'light'}
              extensions={[json(), ...cmExtensions, ...dupExtensions]}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true }}
              style={{ height: '100%', fontSize: 12.5 }}
            />
          </div>
          {hasError && (
            <div style={{ flex: 'none', padding: '9px 14px', background: 'var(--danger-soft)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" style={{ flex: 'none', transform: 'translateY(2px)' }}><circle cx="6.5" cy="6.5" r="5.5" fill="none" stroke="var(--danger)" strokeWidth="1.3" /><path d="M6.5 4v3.4M6.5 9.2v.1" stroke="var(--danger)" strokeWidth="1.4" strokeLinecap="round" /></svg>
              <span style={{ font: "500 12px 'JetBrains Mono',monospace", color: 'var(--danger)' }}>{errorText}</span>
            </div>
          )}
        </div>

        {/* right: search + tree + stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
              <span style={{ font: "400 12px 'JetBrains Mono',monospace", color: 'var(--text3)', padding: '0 8px', alignSelf: 'center' }}>$</span>
              <input value={query} onChange={e => runQuery(e.target.value)} placeholder="JSONPath  e.g. $.data.order.items[*].sku"
                style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', font: "400 12px 'JetBrains Mono',monospace", padding: '6px 8px', outline: 'none' }} />
              {query && <button onClick={() => runQuery('')} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', padding: '0 10px' }}>✕</button>}
            </div>
            {jsonPathError && <span style={{ font: "400 11px 'JetBrains Mono',monospace", color: 'var(--danger)' }}>{jsonPathError}</span>}
            {!jsonPathError && jsonPathMatches.length > 0 && <span style={{ font: "400 11px 'JetBrains Mono',monospace", color: 'var(--syn-string)' }}>{jsonPathMatches.length} match{jsonPathMatches.length === 1 ? '' : 'es'}</span>}
          </div>

          <div ref={treePaneRef} style={{ flex: 1, overflow: 'hidden', padding: '10px 12px', minWidth: 0, minHeight: 0 }}>
            {isEmpty
              ? (
                <div style={{ color: 'var(--text3)', font: "400 12.5px 'Inter',sans-serif", padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                  <span>Empty document — paste JSON on the left to inspect it.</span>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <button onClick={loadSample} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', font: "500 12px 'Inter',sans-serif", cursor: 'pointer', padding: 0 }}>Load sample</button>
                    <button onClick={resetToEmpty} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', font: "500 12px 'Inter',sans-serif", cursor: 'pointer', padding: 0 }}>Open import panel</button>
                  </div>
                </div>
              )
              : hasError
                ? <div style={{ color: 'var(--text3)', font: "400 12.5px 'Inter',sans-serif", padding: 20 }}>Fix the parse error to render the tree.</div>
                : <TreeView value={parsedValue} height={treeH - 20} />}
          </div>

          <StatsPanel value={parsedValue} rawText={rawText} />
        </div>
      </div>
    </div>
  );
}
