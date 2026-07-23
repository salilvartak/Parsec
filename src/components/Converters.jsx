import React, { useState, useMemo } from 'react';
import { useJsonStore } from '../store/useJsonStore.js';
import { xmlToJson, jsonToXml } from '../lib/converters/xml.js';
import { yamlToJson, jsonToYaml } from '../lib/converters/yaml.js';
import { csvToJson, jsonToCsv } from '../lib/converters/csv.js';
import { unwrapStringified, wrapStringified } from '../lib/converters/wrap.js';
import { jsonToTs } from '../lib/converters/tsgen.js';

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
};

const TAB_ORDER = ['xml', 'yaml', 'csv', 'wrap', 'ts'];

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

  const result = useMemo(() => dir.fn(input), [input, dir]);

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
          <div style={{ padding: '9px 14px', font: "500 11.5px 'Inter',sans-serif", color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>{dir.in} input</div>
          <textarea value={input} onChange={e => setInput(e.target.value)} spellCheck={false}
            style={{ flex: 1, border: 'none', resize: 'none', background: 'var(--surface)', color: 'var(--text)', font: "400 12.5px/1.65 'JetBrains Mono',monospace", padding: 14, outline: 'none', whiteSpace: 'pre' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', font: "500 11.5px 'Inter',sans-serif", color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <span style={{ flex: 1 }}>{dir.out} output</span>
            <button onClick={copyOut} disabled={!result.success} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 5, padding: '2px 9px', font: "500 11px 'Inter',sans-serif", color: 'var(--text)', cursor: 'pointer' }}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          {result.success
            ? <textarea readOnly value={result.data} spellCheck={false} style={{ flex: 1, border: 'none', resize: 'none', background: 'var(--surface)', color: 'var(--text)', font: "400 12.5px/1.65 'JetBrains Mono',monospace", padding: 14, outline: 'none', whiteSpace: 'pre' }} />
            : <div style={{ flex: 1, display: 'flex' }}>
                <div style={{ margin: 14, padding: '10px 14px', background: 'var(--danger-soft)', border: '1px solid var(--border)', borderRadius: 8, alignSelf: 'flex-start', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--danger)' }}>⚠</span>
                  <span style={{ font: "500 12px 'JetBrains Mono',monospace", color: 'var(--danger)' }}>{result.error}</span>
                </div>
              </div>}
        </div>
      </div>
    </div>
  );
}
