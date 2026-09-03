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

interface SplitLayout {
  primaryTabId: string;
  secondaryTabId: string;
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
    set(splitLayoutAtom, layout.focusedPane === 'primary' ? { ...layout, primaryTabId: id } : { ...layout, secondaryTabId: id });
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
    set(splitLayoutAtom, null);
    set(
      activeTabIdAtom,
      existingLayout.focusedPane === 'primary' ? existingLayout.primaryTabId : existingLayout.secondaryTabId,
    );
    return;
  }

  const tabs = get(tabsAtom);
  const primaryTabId = get(activeTabIdAtom) ?? tabs[0]?.id;
  if (!primaryTabId) return;

  let nextTabs = tabs;
  let secondaryTabId = tabs.find((tab) => tab.id !== primaryTabId)?.id;
  if (!secondaryTabId) {
    secondaryTabId = createTabId();
    nextTabs = [
      ...tabs,
      { id: secondaryTabId, title: getNextTabTitle(tabs), createdAt: Date.now() },
    ];
    set(tabsAtom, nextTabs);
  }

  set(splitLayoutAtom, { primaryTabId, secondaryTabId, focusedPane: 'primary' });
  set(activeTabIdAtom, primaryTabId);
});

export const focusPaneAtom = atom(null, (get, set, pane: PaneId) => {
  const layout = get(splitLayoutAtom);
  if (!layout) return;

  set(splitLayoutAtom, { ...layout, focusedPane: pane });
  set(activeTabIdAtom, pane === 'primary' ? layout.primaryTabId : layout.secondaryTabId);
});

export const closeTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(tabsAtom);
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;

  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  set(tabsAtom, nextTabs);

  const layout = get(splitLayoutAtom);
  if (layout && (layout.primaryTabId === tabId || layout.secondaryTabId === tabId)) {
    const remainingTabId = layout.primaryTabId === tabId ? layout.secondaryTabId : layout.primaryTabId;
    set(splitLayoutAtom, null);
    set(activeTabIdAtom, remainingTabId);
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

  if (tabId === layout.primaryTabId) {
    set(splitLayoutAtom, { ...layout, focusedPane: 'primary' });
  } else if (tabId === layout.secondaryTabId) {
    set(splitLayoutAtom, { ...layout, focusedPane: 'secondary' });
  } else if (layout.focusedPane === 'primary') {
    set(splitLayoutAtom, { ...layout, primaryTabId: tabId });
  } else {
    set(splitLayoutAtom, { ...layout, secondaryTabId: tabId });
  }
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
  const tabs = get(tabsAtom);
  if (tabs.length === 0) return;

  const currentIndex = tabs.findIndex((tab) => tab.id === get(activeTabIdAtom));
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + tabs.length) % tabs.length;
  const nextTabId = tabs[nextIndex].id;
  const layout = get(splitLayoutAtom);
  if (!layout) {
    set(activeTabIdAtom, nextTabId);
    return;
  }

  if (nextTabId === layout.primaryTabId) {
    set(splitLayoutAtom, { ...layout, focusedPane: 'primary' });
  } else if (nextTabId === layout.secondaryTabId) {
    set(splitLayoutAtom, { ...layout, focusedPane: 'secondary' });
  } else if (layout.focusedPane === 'primary') {
    set(splitLayoutAtom, { ...layout, primaryTabId: nextTabId });
  } else {
    set(splitLayoutAtom, { ...layout, secondaryTabId: nextTabId });
  }
  set(activeTabIdAtom, nextTabId);
});
