import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, AppWindowApi, BookmarksApi, CreateTerminalOptions, SettingsApi, SnippetsApi, TerminalApi } from './types';

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

  const { cols, rows, cwd } = options as Partial<CreateTerminalOptions>;

  if (cols !== undefined && (typeof cols !== 'number' || !Number.isInteger(cols) || cols <= 0)) {
    throw new TypeError(`Invalid cols dimension: ${cols}`);
  }
  if (rows !== undefined && (typeof rows !== 'number' || !Number.isInteger(rows) || rows <= 0)) {
    throw new TypeError(`Invalid rows dimension: ${rows}`);
  }
  if (cwd !== undefined && typeof cwd !== 'string') {
    throw new TypeError('Invalid cwd: expected string');
  }

  return { cols, rows, cwd };
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
    return ipcRenderer.invoke('settings:set', settings);
  },
};

contextBridge.exposeInMainWorld('settings', settingsApi);