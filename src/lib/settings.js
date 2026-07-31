// User preferences: one flat object, persisted whole to localStorage so a new
// key added later just falls back to its default for existing users.
const KEY = 'parsec.settings';

export const DEFAULT_SETTINGS = {
  // formatting
  indent: 2,                 // 2 | 4 | 'tab'
  sortKeys: false,           // sort object keys on Format
  // editor
  fontSize: 12.5,            // px, 11–17
  lineWrap: false,
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  // tree
  treeDepth: 2,              // auto-expanded depth (0–6)
  showStats: true,
  // appearance
  accent: 'slate',           // key into ACCENTS
  density: 'comfortable',    // comfortable | compact
  animations: true,
  // workspace
  defaultTab: 'editor',      // tab selected on load
  historyEnabled: true,
  historyLimit: 15,
};

// Accent presets carry a colour per theme — the light palette's navy would be
// unreadable on the dark surfaces and vice versa.
export const ACCENTS = {
  slate: { label: 'Slate', light: '#3B4A6B', dark: '#8CA2D6' },
  blue: { label: 'Blue', light: '#2563EB', dark: '#7FA9F5' },
  teal: { label: 'Teal', light: '#0F766E', dark: '#5FCFC4' },
  green: { label: 'Green', light: '#15803D', dark: '#6FC78F' },
  amber: { label: 'Amber', light: '#B45309', dark: '#E0A860' },
  violet: { label: 'Violet', light: '#6D4AB6', dark: '#B49BEF' },
  rose: { label: 'Rose', light: '#BE1D4E', dark: '#F08FAF' },
};

// Inline custom properties for the app root. Inline wins over the theme class
// for this element and still inherits into every child.
export function accentVars(accentKey, theme) {
  const a = ACCENTS[accentKey] || ACCENTS.slate;
  const hex = theme === 'dark' ? a.dark : a.light;
  const { r, g, b } = hexToRgb(hex);
  return {
    '--accent': hex,
    '--accent-fg': theme === 'dark' ? '#131316' : '#FFFFFF',
    '--accent-soft': `rgba(${r},${g},${b},${theme === 'dark' ? 0.16 : 0.1})`,
  };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return sanitize({ ...DEFAULT_SETTINGS, ...raw });
  } catch { /* storage blocked or corrupt */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

// Clamp anything a hand-edited localStorage entry could get wrong.
function sanitize(s) {
  const out = { ...s };
  if (![2, 4, 'tab'].includes(out.indent)) out.indent = 2;
  out.fontSize = Math.min(17, Math.max(11, Number(out.fontSize) || 12.5));
  out.treeDepth = Math.min(6, Math.max(0, Math.round(Number(out.treeDepth) || 0)));
  if (!ACCENTS[out.accent]) out.accent = 'slate';
  if (!['comfortable', 'compact'].includes(out.density)) out.density = 'comfortable';
  if (![5, 15, 30, 50].includes(out.historyLimit)) out.historyLimit = 15;
  if (!['editor', 'converters', 'flowchart', 'diff', 'markdown'].includes(out.defaultTab)) out.defaultTab = 'editor';
  for (const k of ['sortKeys', 'lineWrap', 'lineNumbers', 'foldGutter', 'highlightActiveLine', 'showStats', 'animations', 'historyEnabled']) {
    out[k] = !!out[k];
  }
  return out;
}
