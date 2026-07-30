import React, { useEffect, useRef } from 'react';
import { useJsonStore } from './store/useJsonStore.js';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import EmptyState from './components/EmptyState.jsx';
import EditorView from './components/EditorView.jsx';
import Converters from './components/Converters.jsx';
import Flowchart from './components/Flowchart.jsx';
import DiffView from './components/DiffView.jsx';
import MarkdownView from './components/MarkdownView.jsx';

export default function App() {
  const mode = useJsonStore(s => s.mode);
  const theme = useJsonStore(s => s.theme);
  const isEmpty = useJsonStore(s => s.isEmpty);
  const touched = useJsonStore(s => !!s.documents.find(d => d.id === s.activeDocId)?.touched);
  // Only a doc the user has never typed in gets the onboarding screen — clearing
  // the editor by hand keeps the editor (and focus) in place.
  const showOnboarding = isEmpty && !touched;
  const applySystemTheme = useJsonStore(s => s.applySystemTheme);

  // Follow the OS theme live, until the user picks one explicitly.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e) => applySystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [applySystemTheme]);

  // Keep the browser UI (scrollbars, form controls, address bar) in step.
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
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

  return (
    <div className={theme === 'light' ? 'theme-light' : 'theme-dark'}
      style={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <TopBar />
      <TabBar />
      {/* keyed so each tab change remounts and replays the swipe */}
      <div key={mode + (showOnboarding ? '-empty' : '')} className={`pane-swipe pane-swipe-${dir}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {pane}
      </div>
    </div>
  );
}

const MODE_ORDER = ['editor', 'converters', 'flowchart', 'diff', 'markdown'];
