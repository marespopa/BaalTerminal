import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, AppWindowApi, BookmarksApi, CreateTerminalOptions, PathPickerApi, SettingsApi, ShellOpenerApi, SnippetsApi, TerminalApi } from './types';

const MAX_LABEL_LENGTH = 200;
const MAX_VALUE_LENGTH = 20_000;

function validText(value: string, name: string, maxLength: number): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new TypeError(`Invalid ${name}`);
  }
}

const TAB_ID_PATTERN = /^tab-[a-z0-9-]+$/i;

const validTabId = (tabId: string): void => {
  if (!TAB_ID_PATTERN.test(tabId)) throw new Error('Invalid tab ID');
};

function validateCreateOptions(options: unknown): CreateTerminalOptions | undefined {
  if (options === undefined) return undefined;
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('Invalid create options: expected object');
  }

  const { cols, rows, cwd, shellOverride, shellArgs } = options as Partial<CreateTerminalOptions>;

  if (cols !== undefined && (typeof cols !== 'number' || !Number.isInteger(cols) || cols <= 0)) {
    throw new TypeError(`Invalid cols dimension: ${cols}`);
  }
  if (rows !== undefined && (typeof rows !== 'number' || !Number.isInteger(rows) || rows <= 0)) {
    throw new TypeError(`Invalid rows dimension: ${rows}`);
  }
  if (cwd !== undefined && typeof cwd !== 'string') {
    throw new TypeError('Invalid cwd: expected string');
  }
  if (shellOverride !== undefined && typeof shellOverride !== 'string') {
    throw new TypeError('Invalid shellOverride: expected string');
  }
  if (shellArgs !== undefined && (!Array.isArray(shellArgs) || shellArgs.some((arg) => typeof arg !== 'string'))) {
    throw new TypeError('Invalid shellArgs: expected string array');
  }

  return { cols, rows, cwd, shellOverride, shellArgs };
}

const api: TerminalApi = {
  create: async (tabId, options) => {
    validTabId(tabId);
    const validated = validateCreateOptions(options);
    await ipcRenderer.invoke('terminal:create', tabId, validated);
  },
  input: (tabId, data) => { validTabId(tabId); if (typeof data !== 'string') throw new TypeError('Input must be text'); ipcRenderer.send('terminal:input', tabId, data); },
  resize: (tabId, cols, rows) => { validTabId(tabId); ipcRenderer.send('terminal:resize', tabId, cols, rows); },
  destroy: (tabId) => { validTabId(tabId); ipcRenderer.send('terminal:destroy', tabId); },
  onOutput: (tabId, listener) => {
    validTabId(tabId);
    const channel = `terminal:output:${tabId}`;
    const handler = (_event: Electron.IpcRendererEvent, data: string) => listener(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onPorts: (tabId, listener) => {
    validTabId(tabId);
    const channel = `terminal:ports:${tabId}`;
    const handler = (_event: Electron.IpcRendererEvent, ports: number[]) => listener(ports);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onExit: (tabId, listener) => {
    validTabId(tabId);
    const channel = `terminal:exit:${tabId}`;
    const handler = (_event: Electron.IpcRendererEvent, exitCode: number) => listener(exitCode);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('terminal', api);

const appWindowApi: AppWindowApi = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => listener(isMaximized);
    ipcRenderer.on('window:maximized-change', handler);
    return () => ipcRenderer.removeListener('window:maximized-change', handler);
  },
};

contextBridge.exposeInMainWorld('appWindow', appWindowApi);

const bookmarksApi: BookmarksApi = {
  list: () => ipcRenderer.invoke('bookmarks:list'),
  add: (label, bookmarkPath) => {
    validText(label, 'label', MAX_LABEL_LENGTH);
    validText(bookmarkPath, 'path', MAX_VALUE_LENGTH);
    return ipcRenderer.invoke('bookmarks:add', label, bookmarkPath);
  },
  remove: (id) => {
    validText(id, 'id', MAX_LABEL_LENGTH);
    return ipcRenderer.invoke('bookmarks:remove', id);
  },
};

contextBridge.exposeInMainWorld('bookmarks', bookmarksApi);

const snippetsApi: SnippetsApi = {
  list: () => ipcRenderer.invoke('snippets:list'),
  add: (label, text) => {
    validText(label, 'label', MAX_LABEL_LENGTH);
    validText(text, 'text', MAX_VALUE_LENGTH);
    return ipcRenderer.invoke('snippets:add', label, text);
  },
  remove: (id) => {
    validText(id, 'id', MAX_LABEL_LENGTH);
    return ipcRenderer.invoke('snippets:remove', id);
  },
};

contextBridge.exposeInMainWorld('snippets', snippetsApi);

const settingsApi: SettingsApi = {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (settings: AppSettings) => {
    if (typeof settings !== 'object' || settings === null || typeof settings.defaultCwd !== 'string') {
      throw new TypeError('Invalid settings');
    }
    if (settings.defaultCwd.length > MAX_VALUE_LENGTH) {
      throw new TypeError('Invalid defaultCwd');
    }
    if (typeof settings.editorCommand !== 'string' || settings.editorCommand.length > MAX_VALUE_LENGTH) {
      throw new TypeError('Invalid editorCommand');
    }
    if (typeof settings.shellOverride !== 'string' || settings.shellOverride.length > MAX_VALUE_LENGTH) {
      throw new TypeError('Invalid shellOverride');
    }
    if (typeof settings.shellArgs !== 'string' || settings.shellArgs.length > MAX_VALUE_LENGTH) {
      throw new TypeError('Invalid shellArgs');
    }
    if (typeof settings.fontFamily !== 'string' || settings.fontFamily.length > MAX_VALUE_LENGTH) {
      throw new TypeError('Invalid fontFamily');
    }
    if (typeof settings.fontSize !== 'number' || !Number.isFinite(settings.fontSize)) {
      throw new TypeError('Invalid fontSize');
    }
    if (!['block', 'underline', 'bar'].includes(settings.cursorStyle)) {
      throw new TypeError('Invalid cursorStyle');
    }
    if (typeof settings.cursorBlink !== 'boolean') {
      throw new TypeError('Invalid cursorBlink');
    }
    if (typeof settings.scrollback !== 'number' || !Number.isInteger(settings.scrollback)) {
      throw new TypeError('Invalid scrollback');
    }
    if (typeof settings.confirmBeforeClose !== 'boolean') {
      throw new TypeError('Invalid confirmBeforeClose');
    }
    if (typeof settings.mcpEnabled !== 'boolean') {
      throw new TypeError('Invalid mcpEnabled');
    }
    return ipcRenderer.invoke('settings:set', settings);
  },
};

contextBridge.exposeInMainWorld('settings', settingsApi);

const pathPickerApi: PathPickerApi = {
  pickFile: () => ipcRenderer.invoke('path-picker:pick-file'),
  pickFolder: () => ipcRenderer.invoke('path-picker:pick-folder'),
};

contextBridge.exposeInMainWorld('pathPicker', pathPickerApi);

const shellOpenerApi: ShellOpenerApi = {
  openPath: (path) => {
    validText(path, 'path', MAX_VALUE_LENGTH);
    return ipcRenderer.invoke('shell:open-path', path);
  },
};

contextBridge.exposeInMainWorld('shellOpener', shellOpenerApi);