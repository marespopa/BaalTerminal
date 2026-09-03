import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useAtomValue, useSetAtom } from 'jotai';
import './styles/main.css';
import { TitleBar } from './components/TitleBar';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TerminalTabsHost } from './components/TerminalTabsHost';
import { useTabKeyboardShortcuts } from './hooks/useTabShortcuts';
import { createTabAtom } from './state/tabs';
import { loadSettingsAtom } from './state/settings';
import { themeAtom } from './state/theme';

function App(): React.JSX.Element {
  const createTab = useSetAtom(createTabAtom);
  const loadSettings = useSetAtom(loadSettingsAtom);
  const theme = useAtomValue(themeAtom);
  useTabKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    void loadSettings().then(() => createTab());
  }, [loadSettings, createTab]);

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <ActivityBar />
        <Sidebar />
        <main className="terminal-shell">
          <TabBar />
          <TerminalTabsHost />
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);