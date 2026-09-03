import { BrowserWindow, WebContents, ipcMain, shell } from 'electron';

const MAX_PATH_LENGTH = 20_000;

/** Opens a file with the OS's default associated application, bypassing the terminal entirely. */
export class ShellOpener {
  private window: BrowserWindow | null;

  public constructor(window: BrowserWindow) {
    this.window = window;

    ipcMain.handle('shell:open-path', async (event, targetPath: unknown) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      if (typeof targetPath !== 'string' || targetPath.length === 0 || targetPath.length > MAX_PATH_LENGTH) {
        throw new Error('Invalid path');
      }
      const error = await shell.openPath(targetPath);
      if (error) throw new Error(error);
    });
  }

  public setWindow(window: BrowserWindow | null): void {
    this.window = window;
  }

  private isSender(event: { sender: WebContents }): boolean {
    return this.window !== null && event.sender === this.window.webContents;
  }
}
