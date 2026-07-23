import { create } from 'zustand';
import { parseJson, findDuplicateKeys } from '../lib/parse.js';
import { SAMPLE, DIFF_SAMPLE_A, DIFF_SAMPLE_B } from '../lib/sample.js';
import { readShareParam, clearShareParam } from '../lib/share.js';

const HISTORY_KEY = 'parsec.history';
const THEME_KEY = 'parsec.theme';
const MAX_HISTORY = 15;
const LARGE_DOC = 5 * 1024 * 1024; // 5MB

let idc = 1;
const newId = () => `doc_${idc++}`;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* quota */ }
}
function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
}

// Parse a text and return the derived slice.
function derive(text) {
  const r = parseJson(text);
  if (r.empty) return { parsedValue: undefined, parseError: null, duplicateKeys: [], isEmpty: true };
  if (!r.success) return { parsedValue: undefined, parseError: r.error, duplicateKeys: [], isEmpty: false };
  const dups = findDuplicateKeys(text);
  return { parsedValue: r.value, parseError: null, duplicateKeys: dups, isEmpty: false };
}

// Decide the initial document: URL share param > sample.
function initialDoc() {
  const shared = readShareParam();
  if (shared) { clearShareParam(); return { text: shared, name: 'shared.json' }; }
  return { text: JSON.stringify(SAMPLE, null, 2), name: 'sample.json' };
}

const init = initialDoc();
const firstId = newId();
const firstDerived = derive(init.text);

