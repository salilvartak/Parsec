import { EditorView, Decoration, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { linter } from '@codemirror/lint';
import { parseJson, lineColToOffset } from './parse.js';

// Highlight JSON tokens using our design's --syn-* variables so it tracks theme.
const jsonHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--syn-key)' },
  { tag: [t.string], color: 'var(--syn-string)' },
  { tag: [t.number], color: 'var(--syn-number)' },
  { tag: [t.bool], color: 'var(--syn-bool)' },
  { tag: [t.null], color: 'var(--syn-null)' },
  { tag: [t.punctuation, t.brace, t.bracket], color: 'var(--text2)' },
]);

const baseTheme = EditorView.theme({
  '&': { color: 'var(--text)', backgroundColor: 'var(--surface)' },
  '.cm-content': { caretColor: 'var(--text)' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft) !important' },
  '.cm-gutters': { backgroundColor: 'var(--surface2)', color: 'var(--text3)', border: 'none' },
});

// Linter that surfaces the JSON.parse error at its exact position.
export const jsonLinter = linter((view) => {
  const text = view.state.doc.toString();
  const r = parseJson(text);
  if (r.success || r.empty || !r.error) return [];
  const from = Math.min(lineColToOffset(text, r.error.line, r.error.col), text.length);
  const to = Math.min(from + 1, text.length);
  return [{ from: Math.max(0, from - 1), to, severity: 'error', message: r.error.message }];
});

export const cmExtensions = [baseTheme, syntaxHighlighting(jsonHighlight), jsonLinter];

// Paint every line that holds a duplicate key, plus the key token itself.
// `ranges` is [{ from, to }] of key-token offsets in the CURRENT document text —
// offsets past the doc end are dropped so a stale set can never throw.
export function duplicateHighlighter(ranges) {
  const lineDeco = Decoration.line({ class: 'cm-dup-line' });
  const markDeco = Decoration.mark({ class: 'cm-dup-key' });

  const build = (view) => {
    const b = new RangeSetBuilder();
    const docLen = view.state.doc.length;
    const seenLines = new Set();
    for (const r of ranges) {
      if (r.from >= docLen) continue;
      const to = Math.min(r.to, docLen);
      const line = view.state.doc.lineAt(r.from);
      if (!seenLines.has(line.from)) { seenLines.add(line.from); b.add(line.from, line.from, lineDeco); }
      if (to > r.from) b.add(r.from, to, markDeco);
    }
    return b.finish();
  };

  return ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = build(view); }
    update(u) { if (u.docChanged || u.viewportChanged) this.decorations = build(u.view); }
  }, { decorations: v => v.decorations });
}
