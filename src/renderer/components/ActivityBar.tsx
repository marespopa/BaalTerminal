import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Bookmark, ExternalLink, File, FileCode, FolderOpen, Settings } from 'lucide-react';
import { activePanelAtom, toggleSidebarPanelAtom } from '../state/sidebar';
import { openFileWithSystemAppAtom, openPathAtom } from '../state/tabs';

export function ActivityBar(): React.JSX.Element {
  const [activePanel] = useAtom(activePanelAtom);
  const togglePanel = useSetAtom(toggleSidebarPanelAtom);
  const openPath = useSetAtom(openPathAtom);
  const openFileWithSystemApp = useSetAtom(openFileWithSystemAppAtom);

  return (
    <div className="activity-bar">
      <button
        type="button"
        className="activity-bar__icon"
        aria-label="Open folder"
        onClick={() => void openPath('folder')}
      >
        <FolderOpen size={20} />
      </button>
      <button
        type="button"
        className="activity-bar__icon"
        aria-label="Open file in nvim"
        onClick={() => void openPath('file')}
      >
        <File size={20} />
      </button>
      <button
        type="button"
        className="activity-bar__icon"
        aria-label="Open file in system default app"
        onClick={() => void openFileWithSystemApp()}
      >
        <ExternalLink size={20} />
      </button>
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
