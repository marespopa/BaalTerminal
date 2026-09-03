import React, { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Columns2, Plus, SquareTerminal, X } from 'lucide-react';
import {
  activeTabIdAtom,
  activateTabAtom,
  closeTabAtom,
  createTabAtom,
  PaneId,
  renameTabAtom,
  splitLayoutAtom,
  tabsAtom,
  toggleSplitAtom,
} from '../state/tabs';

export function TabBar({ pane }: { pane?: PaneId }): React.JSX.Element {
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const activateTab = useSetAtom(activateTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const createTab = useSetAtom(createTabAtom);
  const renameTab = useSetAtom(renameTabAtom);
  const toggleSplit = useSetAtom(toggleSplitAtom);
  const splitLayout = useAtomValue(splitLayoutAtom);
  const panelTabIds = splitLayout ? splitLayout[pane ?? splitLayout.focusedPane].tabIds : tabs.map((tab) => tab.id);
  const panelTabs = tabs.filter((tab) => panelTabIds.includes(tab.id));
  const panelActiveTabId = splitLayout ? splitLayout[pane ?? splitLayout.focusedPane].activeTabId : activeTabId;

  const startEditing = (tabId: string, title: string) => {
    setEditingTabId(tabId);
    setDraftTitle(title);
  };

  const finishEditing = (tabId: string) => {
    const nextTitle = draftTitle.trim();
    if (nextTitle) {
      renameTab(tabId, nextTitle);
    }
    setEditingTabId(null);
    setDraftTitle('');
  };

  return (
    <div className="tab-bar" role="tablist">
      {panelTabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === panelActiveTabId}
          className={`tab-bar__tab${tab.id === panelActiveTabId ? ' tab-bar__tab--active' : ''}`}
          onClick={() => (editingTabId === tab.id ? undefined : activateTab(tab.id))}
        >
          <SquareTerminal size={14} className="tab-bar__icon" />
          {editingTabId === tab.id ? (
            <input
              className="tab-bar__title-input"
              value={draftTitle}
              autoFocus
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => finishEditing(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  finishEditing(tab.id);
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setEditingTabId(null);
                  setDraftTitle('');
                }
              }}
            />
          ) : (
            <>
              <span
                className="tab-bar__title"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  startEditing(tab.id, tab.title);
                }}
              >
                {tab.title}
                {tab.ports?.length ? ` (${tab.ports.join(', ')})` : ''}
              </span>
              <button
                type="button"
                className="tab-bar__close"
                aria-label={`Close ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      ))}
      <button type="button" className="tab-bar__new" aria-label="New terminal tab" onClick={() => createTab()}>
        <Plus size={16} />
      </button>
      <button
        type="button"
        className={`tab-bar__split${splitLayout ? ' tab-bar__split--active' : ''}`}
        aria-label={splitLayout ? 'Exit split view' : 'Split terminal view'}
        aria-pressed={splitLayout !== null}
        disabled={tabs.length === 0}
        onClick={() => toggleSplit()}
      >
        <Columns2 size={15} />
      </button>
    </div>
  );
}

