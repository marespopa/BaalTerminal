import { atom } from 'jotai';
import { settingsAtom } from './settings';

export interface TerminalTabMeta {
  id: string;
  title: string;
  createdAt: number;
  cwd?: string;
  ports?: number[];
  /** Command to type into the terminal once its shell session is ready, e.g. to open a file in nvim. */
  initialCommand?: string;
}

export interface CreateTabOptions {
  title?: string;
  cwd?: string;
  initialCommand?: string;
}

export type PaneId = 'primary' | 'secondary' | 'tertiary' | 'quaternary';
export type SplitDirection = 'right' | 'down';
export type FocusDirection = 'left' | 'right' | 'up' | 'down';

export interface TerminalPanel {
  id: PaneId;
  tabIds: string[];
  activeTabId: string | null;
  /** Row in the 2x2 panel grid (0 or 1). */
  row: number;
  /** Column in the 2x2 panel grid (0 or 1). */
  col: number;
}

export interface SplitLayout {
  panels: TerminalPanel[];
  focusedPane: PaneId;
}

const PANE_ID_ORDER: PaneId[] = ['primary', 'secondary', 'tertiary', 'quaternary'];
const MAX_PANELS = 4;

function getNextPaneId(panels: TerminalPanel[]): PaneId | null {
  const used = new Set(panels.map((panel) => panel.id));
  return PANE_ID_ORDER.find((id) => !used.has(id)) ?? null;
}

/**
 * Cell a split would occupy, or null when the split is impossible
 * (grid edge reached, target cell occupied, or panel limit hit).
 */
export function getSplitTargetCell(
  layout: SplitLayout | null,
  paneId: PaneId | undefined,
  direction: SplitDirection,
): { row: number; col: number } | null {
  if (!layout) {
    return direction === 'right' ? { row: 0, col: 1 } : { row: 1, col: 0 };
  }
  if (layout.panels.length >= MAX_PANELS) return null;
  const source = layout.panels.find((panel) => panel.id === paneId) ?? layout.panels.find((panel) => panel.id === layout.focusedPane);
  if (!source) return null;
  const row = direction === 'down' ? source.row + 1 : source.row;
  const col = direction === 'right' ? source.col + 1 : source.col;
  if (row > 1 || col > 1) return null;
  if (layout.panels.some((panel) => panel.row === row && panel.col === col)) return null;
  return { row, col };
}

/**
 * Re-packs panels after one is removed: drops fully-empty rows/columns and
 * resolves corner-touching (diagonal) two-panel layouts to side-by-side.
 */
function normalizePanels(panels: TerminalPanel[]): TerminalPanel[] {
  const usedRows = [...new Set(panels.map((panel) => panel.row))].sort((a, b) => a - b);
  const usedCols = [...new Set(panels.map((panel) => panel.col))].sort((a, b) => a - b);
  const compacted = panels.map((panel) => ({ ...panel, row: usedRows.indexOf(panel.row), col: usedCols.indexOf(panel.col) }));
  if (compacted.length === 2 && compacted[0].row !== compacted[1].row && compacted[0].col !== compacted[1].col) {
    const ordered = [...compacted].sort((a, b) => a.row - b.row || a.col - b.col);
    return [
      { ...ordered[0], row: 0, col: 0 },
      { ...ordered[1], row: 0, col: 1 },
    ];
  }
  return compacted;
}

/** Flattens the global tab list into a panel's tab order (used when collapsing the layout). */
function orderTabsByPanel(tabs: TerminalTabMeta[], panel: TerminalPanel): TerminalTabMeta[] {
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  return panel.tabIds.map((tabId) => tabsById.get(tabId)).filter((tab): tab is TerminalTabMeta => tab !== undefined);
}

function createTabId(): string {
  return `tab-${crypto.randomUUID()}`;
}

function getNextTabTitle(existingTabs: TerminalTabMeta[]): string {
  const existingTitles = new Set(existingTabs.map((tab) => tab.title.trim()));
  let nextIndex = 1;
  while (existingTitles.has(`Terminal ${nextIndex}`)) {
    nextIndex += 1;
  }
  return `Terminal ${nextIndex}`;
}

export const tabsAtom = atom<TerminalTabMeta[]>([]);
export const activeTabIdAtom = atom<string | null>(null);
export const splitLayoutAtom = atom<SplitLayout | null>(null);
// Fraction of the grid width given to the first column (0.15 - 0.85).
export const splitColRatioAtom = atom<number>(0.5);
// Fraction of the grid height given to the first row (0.15 - 0.85).
export const splitRowRatioAtom = atom<number>(0.5);

