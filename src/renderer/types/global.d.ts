import type { BookmarksApi, SnippetsApi, TerminalApi, AppWindowApi, SettingsApi, PathPickerApi, ShellOpenerApi } from '../../preload/types';

declare global {
  interface Window {
    terminal: TerminalApi;
    appWindow: AppWindowApi;
    bookmarks: BookmarksApi;
    snippets: SnippetsApi;
    settings: SettingsApi;
    pathPicker: PathPickerApi;
    shellOpener: ShellOpenerApi;
  }
}

export {};
