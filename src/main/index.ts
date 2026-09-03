import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { BaalMcpServer } from './mcp-server';
import { PtyManager } from './pty-manager';
import { WindowControls } from './window-controls';
import { BookmarksStore, SettingsStore, SnippetsStore } from './store';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let ptyManager: PtyManager | null = null;
let mcpServer: BaalMcpServer | null = null;
let windowControls: WindowControls | null = null;
let bookmarksStore: BookmarksStore | null = null;
let snippetsStore: SnippetsStore | null = null;
let settingsStore: SettingsStore | null = null;

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 360,
    height: 220,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    center: true,
    backgroundColor: '#1e1e1e',
    webPreferences: { sandbox: true },
  });
  void splash.loadFile(path.join(__dirname, '../../splash.html'));
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

function createWindow(): void {
  splashWindow = createSplashWindow();

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1e1e1e',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (ptyManager === null) {
    ptyManager = new PtyManager(mainWindow);
    mcpServer = new BaalMcpServer(ptyManager);
    void mcpServer.start().catch((error: unknown) => console.error('Unable to start MCP server:', error));
  } else {
    ptyManager.setWindow(mainWindow);
  }

  if (windowControls === null) {
    windowControls = new WindowControls(mainWindow);
  } else {
    windowControls.setWindow(mainWindow);
  }

  if (bookmarksStore === null) {
    bookmarksStore = new BookmarksStore(mainWindow);
  } else {
    bookmarksStore.setWindow(mainWindow);
  }

  if (snippetsStore === null) {
    snippetsStore = new SnippetsStore(mainWindow);
  } else {
    snippetsStore.setWindow(mainWindow);
  }

  if (settingsStore === null) {
    settingsStore = new SettingsStore(mainWindow);
  } else {
    settingsStore.setWindow(mainWindow);
  }

  if (!app.isPackaged) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    splashWindow?.close();
    splashWindow = null;
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    ptyManager?.destroyAll();
    ptyManager?.setWindow(null);
    windowControls?.setWindow(null);
    bookmarksStore?.setWindow(null);
    snippetsStore?.setWindow(null);
    settingsStore?.setWindow(null);
    mainWindow = null;
  });

  mainWindow.on('maximize', () => windowControls?.notifyMaximizedChange(true));
  mainWindow.on('unmaximize', () => windowControls?.notifyMaximizedChange(false));
}

// This is a terminal app; the default File/Edit/View/Window/Help menu has no wired-up actions.
Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);
app.on('before-quit', () => ptyManager?.destroyAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});