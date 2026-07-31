import React from 'react';
import { useJsonStore } from '../store/useJsonStore.js';
import { ACCENTS } from '../lib/settings.js';
import { toggleThemeAnimated } from '../lib/themeTransition.js';

export default function SettingsPanel() {
  const s = useJsonStore(st => st.settings);
  const setSetting = useJsonStore(st => st.setSetting);
  const resetSettings = useJsonStore(st => st.resetSettings);
  const theme = useJsonStore(st => st.theme);
  const themeIsExplicit = useJsonStore(st => st.themeIsExplicit);
  const setTheme = useJsonStore(st => st.setTheme);
  const useSystemTheme = useJsonStore(st => st.useSystemTheme);
  const historyCount = useJsonStore(st => st.history.length);

  const themeValue = themeIsExplicit ? theme : 'system';
  const pickTheme = (v, e) => toggleThemeAnimated(
    () => (v === 'system' ? useSystemTheme() : setTheme(v)),
    { x: e.clientX, y: e.clientY },
  );

  return (
    <div style={{ paddingBottom: 28 }}>
      <Section title="Appearance">
        <Segmented label="Theme" value={themeValue} onPick={pickTheme} passEvent
          options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
        <Field label="Accent" hint="Tints selections, active tabs and highlights.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(ACCENTS).map(([key, a]) => {
              const color = theme === 'dark' ? a.dark : a.light;
              const active = s.accent === key;
              return (
                <button key={key} title={a.label} onClick={() => setSetting('accent', key)}
                  style={{
                    width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', background: color,
                    border: `2px solid ${active ? 'var(--text)' : 'transparent'}`,
                    boxShadow: `0 0 0 1px var(--border)`, outlineOffset: 2,
                  }} />
              );
            })}
          </div>
        </Field>
        <Segmented label="Density" value={s.density} onPick={v => setSetting('density', v)}
          hint="Compact shrinks tree rows and editor line height."
          options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} />
        <Toggle label="Animations" hint="Pane swipes, node transitions, drawer slide."
          checked={s.animations} onChange={v => setSetting('animations', v)} />
      </Section>

      <Section title="Editor">
        <Field label="Font size" value={`${s.fontSize}px`}>
          <input type="range" min={11} max={17} step={0.5} value={s.fontSize}
            onChange={e => setSetting('fontSize', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </Field>
        <Toggle label="Wrap long lines" checked={s.lineWrap} onChange={v => setSetting('lineWrap', v)} />
        <Toggle label="Line numbers" checked={s.lineNumbers} onChange={v => setSetting('lineNumbers', v)} />
        <Toggle label="Fold gutter" hint="Collapse arrows beside objects and arrays."
          checked={s.foldGutter} onChange={v => setSetting('foldGutter', v)} />
        <Toggle label="Highlight active line" checked={s.highlightActiveLine} onChange={v => setSetting('highlightActiveLine', v)} />
      </Section>

      <Section title="Formatting">
        <Segmented label="Indentation" value={s.indent} onPick={v => setSetting('indent', v)}
          options={[[2, '2 spaces'], [4, '4 spaces'], ['tab', 'Tabs']]} />
        <Toggle label="Sort keys on Format" hint="Reorders object keys A→Z. Array order is untouched."
          checked={s.sortKeys} onChange={v => setSetting('sortKeys', v)} />
      </Section>

      <Section title="Tree & panels">
        <Field label="Auto-expand depth" value={s.treeDepth === 0 ? 'collapsed' : `${s.treeDepth} level${s.treeDepth === 1 ? '' : 's'}`}
          hint="How deep the tree opens when a document loads.">
          <input type="range" min={0} max={6} step={1} value={s.treeDepth}
            onChange={e => setSetting('treeDepth', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </Field>
        <Toggle label="Show stats footer" hint="Depth / keys / nodes / size tiles."
          checked={s.showStats} onChange={v => setSetting('showStats', v)} />
      </Section>

      <Section title="Workspace">
        <Field label="Tab on startup">
          <select value={s.defaultTab} onChange={e => setSetting('defaultTab', e.target.value)} style={selectStyle}>
            {[['editor', 'Editor'], ['converters', 'Converters'], ['flowchart', 'Flowchart'], ['diff', 'Diff'], ['markdown', 'Markdown']]
              .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Toggle label="Capture history" hint="Save valid documents locally as you type."
          checked={s.historyEnabled} onChange={v => setSetting('historyEnabled', v)} />
        <Segmented label="History entries kept" value={s.historyLimit} onPick={v => setSetting('historyLimit', v)}
          hint={`${historyCount} stored right now.`}
          options={[[5, '5'], [15, '15'], [30, '30'], [50, '50']]} />
      </Section>

      <div style={{ padding: '16px' }}>
        <button onClick={resetSettings} style={{
          width: '100%', height: 34, borderRadius: 8, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--surface2)',
          color: 'var(--text2)', font: "500 12px 'Inter',sans-serif",
        }}>Reset all settings</button>
        <p style={{ margin: '10px 2px 0', font: "400 11px/1.5 'Inter',sans-serif", color: 'var(--text3)' }}>
          Settings are stored in this browser only — nothing leaves your device.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <div style={{ padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)', font: "600 10.5px 'Inter',sans-serif", color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {title}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({ label, value, hint, children }) {
  return (
    <div style={fieldStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={labelStyle}>{label}</span>
        <div style={{ flex: 1 }} />
        {value != null && <span style={{ font: "500 11px 'JetBrains Mono',monospace", color: 'var(--text3)' }}>{value}</span>}
      </div>
      {hint && <span style={hintStyle}>{hint}</span>}
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div style={{ ...fieldStyle, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={labelStyle}>{label}</span>
        {hint && <span style={hintStyle}>{hint}</span>}
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        style={{
          flex: 'none', width: 40, height: 23, borderRadius: 12, cursor: 'pointer', position: 'relative',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
          background: checked ? 'var(--accent)' : 'var(--surface2)',
          transition: 'background .16s, border-color .16s',
        }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 19 : 2, width: 17, height: 17, borderRadius: '50%',
          background: checked ? 'var(--accent-fg)' : 'var(--text3)', transition: 'left .16s',
        }} />
      </button>
    </div>
  );
}

function Segmented({ label, hint, value, options, onPick, passEvent }) {
  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {hint && <span style={hintStyle}>{hint}</span>}
      <div style={{ display: 'flex', gap: 3, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, marginTop: 2 }}>
        {options.map(([v, l]) => {
          const active = value === v;
          return (
            <button key={String(v)} onClick={(e) => (passEvent ? onPick(v, e) : onPick(v))}
              style={{
                flex: 1, height: 28, borderRadius: 6, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text2)',
                font: "500 12px 'Inter',sans-serif",
              }}>{l}</button>
          );
        })}
      </div>
    </div>
  );
}

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4, padding: '13px 16px', borderBottom: '1px solid var(--border)' };
const labelStyle = { font: "500 12.5px 'Inter',sans-serif", color: 'var(--text)' };
const hintStyle = { font: "400 11px/1.45 'Inter',sans-serif", color: 'var(--text3)' };
const selectStyle = {
  width: '100%', height: 32, borderRadius: 8, padding: '0 8px', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
  font: "500 12px 'Inter',sans-serif",
};