export const activeTabAtom = atom((get) => {
  const activeId = get(activeTabIdAtom);
  return get(tabsAtom).find((tab) => tab.id === activeId) ?? null;
});

export const focusedPanelTabIdsAtom = atom((get) => {
  const layout = get(splitLayoutAtom);
  if (!layout) return get(tabsAtom).map((tab) => tab.id);
  return layout.panels.find((panel) => panel.id === layout.focusedPane)?.tabIds ?? [];
});

export const createTabAtom = atom(null, (get, set, options?: CreateTabOptions) => {
  const tabs = get(tabsAtom);
  const id = createTabId();
  const tab: TerminalTabMeta = {
    id,
    title: options?.title ?? getNextTabTitle(tabs),
    createdAt: Date.now(),
    cwd: options?.cwd ?? (get(settingsAtom).defaultCwd || undefined),
    initialCommand: options?.initialCommand,
  };
  set(tabsAtom, [...tabs, tab]);

  const layout = get(splitLayoutAtom);
  if (layout) {
    set(splitLayoutAtom, {
      ...layout,
      panels: layout.panels.map((panel) =>
        panel.id === layout.focusedPane ? { ...panel, tabIds: [...panel.tabIds, id], activeTabId: id } : panel,
      ),
    });
  }
  set(activeTabIdAtom, id);
  return id;
});

export const openPathAtom = atom(null, async (get, set, kind: 'file' | 'folder') => {
  const result = kind === 'file' ? await window.pathPicker.pickFile() : await window.pathPicker.pickFolder();
  if (!result) return;

  const editorCommand = get(settingsAtom).editorCommand || 'nvim';
  set(createTabAtom, {
    title: result.baseName,
    cwd: result.dirName,
    initialCommand: result.isDirectory ? undefined : `${editorCommand} ${result.quotedPath}`,
  });
});

export const openFileWithSystemAppAtom = atom(null, async () => {
  const result = await window.pathPicker.pickFile();
  if (!result) return;
  await window.shellOpener.openPath(result.path);
});

export interface SplitPaneRequest {
  direction: SplitDirection;
  /** Pane to split; defaults to the focused pane. */
  paneId?: PaneId;
}

/**
 * Splits a pane right or down, VS Code style. The new pane gets a fresh terminal
 * tab and takes focus. The grid holds at most four panes (2x2); splitting an
 * occupied cell or past the grid edge is a no-op.
 */
export const splitPaneAtom = atom(null, (get, set, request: SplitPaneRequest) => {
  const tabs = get(tabsAtom);
  const existingLayout = get(splitLayoutAtom);
  const defaultCwd = get(settingsAtom).defaultCwd || undefined;

  if (!existingLayout) {
    const primaryTabId = get(activeTabIdAtom) ?? tabs[0]?.id;
    if (!primaryTabId) return;

    const cell = getSplitTargetCell(null, undefined, request.direction);
    if (!cell) return;
    const newTabId = createTabId();
    set(tabsAtom, [...tabs, { id: newTabId, title: getNextTabTitle(tabs), createdAt: Date.now(), cwd: defaultCwd }]);
    set(splitLayoutAtom, {
      panels: [
        { id: 'primary', tabIds: tabs.map((tab) => tab.id), activeTabId: primaryTabId, row: 0, col: 0 },
        { id: 'secondary', tabIds: [newTabId], activeTabId: newTabId, row: cell.row, col: cell.col },
      ],
      focusedPane: 'secondary',
    });
    set(activeTabIdAtom, newTabId);
    return;
  }

  const cell = getSplitTargetCell(existingLayout, request.paneId, request.direction);
  if (!cell) return;
  const newPaneId = getNextPaneId(existingLayout.panels);
  if (!newPaneId) return;

  const newTabId = createTabId();
  set(tabsAtom, [...tabs, { id: newTabId, title: getNextTabTitle(tabs), createdAt: Date.now(), cwd: defaultCwd }]);
  set(splitLayoutAtom, {
    panels: [...existingLayout.panels, { id: newPaneId, tabIds: [newTabId], activeTabId: newTabId, row: cell.row, col: cell.col }],
    focusedPane: newPaneId,
  });
  set(activeTabIdAtom, newTabId);
});

