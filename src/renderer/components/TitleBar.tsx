import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, Sun, Moon } from 'lucide-react';
import { useAtom } from 'jotai';
import { themeAtom } from '../state/theme';

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);
  const [theme, setTheme] = useAtom(themeAtom);

  useEffect(() => window.appWindow.onMaximizedChange(setIsMaximized), []);

  return (
    <div className="titlebar">
      <div className="titlebar__drag">
        <span className="titlebar__title">BaalTerminal</span>
      </div>
      <div className="titlebar__controls">
        <button
          type="button"
          className="titlebar__button"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button type="button" className="titlebar__button" aria-label="Minimize" onClick={() => window.appWindow.minimize()}>
          <Minus size={16} />
        </button>
        <button type="button" className="titlebar__button" aria-label="Maximize" onClick={() => window.appWindow.maximize()}>
          {isMaximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button type="button" className="titlebar__button titlebar__button--close" aria-label="Close" onClick={() => window.appWindow.close()}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
