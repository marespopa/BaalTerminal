import { BrowserWindow, WebContents, dialog, ipcMain } from 'electron';
import { stat } from 'fs/promises';
import path from 'path';

export interface PickPathResult {
  path: string;
  isDirectory: boolean;
  dirName: string;
  baseName: string;
  /** Path quoted for safe interpolation into a shell command on this platform. */
  quotedPath: string;
}

/** Quotes a path for the platform's default shell (cmd.exe on Windows, POSIX shells elsewhere). */
function quotePathForShell(target: string): string {
  if (process.platform === 'win32') {
    return `"${target.replace(/"/g, '')}"`;
  }
  return `'${target.replace(/'/g, "'\\''")}'`;
}

export class PathPickerDialog {
  private window: BrowserWindow | null;

  public constructor(window: BrowserWindow) {
    this.window = window;

    ipcMain.handle('path-picker:pick-file', async (event) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      return this.pick(['openFile']);
    });
    ipcMain.handle('path-picker:pick-folder', async (event) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      return this.pick(['openDirectory']);
    });
  }

  public setWindow(window: BrowserWindow | null): void {
    this.window = window;
  }

  private isSender(event: { sender: WebContents }): boolean {
    return this.window !== null && event.sender === this.window.webContents;
  }

  private async pick(properties: Array<'openFile' | 'openDirectory'>): Promise<PickPathResult | null> {
    if (!this.window) return null;
    const result = await dialog.showOpenDialog(this.window, { properties });
    if (result.canceled || result.filePaths.length === 0) return null;

    const selectedPath = result.filePaths[0];
    const isDirectory = (await stat(selectedPath)).isDirectory();
    return {
      path: selectedPath,
      isDirectory,
      dirName: isDirectory ? selectedPath : path.dirname(selectedPath),
      baseName: path.basename(selectedPath),
      quotedPath: quotePathForShell(selectedPath),
    };
  }
}
