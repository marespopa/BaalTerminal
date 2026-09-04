import React, { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  activeTabIdAtom,
  focusPaneAtom,
  moveTabAtom,
  PaneId,
  splitColRatioAtom,
  splitLayoutAtom,
  splitRowRatioAtom,
  tabsAtom,
  TerminalPanel,
} from '../state/tabs';
import { tabDragAtom, TabDragTarget } from '../state/drag';
import { TabBar } from './TabBar';

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

const clampRatio = (ratio: number): number => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

// Lazy-load so xterm.js and its addons ship in a separate chunk, fetched on first terminal render.
const TerminalView = lazy(() => import('./TerminalView').then((module) => ({ default: module.TerminalView })));

/**
 * Renders every open tab's viewport simultaneously and toggles CSS visibility,
 * so terminal DOM/Xterm instances stay mounted (and their PTY output buffered) when switching tabs.
 * With a split layout the visible viewports are placed into a 2x2 CSS grid whose
 * column/row dividers can be dragged, and each viewport accepts dropped tabs.
 */
export function TerminalTabsHost(): React.JSX.Element {
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const splitLayout = useAtomValue(splitLayoutAtom);
  const focusPane = useSetAtom(focusPaneAtom);
  const moveTab = useSetAtom(moveTabAtom);
  const [colRatio, setColRatio] = useAtom(splitColRatioAtom);
  const [rowRatio, setRowRatio] = useAtom(splitRowRatioAtom);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const colDragRef = useRef<{ x: number; ratio: number; width: number } | null>(null);
  const rowDragRef = useRef<{ y: number; ratio: number; height: number } | null>(null);
  const [drag, setDrag] = useAtom(tabDragAtom);
  const panelRefs = useRef(new Map<PaneId, HTMLDivElement>());
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const panelByTabId = new Map<string, TerminalPanel>();
  splitLayout?.panels.forEach((panel) => panel.tabIds.forEach((tabId) => panelByTabId.set(tabId, panel)));

  // Without a split there is a single implicit panel owning every tab.
  const panels: TerminalPanel[] = splitLayout
    ? splitLayout.panels
    : [{ id: 'primary', tabIds: tabs.map((tab) => tab.id), activeTabId, row: 0, col: 0 }];
  const visibleTabIds = new Set(panels.map((panel) => panel.activeTabId).filter((tabId): tabId is string => tabId !== null));

  const columnCount = splitLayout ? Math.max(...splitLayout.panels.map((panel) => panel.col)) + 1 : 1;
  const rowCount = splitLayout ? Math.max(...splitLayout.panels.map((panel) => panel.row)) + 1 : 1;

  const gridStyle: React.CSSProperties | undefined = splitLayout
    ? {
        gridTemplateColumns: columnCount === 2 ? `${colRatio}fr ${1 - colRatio}fr` : '1fr',
        gridTemplateRows: rowCount === 2 ? `${rowRatio}fr ${1 - rowRatio}fr` : '1fr',
      }
    : undefined;

  /**
   * Hit-test a pointer position against every panel. Finds the tab under the
   * pointer to position the drop indicator; falls back to the end of the strip.
   */
  const hitTestPanels = useCallback(
    (x: number, y: number): TabDragTarget | null => {
      for (const panel of panels) {
        const el = panelRefs.current.get(panel.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
        const tabEls = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
        for (const tabEl of tabEls) {
          const tabRect = tabEl.getBoundingClientRect();
          if (x >= tabRect.left && x <= tabRect.right && y >= tabRect.top && y <= tabRect.bottom) {
            return {
              paneId: panel.id,
              tabId: tabEl.dataset.tabId ?? null,
              position: x < tabRect.left + tabRect.width / 2 ? 'before' : 'after',
            };
          }
        }
        return { paneId: panel.id, tabId: null, position: 'after' };
      }
      return null;
    },
    [panels],
  );

  // While a drag is active, track the pointer over the whole window and drop on release.
  useEffect(() => {
    if (!drag) return;
    const moveTabNow = moveTab;
    let frame = 0;

    const onMove = (event: PointerEvent): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = dragRef.current;
        if (!current) return;
        const target = hitTestPanels(event.clientX, event.clientY);
        setDrag({ ...current, x: event.clientX, y: event.clientY, target });
      });
    };

    const onUp = (event: PointerEvent): void => {
      const current = dragRef.current;
      if (current) {
        const target = hitTestPanels(event.clientX, event.clientY) ?? current.target;
        if (target) {
          const panel = panels.find((entry) => entry.id === target.paneId);
          if (panel) {
            const index = target.tabId
              ? panel.tabIds.indexOf(target.tabId) + (target.position === 'after' ? 1 : 0)
              : panel.tabIds.length;
            moveTabNow({ tabId: current.tabId, targetPaneId: target.paneId, targetIndex: index });
          }
        }
      }
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag !== null, hitTestPanels, panels, moveTab, setDrag]);

  const renderTabBody = (tabId: string, isVisible: boolean): React.JSX.Element | null => {
    const tab = tabsById.get(tabId);
    if (!tab) return null;
    const ownerPanel = panelByTabId.get(tab.id);
    return (
      <div
        key={tab.id}
        className="terminal-tabs-host__viewport"
        hidden={!isVisible}
        data-tab-id={tab.id}
      >
        <Suspense fallback={<div className="terminal-view" />}>
          <TerminalView
            tabId={tab.id}
            isActive={tab.id === activeTabId}
            cwd={tab.cwd}
            initialCommand={tab.initialCommand}
            onFocus={() => {
              if (ownerPanel) focusPane(ownerPanel.id);
            }}
          />
        </Suspense>
      </div>
    );
  };

  const handleColPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const hostWidth = hostRef.current?.clientWidth ?? 0;
      if (hostWidth === 0) return;
      event.preventDefault();
      colDragRef.current = { x: event.clientX, ratio: colRatio, width: hostWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [colRatio],
  );

  const handleColPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = colDragRef.current;
      if (!drag) return;
      setColRatio(clampRatio(drag.ratio + (event.clientX - drag.x) / drag.width));
    },
    [setColRatio],
  );

  const handleRowPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const hostHeight = hostRef.current?.clientHeight ?? 0;
      if (hostHeight === 0) return;
      event.preventDefault();
      rowDragRef.current = { y: event.clientY, ratio: rowRatio, height: hostHeight };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [rowRatio],
  );

  const handleRowPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = rowDragRef.current;
      if (!drag) return;
      setRowRatio(clampRatio(drag.ratio + (event.clientY - drag.y) / drag.height));
    },
    [setRowRatio],
  );

  const handleResizePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    colDragRef.current = null;
    rowDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div className={`terminal-tabs-host${splitLayout ? ' terminal-tabs-host--split' : ''}`} style={gridStyle} ref={hostRef}>
      {panels.map((panel) => {
        const isFocusedPanel = splitLayout !== null && panel.id === splitLayout.focusedPane;
        const borderClass = splitLayout
          ? `${panel.col > 0 ? ' terminal-tabs-host__panel--col' : ''}${panel.row > 0 ? ' terminal-tabs-host__panel--row' : ''}`
          : '';
        return (
          <div
            key={panel.id}
            className={`terminal-tabs-host__panel${borderClass}${isFocusedPanel ? ' terminal-tabs-host__panel--focused' : ''}`}
            style={splitLayout ? { gridRow: panel.row + 1, gridColumn: panel.col + 1 } : undefined}
            data-pane-id={panel.id}
            ref={(el) => {
              if (el) panelRefs.current.set(panel.id, el);
              else panelRefs.current.delete(panel.id);
            }}
            onClick={() => {
              if (splitLayout) focusPane(panel.id);
            }}
          >
            <TabBar pane={splitLayout ? panel.id : undefined} />
            <div className="terminal-tabs-host__panel-body">
              {panel.tabIds.map((tabId) => renderTabBody(tabId, tabId === panel.activeTabId))}
            </div>
          </div>
        );
      })}
      {drag ? (
        <div className="tab-drag-ghost" style={{ left: drag.x + 12, top: drag.y + 10 }}>
          {tabsById.get(drag.tabId)?.title ?? ''}
        </div>
      ) : null}
      {splitLayout && columnCount === 2 ? (
        <div
          className="terminal-tabs-host__resize-handle terminal-tabs-host__resize-handle--col"
          style={{ left: `calc(${colRatio * 100}% - 3px)` }}
          onPointerDown={handleColPointerDown}
          onPointerMove={handleColPointerMove}
          onPointerUp={handleResizePointerUp}
        />
      ) : null}
      {splitLayout && rowCount === 2 ? (
        <div
          className="terminal-tabs-host__resize-handle terminal-tabs-host__resize-handle--row"
          style={{ top: `calc(${rowRatio * 100}% - 3px)` }}
          onPointerDown={handleRowPointerDown}
          onPointerMove={handleRowPointerMove}
          onPointerUp={handleResizePointerUp}
        />
      ) : null}
    </div>
  );
}
