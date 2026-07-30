import React, { useState, useMemo } from 'react';
import { useJsonStore } from '../store/useJsonStore.js';
import { xmlToJson, jsonToXml } from '../lib/converters/xml.js';
import { yamlToJson, jsonToYaml } from '../lib/converters/yaml.js';
import { csvToJson, jsonToCsv } from '../lib/converters/csv.js';
import { unwrapStringified, wrapStringified } from '../lib/converters/wrap.js';
import { jsonToTs } from '../lib/converters/tsgen.js';
import { encodeBase64, decodeBase64 } from '../lib/converters/base64.js';

// Each converter: id, label, forward/reverse fns + pane labels, seed samples.
const CONV = {
  xml: {
    label: 'XML ⇄ JSON', reversible: true,
    fwd: { in: 'XML', out: 'JSON', fn: xmlToJson, seed: '<product>\n  <id>101</id>\n  <name>Widget</name>\n  <inStock>true</inStock>\n</product>' },
    rev: { in: 'JSON', out: 'XML', fn: jsonToXml, seed: '{\n  "product": {\n    "id": 101,\n    "name": "Widget",\n    "inStock": true\n  }\n}' },
  },
  yaml: {
    label: 'YAML ⇄ JSON', reversible: true,
    fwd: { in: 'YAML', out: 'JSON', fn: yamlToJson, seed: 'id: 101\nname: Widget\ninStock: true' },
    rev: { in: 'JSON', out: 'YAML', fn: jsonToYaml, seed: '{\n  "id": 101,\n  "name": "Widget",\n  "inStock": true\n}' },
  },
  csv: {
    label: 'CSV ⇄ JSON', reversible: true,
    fwd: { in: 'CSV', out: 'JSON', fn: csvToJson, seed: 'id,name,inStock\n101,Widget,true\n102,Gadget,false' },
    rev: { in: 'JSON', out: 'CSV', fn: jsonToCsv, seed: '[\n  { "id": 101, "name": "Widget", "inStock": true },\n  { "id": 102, "name": "Gadget", "inStock": false }\n]' },
  },
  wrap: {
    label: 'Stringify Unwrap', reversible: true,
    fwd: { in: 'Stringified', out: 'JSON', fn: unwrapStringified, seed: '"{\\"id\\":101,\\"name\\":\\"Widget\\"}"' },
    rev: { in: 'JSON', out: 'Stringified', fn: wrapStringified, seed: '{\n  "id": 101,\n  "name": "Widget"\n}' },
  },
  ts: {
    label: 'JSON → TS', reversible: false,
    fwd: { in: 'JSON', out: 'TypeScript', fn: (t) => jsonToTs(t), seed: '{\n  "id": 101,\n  "name": "Widget",\n  "inStock": true\n}' },
  },
  base64: {
    label: 'Base64 ⇄ Text', reversible: true,
    fwd: { in: 'Text', out: 'Base64', fn: encodeBase64, seed: '{ "id": 101, "name": "Widget", "café": "☕" }' },
    rev: { in: 'Base64', out: 'Text', fn: decodeBase64, seed: 'eyAiaWQiOiAxMDEsICJuYW1lIjogIldpZGdldCIsICJjYWbDqSI6ICLimJUiIH0=' },
  },
};

const TAB_ORDER = ['xml', 'yaml', 'csv', 'wrap', 'ts', 'base64'];

