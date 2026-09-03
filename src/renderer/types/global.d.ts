import type { BookmarksApi, SnippetsApi, TerminalApi, AppWindowApi, SettingsApi } from '../../preload/types';

declare global {
  interface Window {
    terminal: TerminalApi;
    appWindow: AppWindowApi;
    bookmarks: BookmarksApi;
    snippets: SnippetsApi;
    settings: SettingsApi;
  }
}

export {};
