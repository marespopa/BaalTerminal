import { BrowserWindow, WebContents, ipcMain } from 'electron';

export class WindowControls {
  private window: BrowserWindow | null;

  public constructor(window: BrowserWindow) {
    this.window = window;
    ipcMain.on('window:minimize', (event) => {
      if (!this.isSender(event)) return;
      this.window?.minimize();
    });
    ipcMain.on('window:maximize', (event) => {
      if (!this.isSender(event)) return;
      if (this.window?.isMaximized()) {
        this.window.unmaximize();
      } else {
        this.window?.maximize();
      }
    });
    ipcMain.on('window:close', (event) => {
      if (!this.isSender(event)) return;
      this.window?.close();
    });
  }

  public setWindow(window: BrowserWindow | null): void {
    this.window = window;
  }

  public notifyMaximizedChange(isMaximized: boolean): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('window:maximized-change', isMaximized);
    }
  }

  private isSender(event: { sender: WebContents }): boolean {
    return this.window !== null && event.sender === this.window.webContents;
  }
}