export default function Converters() {
  const convTab = useJsonStore(s => s.convTab);
  const setConvTab = useJsonStore(s => s.setConvTab);
  const reverse = useJsonStore(s => s.convReverse);
  const toggleReverse = useJsonStore(s => s.toggleConvReverse);
  const parsedValue = useJsonStore(s => s.parsedValue);

  const def = CONV[convTab];
  const dir = (reverse && def.reversible) ? def.rev : def.fwd;

  const [input, setInput] = useState(() => dir.seed);
  const [copied, setCopied] = useState(false);
  const [inputKey, setInputKey] = useState(convTab + reverse);

  // reset seed when tab / direction changes
  const key = convTab + reverse;
  if (key !== inputKey) { setInputKey(key); setInput(dir.seed); }

  const isEmpty = input.trim() === '';
  const result = useMemo(() => (isEmpty ? { success: false, empty: true } : dir.fn(input)), [input, dir, isEmpty]);

  const useCurrentDoc = () => {
    // feed the active editor document into the input (JSON side)
    if (parsedValue !== undefined) setInput(JSON.stringify(parsedValue, null, 2));
  };

  const copyOut = async () => {
    if (!result.success) return;
    try { await navigator.clipboard.writeText(result.data); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* */ }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', alignItems: 'center' }}>
        {TAB_ORDER.map(id => (
          <button key={id} onClick={() => setConvTab(id)} style={{ border: 'none', background: convTab === id ? 'var(--accent-soft)' : 'transparent', color: convTab === id ? 'var(--accent)' : 'var(--text2)', font: "500 12.5px 'Inter',sans-serif", padding: '7px 13px', borderRadius: 6, cursor: 'pointer' }}>{CONV[id].label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {def.reversible && (
          <button onClick={toggleReverse} title="Swap direction" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '0 10px', height: 28, cursor: 'pointer', font: "500 12px 'Inter',sans-serif", color: 'var(--text)' }}>
            {dir.in} → {dir.out} ⇄
          </button>
        )}
        {dir.in === 'JSON' && (
          <button onClick={useCurrentDoc} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '0 10px', height: 28, cursor: 'pointer', font: "500 12px 'Inter',sans-serif", color: 'var(--text)', marginLeft: 6 }}>Use current doc</button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', minWidth: 0 }}>
          <div style={convHeader}>{dir.in} input</div>
          <textarea value={input} onChange={e => setInput(e.target.value)} spellCheck={false}
            style={{ flex: 1, border: 'none', resize: 'none', background: 'var(--surface)', color: 'var(--text)', font: "400 12.5px/1.65 'JetBrains Mono',monospace", padding: 14, outline: 'none', whiteSpace: 'pre' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={convHeader}>
            <span style={{ flex: 1 }}>{dir.out} output</span>
            <button onClick={copyOut} disabled={!result.success} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 5, padding: '0 9px', height: 22, font: "500 11px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer' }}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          {result.success
            ? <textarea readOnly value={result.data} spellCheck={false} style={{ flex: 1, border: 'none', resize: 'none', background: 'var(--surface)', color: 'var(--text)', font: "400 12.5px/1.65 'JetBrains Mono',monospace", padding: 14, outline: 'none', whiteSpace: 'pre' }} />
            : result.empty
              ? <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24, textAlign: 'center' }}>
                  <span style={{ font: "500 13px 'Inter',sans-serif", color: 'var(--text2)' }}>Nothing to convert yet</span>
                  <span style={{ font: "400 12px 'Inter',sans-serif", color: 'var(--text3)', maxWidth: 260, lineHeight: 1.5 }}>Type or paste {dir.in} on the left — the {dir.out} shows up here as you go.</span>
                </div>
              : <div style={{ flex: 1, padding: 14, overflow: 'auto' }}>
                  <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" style={{ flex: 'none', marginTop: 1 }}><circle cx="7.5" cy="7.5" r="6.2" fill="none" stroke="var(--danger)" strokeWidth="1.3" /><path d="M7.5 4v4M7.5 10.3v.1" stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ font: "600 12.5px 'Inter',sans-serif", color: 'var(--danger)' }}>That doesn’t look like valid {dir.in}</span>
                      <span style={{ font: "400 12px/1.5 'JetBrains Mono',monospace", color: 'var(--text2)', wordBreak: 'break-word' }}>{prettyError(result.error, dir)}</span>
                    </div>
                  </div>
                </div>}
        </div>
      </div>
    </div>
  );
}

// Turn raw converter/library errors into something a human can act on.
function prettyError(err, dir) {
  const raw = String(err || 'Unknown error').trim();
  const from = dir.in;
  // strip noisy prefixes some libs add
  let msg = raw.replace(/^Error:\s*/i, '');
  if (/unexpected (token|end|string|number)/i.test(msg) || /in JSON at position/i.test(msg)) {
    return `${msg}. Check for a trailing comma, a missing quote, or an unclosed bracket.`;
  }
  if (from === 'CSV' && /column|header|row/i.test(msg)) return `${msg}. Make sure every row has the same number of columns as the header.`;
  if (from === 'YAML' && /indent|mapping|scalar/i.test(msg)) return `${msg}. YAML is indentation-sensitive — check the spacing.`;
  if (from === 'XML' && /tag|attribute|closing/i.test(msg)) return `${msg}. Check that every tag is closed and properly nested.`;
  if (/not a stringified/i.test(msg)) return 'This isn’t a JSON string wrapping more JSON. Wrap converts a document into an escaped string; Unwrap reverses it.';
  return msg;
}

// Shared pane header — fixed height so both sides line up regardless of the
// Copy button on the right.
const convHeader = {
  flex: 'none', height: 34, display: 'flex', alignItems: 'center', padding: '0 14px',
  font: "500 11.5px 'Inter',sans-serif", color: 'var(--text2)',
  borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
};
