import { atom } from 'jotai';

export type SidebarPanel = 'bookmarks' | 'snippets' | 'settings';

export const activePanelAtom = atom<SidebarPanel | null>(null);
export const sidebarWidthAtom = atom<number>(240);

export const toggleSidebarPanelAtom = atom(null, (get, set, panel: SidebarPanel) => {
  set(activePanelAtom, get(activePanelAtom) === panel ? null : panel);
});
