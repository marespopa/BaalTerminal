import { atom } from 'jotai';
import type { AppSettings } from '../../preload/types';

export const settingsAtom = atom<AppSettings>({
  defaultCwd: '',
  editorCommand: 'nvim',
  shellOverride: '',
  shellArgs: '',
  fontFamily: '"JetBrainsMono Nerd Font", "FiraCode Nerd Font", "JetBrains Mono", "Fira Code", monospace',
  fontSize: 14,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  confirmBeforeClose: false,
  mcpEnabled: true,
});

export const loadSettingsAtom = atom(null, async (_get, set) => {
  set(settingsAtom, await window.settings.get());
});

export const updateSettingsAtom = atom(null, async (get, set, patch: Partial<AppSettings>) => {
  const next = { ...get(settingsAtom), ...patch };
  set(settingsAtom, next);
  await window.settings.set(next);
});
