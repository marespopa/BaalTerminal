import React, { useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Columns2, Plus, Rows2, SquareTerminal, X } from 'lucide-react';
import {
  activeTabIdAtom,
  activateTabAtom,
  closeTabAtom,
  createTabAtom,
  getSplitTargetCell,
  PaneId,
  renameTabAtom,
  splitLayoutAtom,
  splitPaneAtom,
  tabsAtom,
  TerminalTabMeta,
} from '../state/tabs';
import { tabDragAtom } from '../state/drag';

const DRAG_THRESHOLD_PX = 5;

export function TabBar({ pane }: { pane?: PaneId }): React.JSX.Element {
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const splitLayout = useAtomValue(splitLayoutAtom);
  const [drag, setDrag] = useAtom(tabDragAtom);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const activateTab = useSetAtom(activateTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const createTab = useSetAtom(createTabAtom);
  const renameTab = useSetAtom(renameTabAtom);
  const splitPane = useSetAtom(splitPaneAtom);

  const panel = splitLayout ? splitLayout.panels.find((entry) => entry.id === (pane ?? splitLayout.focusedPane)) : null;
  const panelTabIds = panel ? panel.tabIds : tabs.map((tab) => tab.id);
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const panelTabs = panelTabIds.map((tabId) => tabsById.get(tabId)).filter((tab): tab is TerminalTabMeta => tab !== undefined);
  const panelActiveTabId = panel ? panel.activeTabId : activeTabId;

  const paneId = panel?.id ?? pane;
  const canSplitRight = tabs.length > 0 && getSplitTargetCell(splitLayout, paneId, 'right') !== null;
  const canSplitDown = tabs.length > 0 && getSplitTargetCell(splitLayout, paneId, 'down') !== null;

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

  /**
   * Starts a pointer-based drag. A small movement threshold separates a click
   * (activate the tab) from a drag (reorder / move across panes).
   */
  const handleTabPointerDown = (event: React.PointerEvent<HTMLDivElement>, tabId: string): void => {
    if (event.button !== 0 || editingTabId === tabId) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let started = false;

    const onMove = (moveEvent: PointerEvent): void => {
      if (!started) {
        if (Math.abs(moveEvent.clientX - startX) < DRAG_THRESHOLD_PX && Math.abs(moveEvent.clientY - startY) < DRAG_THRESHOLD_PX) {
          return;
        }
        started = true;
      }
      setDrag((previous) => ({
        tabId,
        x: moveEvent.clientX,
        y: moveEvent.clientY,
        // Preserve the last hit-test result; TerminalTabsHost updates it as the pointer moves over panes.
        target: previous?.tabId === tabId ? previous.target : null,
      }));
    };

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // A short delay lets click handlers see the drag as "still active" and suppress activation.
      window.setTimeout(() => setDrag(null), 0);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dropTarget = drag?.target ?? null;
  const isStripDropEnd = dropTarget !== null && dropTarget.paneId === paneId && dropTarget.tabId === null;

  return (
    <div className={`tab-bar${isStripDropEnd ? ' tab-bar--drop-end' : ''}`} role="tablist">
      {panelTabs.map((tab) => {
        const isDropBefore = dropTarget !== null && dropTarget.paneId === paneId && dropTarget.tabId === tab.id && dropTarget.position === 'before';
        const isDropAfter = dropTarget !== null && dropTarget.paneId === paneId && dropTarget.tabId === tab.id && dropTarget.position === 'after';
        return (
          <div
            key={tab.id}
            role="tab"
            data-tab-id={tab.id}
            aria-selected={tab.id === panelActiveTabId}
            className={`tab-bar__tab${tab.id === panelActiveTabId ? ' tab-bar__tab--active' : ''}${
              drag?.tabId === tab.id ? ' tab-bar__tab--dragging' : ''
            }${isDropBefore ? ' tab-bar__tab--drop-before' : ''}${isDropAfter ? ' tab-bar__tab--drop-after' : ''}`}
            onPointerDown={(event) => handleTabPointerDown(event, tab.id)}
            onClick={() => {
              if (drag) return; // a drag just ended; don't activate
              if (editingTabId !== tab.id) activateTab(tab.id);
            }}
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
        );
      })}
      <button type="button" className="tab-bar__new" aria-label="New terminal tab" onClick={() => createTab()}>
        <Plus size={16} />
      </button>
      <button
        type="button"
        className="tab-bar__split tab-bar__split--first"
        aria-label="Split pane right"
        title="Split Right (Ctrl+\)"
        disabled={!canSplitRight}
        onClick={() => splitPane({ direction: 'right', paneId })}
      >
        <Columns2 size={15} />
      </button>
      <button
        type="button"
        className="tab-bar__split"
        aria-label="Split pane down"
        title="Split Down (Ctrl+Shift+\)"
        disabled={!canSplitDown}
        onClick={() => splitPane({ direction: 'down', paneId })}
      >
        <Rows2 size={15} />
      </button>
    </div>
  );
}