export const useJsonStore = create((set, get) => ({
  // --- documents / tabs ---
  // `touched` = the user has typed in this doc, so clearing it should keep the
  // editor mounted instead of swapping in the full-screen empty state.
  documents: [{ id: firstId, name: init.name, rawText: init.text, touched: false }],
  activeDocId: firstId,

  // --- derived parse state for the ACTIVE document ---
  ...firstDerived,

  // --- ui ---
  mode: 'editor',           // editor | converters | flowchart | diff | empty
  theme: loadTheme(),
  indent: 2,                // 2 | 4 | 'tab'
  selectedPath: 'root',

  // converters
  convTab: 'xml',
  convInput: '',
  convReverse: false,       // direction toggle within a converter

  // flowchart
  flowCollapsed: {},
  flowWarned: false,

  // jsonpath
  jsonPathQuery: '',
  jsonPathMatches: [],      // array of normalized paths
  jsonPathError: null,

  // diff
  diffA: JSON.stringify(DIFF_SAMPLE_A, null, 2),
  diffB: JSON.stringify(DIFF_SAMPLE_B, null, 2),

  // history
  history: loadHistory(),

  // large-doc flag
  isLarge: init.text.length > LARGE_DOC,

  // ---------- selectors ----------
  activeDoc: () => {
    const s = get();
    return s.documents.find(d => d.id === s.activeDocId);
  },

  // ---------- actions ----------
  setMode: (mode) => set({ mode }),

  toggleTheme: () => set(s => {
    const theme = s.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* */ }
    return { theme };
  }),

  setIndent: (indent) => set({ indent }),
  setSelectedPath: (selectedPath) => set({ selectedPath }),

  // update active document text (no parse yet)
  setRawText: (text) => set(s => ({
    documents: s.documents.map(d => d.id === s.activeDocId ? { ...d, rawText: text, touched: true } : d),
    isLarge: text.length > LARGE_DOC,
  })),

  // parse the active document and refresh derived state
  parseActive: () => set(s => {
    const doc = s.documents.find(d => d.id === s.activeDocId);
    return derive(doc ? doc.rawText : '');
  }),

  // replace active doc text + parse immediately (for format/minify/load)
  replaceRawText: (text) => set(s => ({
    documents: s.documents.map(d => d.id === s.activeDocId ? { ...d, rawText: text } : d),
    isLarge: text.length > LARGE_DOC,
    ...derive(text),
  })),

  loadSample: () => set(s => {
    const text = JSON.stringify(SAMPLE, null, 2);
    return {
      documents: s.documents.map(d => d.id === s.activeDocId ? { ...d, rawText: text, name: 'sample.json' } : d),
      mode: 'editor', isLarge: false, ...derive(text),
    };
  }),

  loadFromText: (text, name = 'pasted.json') => set(s => ({
    documents: s.documents.map(d => d.id === s.activeDocId ? { ...d, rawText: text, name } : d),
    mode: 'editor', isLarge: text.length > LARGE_DOC, ...derive(text),
  })),

  resetToEmpty: () => set(s => ({
    documents: s.documents.map(d => d.id === s.activeDocId ? { ...d, rawText: '', name: 'untitled.json', touched: false } : d),
    mode: 'editor', isEmpty: true, parsedValue: undefined, parseError: null, duplicateKeys: [], isLarge: false,
    selectedPath: 'root', jsonPathQuery: '', jsonPathMatches: [], jsonPathError: null,
  })),

  // ---- tabs ----
  addTab: () => set(s => {
    const id = newId();
    return {
      documents: [...s.documents, { id, name: `untitled-${s.documents.length + 1}.json`, rawText: '', touched: false }],
      activeDocId: id, mode: 'editor', isEmpty: true, parsedValue: undefined, parseError: null,
      duplicateKeys: [], selectedPath: 'root',
    };
  }),
  switchTab: (id) => set(s => {
    const doc = s.documents.find(d => d.id === id);
    return { activeDocId: id, selectedPath: 'root', jsonPathMatches: [], jsonPathQuery: '', ...derive(doc ? doc.rawText : '') };
  }),
  closeTab: (id) => set(s => {
    if (s.documents.length === 1) return {}; // keep at least one
    const docs = s.documents.filter(d => d.id !== id);
    let activeDocId = s.activeDocId;
    if (activeDocId === id) activeDocId = docs[docs.length - 1].id;
    const active = docs.find(d => d.id === activeDocId);
    return { documents: docs, activeDocId, ...derive(active.rawText) };
  }),
  renameTab: (id, name) => set(s => ({
    documents: s.documents.map(d => d.id === id ? { ...d, name } : d),
  })),

  // ---- converters ----
  setConvTab: (convTab) => set({ convTab, convInput: '', convReverse: false }),
  setConvInput: (convInput) => set({ convInput }),
  toggleConvReverse: () => set(s => ({ convReverse: !s.convReverse, convInput: '' })),

  // ---- flowchart ----
  toggleFlowNode: (id) => set(s => ({ flowCollapsed: { ...s.flowCollapsed, [id]: !s.flowCollapsed[id] } })),
  setFlowCollapsedMap: (flowCollapsed) => set({ flowCollapsed }),
  setFlowWarned: (v) => set({ flowWarned: v }),

  // ---- jsonpath ----
  setJsonPathQuery: (jsonPathQuery) => set({ jsonPathQuery }),
  setJsonPathResults: (paths, error) => set({ jsonPathMatches: paths, jsonPathError: error || null }),

  // ---- diff ----
  setDiffA: (diffA) => set({ diffA }),
  setDiffB: (diffB) => set({ diffB }),

  // ---- history ----
  pushHistory: () => set(s => {
    const doc = s.documents.find(d => d.id === s.activeDocId);
    if (!doc || !doc.rawText.trim() || s.parseError) return {};
    const preview = doc.rawText.replace(/\s+/g, ' ').slice(0, 80);
    const entry = { id: `h_${Date.now()}`, ts: Date.now(), name: doc.name, preview, rawText: doc.rawText };
    // dedupe identical consecutive content
    const filtered = s.history.filter(h => h.rawText !== doc.rawText);
    const history = [entry, ...filtered].slice(0, MAX_HISTORY);
    saveHistory(history);
    return { history };
  }),
  loadHistoryEntry: (id) => set(s => {
    const entry = s.history.find(h => h.id === id);
    if (!entry) return {};
    return {
      documents: s.documents.map(d => d.id === s.activeDocId ? { ...d, rawText: entry.rawText, name: entry.name } : d),
      mode: 'editor', ...derive(entry.rawText),
    };
  }),
  clearHistory: () => { saveHistory([]); set({ history: [] }); },
}));

// Convenience hook: current active document's raw text.
export function useRawText() {
  return useJsonStore(s => {
    const doc = s.documents.find(d => d.id === s.activeDocId);
    return doc ? doc.rawText : '';
  });
}
