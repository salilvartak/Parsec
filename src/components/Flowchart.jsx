import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap,
  Handle, Position, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { useJsonStore, useRawText } from '../store/useJsonStore.js';
import { cmExtensions } from '../lib/cmTheme.js';
import { buildFlow, layout } from '../lib/flow.js';
import { useIsMobile } from '../lib/useMedia.js';

const PANEL_W = 380;

const typeColor = { array: 'var(--syn-number)', object: 'var(--accent)' };
const synClass = { string: 'rf-syn-string', number: 'rf-syn-number', boolean: 'rf-syn-bool', null: 'rf-syn-null' };

function JsonNode({ data, selected }) {
  const toggle = useJsonStore(s => s.toggleFlowNode);
  const accent = typeColor[data.nodeType] || 'var(--border)';
  return (
    <div
      className="rf-node"
      style={{
        borderColor: data.highlight ? 'var(--syn-key)' : (data.collapsible ? accent : 'var(--border)'),
        borderWidth: data.highlight || selected ? 2 : 1.3,
        boxShadow: selected ? '0 0 0 2px var(--accent-soft)' : (data.highlight ? '0 0 0 2px var(--changed-bg)' : 'none'),
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: data.leaves.length ? '1px solid var(--border)' : 'none', paddingBottom: data.leaves.length ? 5 : 0, marginBottom: data.leaves.length ? 4 : 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: data.nodeType === 'array' ? 2 : '50%', background: accent, flex: 'none' }} />
        <strong style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{data.label}</strong>
        <span style={{ color: 'var(--text3)', fontSize: 10, flex: 'none' }}>{data.nodeType === 'array' ? `[${data.size}]` : `{${data.size}}`}</span>
        <div style={{ flex: 1 }} />
        {data.collapsible && (
          <button className="rf-toggle" onClick={(e) => { e.stopPropagation(); toggle(data.path); }} title={data.collapsed ? 'Expand subtree' : 'Collapse subtree'}
            style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', color: 'var(--text2)', height: 16, minWidth: 18, lineHeight: '13px', fontSize: 11, padding: '0 3px', flex: 'none' }}>
            {data.collapsed ? `+${data.count}` : '−'}
          </button>
        )}
      </div>
      {data.leaves.slice(0, 8).map((l, i) => (
        <div key={i} className="rf-leaf">
          {l.key !== '' && <span className="rf-syn-key">{l.key}: </span>}
          <span className={synClass[l.type] || ''}>{l.type === 'string' ? `"${truncate(l.value)}"` : String(l.value)}</span>
        </div>
      ))}
      {data.leaves.length > 8 && <div className="rf-leaf">…{data.leaves.length - 8} more</div>}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
function truncate(s) { s = String(s); return s.length > 30 ? s.slice(0, 30) + '…' : s; }

const nodeTypes = { json: JsonNode };

function allBranchPaths(value) {
  const set = {};
  function walk(val, path) {
    const type = val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val;
    if (type !== 'object' && type !== 'array') return;
    const entries = type === 'array' ? val.map((v, i) => [v, `${path}[${i}]`]) : Object.keys(val).map(k => [val[k], `${path}.${k}`]);
    const hasBranchChild = entries.some(([v]) => v && typeof v === 'object');
    if (hasBranchChild) set[path] = true;
    for (const [v, p] of entries) walk(v, p);
  }
  walk(value, 'root');
  return set;
}

function FlowInner() {
  const isMobile = useIsMobile();
  const parsedValue = useJsonStore(s => s.parsedValue);
  const isEmpty = useJsonStore(s => s.isEmpty);
  const parseError = useJsonStore(s => s.parseError);
  const collapsed = useJsonStore(s => s.flowCollapsed);
  const theme = useJsonStore(s => s.theme);
  const flowWarned = useJsonStore(s => s.flowWarned);
  const setFlowWarned = useJsonStore(s => s.setFlowWarned);
  const setFlowCollapsedMap = useJsonStore(s => s.setFlowCollapsedMap);
  const matches = useJsonStore(s => s.jsonPathMatches);
  const setSelectedPath = useJsonStore(s => s.setSelectedPath);

  const rawText = useRawText();
  const setRawText = useJsonStore(s => s.setRawText);
  const parseActive = useJsonStore(s => s.parseActive);

  const [direction, setDirection] = useState('LR');
  const [panelOpen, setPanelOpen] = useState(false); // closed by default
  const [animating, setAnimating] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  const built = useMemo(() => buildFlow(parsedValue, collapsed), [parsedValue, collapsed]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  const gate = built.count > 300 && !flowWarned;

  // Turn on transform transitions only while a collapse/expand settles, so
  // dragging a node is never laggy.
  const prevCollapsed = useRef(collapsed);
  useEffect(() => {
    if (prevCollapsed.current === collapsed) return;
    prevCollapsed.current = collapsed;
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 360);
    return () => clearTimeout(t);
  }, [collapsed]);

  // recompute layout when structure/direction/matches change
  const lastSig = useRef('');
  useEffect(() => {
    if (isEmpty || parseError || gate) return;
    const laid = layout(built.nodes, built.edges, direction).map(n => ({
      ...n, data: { ...n.data, highlight: matchSet.has(n.id) },
    }));
    const styledEdges = built.edges.map(e => ({
      ...e, type: 'smoothstep', animated: matchSet.has(e.target),
      style: { stroke: matchSet.has(e.target) ? 'var(--syn-key)' : 'var(--border)', strokeWidth: 1.4 },
    }));
    setNodes(laid);
    setEdges(styledEdges);
    // Only re-fit when the graph's shape actually changed — otherwise typing in
    // the side panel would yank the viewport on every keystroke.
    const sig = `${direction}|${laid.map(n => n.id).join(',')}`;
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60);
    return () => clearTimeout(t);
  }, [built, direction, gate, isEmpty, parseError, matchSet]); // eslint-disable-line

  // debounced re-parse while editing in the side panel
  const debounceRef = useRef(null);
  const onPanelChange = useCallback((val) => {
    setRawText(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parseActive(), 220);
  }, [setRawText, parseActive]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const onNodeClick = useCallback((_, node) => setSelectedPath(node.id), [setSelectedPath]);
  const expandAll = () => setFlowCollapsedMap({});
  const collapseAll = () => setFlowCollapsedMap(allBranchPaths(parsedValue));

  // The graph pane swaps between states, but the JSON side panel always stays
  // mounted — otherwise a typo in the panel would delete the editor fixing it.
  let graphPane;
  if (isEmpty || parseError) {
    graphPane = <Center>{parseError ? 'Fix the parse error to render the graph.' : 'Empty document — nothing to graph.'}</Center>;
  } else if (gate) {
    graphPane = (
      <Center>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Large document</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 16 }}>This document has {built.count}+ nodes. The graph may be slow and hard to read. Render anyway?</div>
          <button onClick={() => setFlowWarned(true)} style={primaryBtn}>Render graph</button>
        </div>
      </Center>
    );
  } else {
    graphPane = (
      <div className={animating ? 'rf-animating' : undefined} style={{ flex: 1, position: 'relative', background: 'var(--surface2)', minHeight: 0, minWidth: 0 }}>
        {/* toolbar overlay */}
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={expandAll} style={ovBtn}>{isMobile ? 'Expand' : 'Expand all'}</button>
          <button onClick={collapseAll} style={ovBtn}>{isMobile ? 'Collapse' : 'Collapse all'}</button>
          <button onClick={() => setDirection(d => d === 'LR' ? 'TB' : 'LR')} style={ovBtn} title="Toggle layout direction">{direction === 'LR' ? (isMobile ? '↔' : 'Horizontal') : (isMobile ? '↕' : 'Vertical')}</button>
          <button onClick={() => fitView({ padding: 0.2, duration: 300 })} style={ovBtn}>Fit</button>
        </div>
        {built.truncated && (
          <div style={{ position: 'absolute', ...(isMobile ? { bottom: 12, right: 12 } : { top: 12, right: 12 }), zIndex: 6, background: 'var(--changed-bg)', color: 'var(--syn-key)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', font: "500 11.5px 'Inter',sans-serif" }}>
            Graph truncated to {built.count} nodes.
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          colorMode={theme}
          minZoom={0.1}
          maxZoom={2}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable style={{ background: 'var(--surface)' }} maskColor="var(--accent-soft)"
            nodeColor={(n) => typeColor[n.data?.nodeType] || 'var(--border)'} nodeStrokeWidth={2} />
        </ReactFlow>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {/* left-edge JSON panel — editable, collapsed by default. On a phone it
          floats over the graph instead of squeezing it into nothing. */}
      <div className={isMobile ? undefined : 'flow-panel'}
        style={isMobile
          ? {
            position: 'absolute', inset: 0, zIndex: 20, background: 'var(--surface)',
            display: panelOpen ? 'block' : 'none',
          }
          : { width: panelOpen ? PANEL_W : 0, borderRight: panelOpen ? '1px solid var(--border)' : 'none', background: 'var(--surface)' }}>
        <div style={{ width: isMobile ? '100%' : PANEL_W, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', height: 38, borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <span style={{ font: "600 11px 'Inter',sans-serif", color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.03em' }}>JSON</span>
            <span style={{ font: "400 11px 'JetBrains Mono',monospace", color: parseError ? 'var(--danger)' : 'var(--text3)' }}>
              {parseError ? `line ${parseError.line} · ${parseError.message}` : 'live'}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setPanelOpen(false)} title="Close panel" style={{ ...ovBtn, boxShadow: 'none', padding: '3px 8px' }}>✕</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <CodeMirror
              value={rawText}
              onChange={onPanelChange}
              height="100%"
              theme={theme === 'dark' ? 'dark' : 'light'}
              extensions={[json(), ...cmExtensions]}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true }}
              style={{ height: '100%', fontSize: 12 }}
            />
          </div>
        </div>
      </div>

      {/* always-visible rail to reopen */}
      {!panelOpen && (
        <button onClick={() => setPanelOpen(true)} title="Show JSON" style={{
          flex: 'none', width: isMobile ? 38 : 30, border: 'none', borderRight: '1px solid var(--border)', background: 'var(--surface)',
          cursor: 'pointer', color: 'var(--text2)', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8, padding: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M4.5 1.5L9 6l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ writingMode: 'vertical-rl', font: "600 10.5px 'Inter',sans-serif", letterSpacing: '.08em', textTransform: 'uppercase' }}>JSON</span>
        </button>
      )}

      {graphPane}
    </div>
  );
}

export default function Flowchart() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  );
}

function Center({ children }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', color: 'var(--text2)', font: "400 13px 'Inter',sans-serif", padding: 40 }}>
      {children}
    </div>
  );
}

const ovBtn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '5px 11px', font: "500 11.5px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.08)' };
const primaryBtn = { border: '1px solid var(--border)', background: 'var(--accent)', color: 'var(--accent-fg)', borderRadius: 7, padding: '8px 16px', font: "500 12.5px 'Inter',sans-serif", cursor: 'pointer' };
