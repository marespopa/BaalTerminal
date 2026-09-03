import { atom } from 'jotai';
import type { Bookmark } from '../../preload/types';

export const bookmarksAtom = atom<Bookmark[]>([]);

export const loadBookmarksAtom = atom(null, async (_get, set) => {
  set(bookmarksAtom, await window.bookmarks.list());
});

export const addBookmarkAtom = atom(null, async (get, set, params: { label: string; path: string }) => {
  const bookmark = await window.bookmarks.add(params.label, params.path);
  set(bookmarksAtom, [...get(bookmarksAtom), bookmark]);
});

export const removeBookmarkAtom = atom(null, async (get, set, id: string) => {
  await window.bookmarks.remove(id);
  set(bookmarksAtom, get(bookmarksAtom).filter((bookmark) => bookmark.id !== id));
});
