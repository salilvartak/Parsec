import React from 'react';
import { useJsonStore } from './store/useJsonStore.js';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import EmptyState from './components/EmptyState.jsx';
import EditorView from './components/EditorView.jsx';
import Converters from './components/Converters.jsx';
import Flowchart from './components/Flowchart.jsx';
import DiffView from './components/DiffView.jsx';

export default function App() {
  const mode = useJsonStore(s => s.mode);
  const theme = useJsonStore(s => s.theme);
  const isEmpty = useJsonStore(s => s.isEmpty);
  const touched = useJsonStore(s => !!s.documents.find(d => d.id === s.activeDocId)?.touched);
  // Only a doc the user has never typed in gets the onboarding screen — clearing
  // the editor by hand keeps the editor (and focus) in place.
  const showOnboarding = isEmpty && !touched;

  return (
    <div className={theme === 'light' ? 'theme-light' : 'theme-dark'}
      style={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <TopBar />
      <TabBar />
      {/* Editor mode with an empty active doc → show the empty/onboarding state */}
      {mode === 'editor' && showOnboarding && <EmptyState />}
      {mode === 'editor' && !showOnboarding && <EditorView />}
      {mode === 'converters' && <Converters />}
      {mode === 'flowchart' && <Flowchart />}
      {mode === 'diff' && <DiffView />}
    </div>
  );
}