export const focusPaneAtom = atom(null, (get, set, pane: PaneId) => {
  const layout = get(splitLayoutAtom);
  if (!layout) return;
  const panel = layout.panels.find((entry) => entry.id === pane);
  if (!panel) return;

  set(splitLayoutAtom, { ...layout, focusedPane: pane });
  set(activeTabIdAtom, panel.activeTabId);
});

/** Moves pane focus to the adjacent pane in a direction, VS Code style (Ctrl+Alt+Arrow). */
export const focusPaneDirectionAtom = atom(null, (get, set, direction: FocusDirection) => {
  const layout = get(splitLayoutAtom);
  if (!layout) return;
  const current = layout.panels.find((panel) => panel.id === layout.focusedPane);
  if (!current) return;

  const dRow = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  const dCol = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const target = layout.panels.find((panel) => panel.row === current.row + dRow && panel.col === current.col + dCol);
  if (!target) return;

  set(splitLayoutAtom, { ...layout, focusedPane: target.id });
  set(activeTabIdAtom, target.activeTabId);
});

export const closeTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(tabsAtom);
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;

  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  set(tabsAtom, nextTabs);

  const layout = get(splitLayoutAtom);
  if (layout) {
    const panel = layout.panels.find((entry) => entry.tabIds.includes(tabId));
    if (!panel) return;

    const remainingTabIds = panel.tabIds.filter((id) => id !== tabId);
    if (remainingTabIds.length === 0) {
      // The pane is empty now: remove it. A single remaining pane collapses back to the plain tab strip.
      const remainingPanels = layout.panels.filter((entry) => entry.id !== panel.id);
      if (remainingPanels.length === 1) {
        const survivor = remainingPanels[0];
        set(tabsAtom, orderTabsByPanel(nextTabs, survivor));
        set(splitLayoutAtom, null);
        set(activeTabIdAtom, survivor.activeTabId);
        return;
      }
      const focusedPane = layout.focusedPane === panel.id ? remainingPanels[0].id : layout.focusedPane;
      set(splitLayoutAtom, { panels: normalizePanels(remainingPanels), focusedPane });
      if (layout.focusedPane === panel.id) set(activeTabIdAtom, remainingPanels[0].activeTabId);
      return;
    }

    const panelIndex = panel.tabIds.indexOf(tabId);
    const activeTabId = panel.activeTabId === tabId
      ? remainingTabIds[Math.min(panelIndex, remainingTabIds.length - 1)]
      : panel.activeTabId;
    set(splitLayoutAtom, {
      ...layout,
      panels: layout.panels.map((entry) => (entry.id === panel.id ? { ...entry, tabIds: remainingTabIds, activeTabId } : entry)),
    });
    if (layout.focusedPane === panel.id) set(activeTabIdAtom, activeTabId);
    return;
  }

  if (get(activeTabIdAtom) === tabId) {
    // Activate the tab that slides into the closed tab's position, or the new last tab.
    const nextIndex = Math.min(index, nextTabs.length - 1);
    set(activeTabIdAtom, nextIndex >= 0 ? nextTabs[nextIndex].id : null);
  }
});

export const activateTabAtom = atom(null, (get, set, tabId: string) => {
  if (!get(tabsAtom).some((tab) => tab.id === tabId)) return;

  const layout = get(splitLayoutAtom);
  if (!layout) {
    set(activeTabIdAtom, tabId);
    return;
  }

  const panel = layout.panels.find((entry) => entry.tabIds.includes(tabId));
  if (!panel) return;
  set(splitLayoutAtom, {
    panels: layout.panels.map((entry) => (entry.id === panel.id ? { ...entry, activeTabId: tabId } : entry)),
    focusedPane: panel.id,
  });
  set(activeTabIdAtom, tabId);
});

export interface MoveTabRequest {
  tabId: string;
  /** Target pane; defaults to the focused pane. Ignored without a split layout. */
  targetPaneId?: PaneId;
  /** Insertion index within the target pane (before same-pane removal adjustment). */
  targetIndex: number;
}

/**
 * Moves a tab within or between panes (drag & drop). Reorders the plain tab
 * strip when there is no split layout. Panes emptied by the move are removed;
 * when one pane remains the layout collapses back to the tab strip.
 */
