import React, { useEffect, useRef, useState } from 'react';
import { useJsonStore } from './store/useJsonStore.js';
import Loader from './components/Loader.jsx';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import EmptyState from './components/EmptyState.jsx';
import EditorView from './components/EditorView.jsx';
import Converters from './components/Converters.jsx';
import Flowchart from './components/Flowchart.jsx';
import DiffView from './components/DiffView.jsx';
import MarkdownView from './components/MarkdownView.jsx';
import SidePanel from './components/SidePanel.jsx';
import { accentVars } from './lib/settings.js';
import { applyFavicon } from './lib/favicon.js';

export default function App() {
  const mode = useJsonStore(s => s.mode);
  const theme = useJsonStore(s => s.theme);
  const settings = useJsonStore(s => s.settings);
  const isEmpty = useJsonStore(s => s.isEmpty);
  const touched = useJsonStore(s => !!s.documents.find(d => d.id === s.activeDocId)?.touched);
  // Only a doc the user has never typed in gets the onboarding screen — clearing
  // the editor by hand keeps the editor (and focus) in place.
  const showOnboarding = isEmpty && !touched;
  const applySystemTheme = useJsonStore(s => s.applySystemTheme);

  // Hold the brand splash for a fixed 3s on load before revealing the app.
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Follow the OS theme live, until the user picks one explicitly.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e) => applySystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [applySystemTheme]);

  // A pointer press must not move DOM focus onto a button: the browser then
  // paints a focus ring that survives the click and reads as a stuck "selected"
  // toolbar button. Cancelling the default on mousedown skips focus entirely,
  // while keyboard activation (Tab + Enter/Space) still focuses and still gets
  // the :focus-visible ring from index.css.
  useEffect(() => {
    const onDown = (e) => {
      const btn = e.target.closest?.('button, [role="switch"]');
      if (btn && !btn.disabled) e.preventDefault();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Keep the browser UI (scrollbars, form controls, address bar) and the tab
  // icon in step.
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    applyFavicon(theme);
  }, [theme]);

  // Slide direction for the tab swap: compare the new tab's position in the bar
  // against the previous one, so moving right swipes in from the right and vice
  // versa. Keyed remount replays the CSS animation on every switch.
  const prevIndex = useRef(MODE_ORDER.indexOf(mode));
  const index = MODE_ORDER.indexOf(mode);
  const dir = index >= prevIndex.current ? 'right' : 'left';
  prevIndex.current = index;

  const pane =
    mode === 'editor' ? (showOnboarding ? <EmptyState /> : <EditorView />)
      : mode === 'converters' ? <Converters />
        : mode === 'flowchart' ? <Flowchart />
          : mode === 'diff' ? <DiffView />
            : mode === 'markdown' ? <MarkdownView />
              : null;

  // Preference-driven custom properties live inline on the root so they beat the
  // theme class for this element and still inherit into every child (CodeMirror
  // and ReactFlow read them from CSS).
  const prefVars = {
    ...accentVars(settings.accent, theme),
    '--cm-font': `${settings.fontSize}px`,
    '--cm-line': `${(settings.fontSize * (settings.density === 'compact' ? 1.4 : 1.66)).toFixed(2)}px`,
  };

  return (
    // 100dvh, not 100vh: mobile browsers count their collapsing address bar in
    // 100vh, which pushes the bottom of the app under the chrome.
    <div className={`${theme === 'light' ? 'theme-light' : 'theme-dark'}${settings.animations ? '' : ' no-anim'}`}
      style={{ ...prefVars, height: '100dvh', maxHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden' }}>
      {booting ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader size={120} />
        </div>
      ) : (
        <>
          <TopBar />
          <TabBar />
          {/* keyed so each tab change remounts and replays the swipe */}
          <div key={mode + (showOnboarding ? '-empty' : '')} className={`pane-swipe pane-swipe-${dir}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {pane}
          </div>
          <SidePanel />
        </>
      )}
    </div>
  );
}

const MODE_ORDER = ['editor', 'converters', 'flowchart', 'diff', 'markdown'];
