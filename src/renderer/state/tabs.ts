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

export type PaneId = 'primary' | 'secondary';

interface TerminalPanel {
  tabIds: string[];
  activeTabId: string | null;
}

interface SplitLayout {
  primary: TerminalPanel;
  secondary: TerminalPanel;
  focusedPane: PaneId;
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
// Fraction of the split width given to the primary pane (0.1 - 0.9).
export const splitRatioAtom = atom<number>(0.5);

export const activeTabAtom = atom((get) => {
  const activeId = get(activeTabIdAtom);
  return get(tabsAtom).find((tab) => tab.id === activeId) ?? null;
});

export const focusedPanelTabIdsAtom = atom((get) => {
  const layout = get(splitLayoutAtom);
  if (!layout) return get(tabsAtom).map((tab) => tab.id);
  return layout[layout.focusedPane].tabIds;
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
    const panel = layout[layout.focusedPane];
    set(splitLayoutAtom, {
      ...layout,
      [layout.focusedPane]: { tabIds: [...panel.tabIds, id], activeTabId: id },
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

export const toggleSplitAtom = atom(null, (get, set) => {
  const existingLayout = get(splitLayoutAtom);
  if (existingLayout) {
    const focusedPanel = existingLayout[existingLayout.focusedPane];
    const tabIds = [...existingLayout.primary.tabIds, ...existingLayout.secondary.tabIds];
    const tabsById = new Map(get(tabsAtom).map((tab) => [tab.id, tab]));
    set(tabsAtom, tabIds.map((tabId) => tabsById.get(tabId)).filter((tab): tab is TerminalTabMeta => tab !== undefined));
    set(splitLayoutAtom, null);
    set(activeTabIdAtom, focusedPanel.activeTabId);
    return;
  }

  const tabs = get(tabsAtom);
  const primaryTabId = get(activeTabIdAtom) ?? tabs[0]?.id;
  if (!primaryTabId) return;

  const secondaryTabId = createTabId();
  set(tabsAtom, [...tabs, { id: secondaryTabId, title: getNextTabTitle(tabs), createdAt: Date.now() }]);
  set(splitLayoutAtom, {
    primary: { tabIds: tabs.map((tab) => tab.id), activeTabId: primaryTabId },
    secondary: { tabIds: [secondaryTabId], activeTabId: secondaryTabId },
    focusedPane: 'primary',
  });
  set(activeTabIdAtom, primaryTabId);
});

export const focusPaneAtom = atom(null, (get, set, pane: PaneId) => {
  const layout = get(splitLayoutAtom);
  if (!layout) return;

  set(splitLayoutAtom, { ...layout, focusedPane: pane });
  set(activeTabIdAtom, layout[pane].activeTabId);
});

export const closeTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(tabsAtom);
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;

  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  set(tabsAtom, nextTabs);

  const layout = get(splitLayoutAtom);
  if (layout) {
    const pane = layout.primary.tabIds.includes(tabId) ? 'primary' : layout.secondary.tabIds.includes(tabId) ? 'secondary' : null;
    if (!pane) return;

    const panel = layout[pane];
    const remainingTabIds = panel.tabIds.filter((id) => id !== tabId);
    if (remainingTabIds.length === 0) {
      const otherPane: PaneId = pane === 'primary' ? 'secondary' : 'primary';
      const otherPanel = layout[otherPane];
      set(tabsAtom, nextTabs.filter((tab) => otherPanel.tabIds.includes(tab.id)));
      set(splitLayoutAtom, null);
      set(activeTabIdAtom, otherPanel.activeTabId);
      return;
    }

    const panelIndex = panel.tabIds.indexOf(tabId);
    const activeTabId = panel.activeTabId === tabId
      ? remainingTabIds[Math.min(panelIndex, remainingTabIds.length - 1)]
      : panel.activeTabId;
    const nextLayout = { ...layout, [pane]: { tabIds: remainingTabIds, activeTabId } };
    set(splitLayoutAtom, nextLayout);
    if (layout.focusedPane === pane) set(activeTabIdAtom, activeTabId);
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

  const pane: PaneId | null = layout.primary.tabIds.includes(tabId)
    ? 'primary'
    : layout.secondary.tabIds.includes(tabId)
      ? 'secondary'
      : null;
  if (!pane) return;
  set(splitLayoutAtom, { ...layout, focusedPane: pane, [pane]: { ...layout[pane], activeTabId: tabId } });
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
  const tabIds = layout ? layout[layout.focusedPane].tabIds : get(tabsAtom).map((tab) => tab.id);
  if (tabIds.length === 0) return;

  const currentIndex = tabIds.findIndex((tabId) => tabId === get(activeTabIdAtom));
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + tabIds.length) % tabIds.length;
  const nextTabId = tabIds[nextIndex];
  if (!layout) {
    set(activeTabIdAtom, nextTabId);
    return;
  }

  const pane = layout.focusedPane;
  set(splitLayoutAtom, { ...layout, [pane]: { ...layout[pane], activeTabId: nextTabId } });
  set(activeTabIdAtom, nextTabId);
});