export const moveTabAtom = atom(null, (get, set, request: MoveTabRequest) => {
  const { tabId, targetIndex } = request;
  const tabs = get(tabsAtom);
  const tab = tabs.find((entry) => entry.id === tabId);
  if (!tab) return;

  const layout = get(splitLayoutAtom);
  if (!layout) {
    const fromIndex = tabs.findIndex((entry) => entry.id === tabId);
    const withoutTab = tabs.filter((entry) => entry.id !== tabId);
    const toIndex = Math.max(0, Math.min(targetIndex > fromIndex ? targetIndex - 1 : targetIndex, withoutTab.length));
    const nextTabs = [...withoutTab];
    nextTabs.splice(toIndex, 0, tab);
    set(tabsAtom, nextTabs);
    set(activeTabIdAtom, tabId);
    return;
  }

  const sourcePanel = layout.panels.find((panel) => panel.tabIds.includes(tabId));
  const targetPanel =
    layout.panels.find((panel) => panel.id === request.targetPaneId) ??
    layout.panels.find((panel) => panel.id === layout.focusedPane);
  if (!sourcePanel || !targetPanel) return;

  const fromIndex = sourcePanel.tabIds.indexOf(tabId);
  const sourceRemaining = sourcePanel.tabIds.filter((id) => id !== tabId);
  const samePanel = sourcePanel.id === targetPanel.id;
  const insertLimit = samePanel ? sourceRemaining.length : targetPanel.tabIds.length;
  const insertIndex = Math.max(0, Math.min(samePanel && targetIndex > fromIndex ? targetIndex - 1 : targetIndex, insertLimit));

  let nextPanels: TerminalPanel[];
  if (samePanel) {
    const nextTabIds = [...sourceRemaining];
    nextTabIds.splice(insertIndex, 0, tabId);
    nextPanels = layout.panels.map((panel) =>
      panel.id === sourcePanel.id ? { ...panel, tabIds: nextTabIds, activeTabId: tabId } : panel,
    );
  } else {
    const nextTargetTabIds = [...targetPanel.tabIds];
    nextTargetTabIds.splice(insertIndex, 0, tabId);
    nextPanels = layout.panels
      .map((panel) => {
        if (panel.id === sourcePanel.id) return { ...panel, tabIds: sourceRemaining, activeTabId: sourceRemaining[0] ?? null };
        if (panel.id === targetPanel.id) return { ...panel, tabIds: nextTargetTabIds, activeTabId: tabId };
        return panel;
      })
      .filter((panel) => panel.tabIds.length > 0);
  }

  if (nextPanels.length === 1) {
    set(tabsAtom, orderTabsByPanel(tabs, nextPanels[0]));
    set(splitLayoutAtom, null);
    set(activeTabIdAtom, tabId);
    return;
  }

  set(splitLayoutAtom, { panels: normalizePanels(nextPanels), focusedPane: targetPanel.id });
  set(activeTabIdAtom, tabId);
});

export const setTabPortsAtom = atom(null, (get, set, tabId: string, ports: number[]) => {
  const tabs = get(tabsAtom);
  if (!tabs.some((tab) => tab.id === tabId)) return;
  set(tabsAtom, tabs.map((tab) => (tab.id === tabId ? { ...tab, ports } : tab)));
});

export const renameTabAtom = atom(null, (get, set, tabId: string, title: string) => {
  const tabs = get(tabsAtom);
  const tab = tabs.find((entry) => entry.id === tabId);
  if (!tab) return;

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  set(
    tabsAtom,
    tabs.map((entry) => (entry.id === tabId ? { ...entry, title: trimmedTitle } : entry)),
  );
});

export const activateRelativeTabAtom = atom(null, (get, set, direction: 1 | -1) => {
  const layout = get(splitLayoutAtom);
  const focusedPanel = layout ? layout.panels.find((panel) => panel.id === layout.focusedPane) : undefined;
  const tabIds = focusedPanel ? focusedPanel.tabIds : get(tabsAtom).map((tab) => tab.id);
  if (tabIds.length === 0) return;

  const currentIndex = tabIds.findIndex((tabId) => tabId === get(activeTabIdAtom));
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + tabIds.length) % tabIds.length;
  const nextTabId = tabIds[nextIndex];
  if (!layout || !focusedPanel) {
    set(activeTabIdAtom, nextTabId);
    return;
  }

  set(splitLayoutAtom, {
    ...layout,
    panels: layout.panels.map((panel) => (panel.id === focusedPanel.id ? { ...panel, activeTabId: nextTabId } : panel)),
  });
  set(activeTabIdAtom, nextTabId);
});
