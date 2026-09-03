import { atom } from 'jotai';
import type { Snippet } from '../../preload/types';

export const snippetsAtom = atom<Snippet[]>([]);

export const loadSnippetsAtom = atom(null, async (_get, set) => {
  set(snippetsAtom, await window.snippets.list());
});

export const addSnippetAtom = atom(null, async (get, set, params: { label: string; text: string }) => {
  const snippet = await window.snippets.add(params.label, params.text);
  set(snippetsAtom, [...get(snippetsAtom), snippet]);
});

export const removeSnippetAtom = atom(null, async (get, set, id: string) => {
  await window.snippets.remove(id);
  set(snippetsAtom, get(snippetsAtom).filter((snippet) => snippet.id !== id));
});
