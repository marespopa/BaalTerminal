import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Bookmark, FileCode, Settings } from 'lucide-react';
import { activePanelAtom, toggleSidebarPanelAtom } from '../state/sidebar';

export function ActivityBar(): React.JSX.Element {
  const [activePanel] = useAtom(activePanelAtom);
  const togglePanel = useSetAtom(toggleSidebarPanelAtom);

  return (
    <div className="activity-bar">
      <button
        type="button"
        className={`activity-bar__icon${activePanel === 'bookmarks' ? ' activity-bar__icon--active' : ''}`}
        aria-label="Bookmarks"
        aria-pressed={activePanel === 'bookmarks'}
        onClick={() => togglePanel('bookmarks')}
      >
        <Bookmark size={20} />
      </button>
      <button
        type="button"
        className={`activity-bar__icon${activePanel === 'snippets' ? ' activity-bar__icon--active' : ''}`}
        aria-label="Snippets"
        aria-pressed={activePanel === 'snippets'}
        onClick={() => togglePanel('snippets')}
      >
        <FileCode size={20} />
      </button>
      <button
        type="button"
        className={`activity-bar__icon activity-bar__icon--bottom${activePanel === 'settings' ? ' activity-bar__icon--active' : ''}`}
        aria-label="Settings"
        aria-pressed={activePanel === 'settings'}
        onClick={() => togglePanel('settings')}
      >
        <Settings size={20} />
      </button>
    </div>
  );
}
