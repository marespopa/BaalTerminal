import { atomWithStorage } from 'jotai/utils';

export type Theme = 'dark' | 'light';

export const themeAtom = atomWithStorage<Theme>('baal-terminal-theme', 'dark');

export const terminalThemes = {
  dark: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    selectionBackground: '#264f78',
  },
  light: {
    background: '#fafafa',
    foreground: '#24292f',
    cursor: '#24292f',
    selectionBackground: '#add6ff',
  },
} as const;