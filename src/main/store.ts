import { BrowserWindow, WebContents, app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const MAX_LABEL_LENGTH = 200;
const MAX_VALUE_LENGTH = 20_000;

function assertText(value: unknown, name: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`Invalid ${name}`);
  }
}

/** Generic JSON-file-backed list store shared by bookmarks and snippets, persisted under userData. */
abstract class JsonListStore<TItem extends { id: string }> {
  private window: BrowserWindow | null;
  private readonly filePath: string;
  private cache: TItem[] | null = null;

  protected constructor(window: BrowserWindow, fileName: string) {
    this.window = window;
    this.filePath = path.join(app.getPath('userData'), fileName);
  }

  public setWindow(window: BrowserWindow | null): void {
    this.window = window;
  }

  protected isSender(event: { sender: WebContents }): boolean {
    return this.window !== null && event.sender === this.window.webContents;
  }

  protected async list(): Promise<TItem[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.cache = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  protected async persist(items: TItem[]): Promise<void> {
    this.cache = items;
    const tempPath = `${this.filePath}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(items, null, 2), 'utf-8');
    await fs.rm(this.filePath, { force: true });
    await fs.rename(tempPath, this.filePath);
  }

  protected async add(item: TItem): Promise<TItem> {
    const items = await this.list();
    const next = [...items, item];
    await this.persist(next);
    return item;
  }

  protected async remove(id: string): Promise<void> {
    const items = await this.list();
    await this.persist(items.filter((item) => item.id !== id));
  }
}

export interface Bookmark {
  id: string;
  label: string;
  path: string;
}

export class BookmarksStore extends JsonListStore<Bookmark> {
  public constructor(window: BrowserWindow) {
    super(window, 'bookmarks.json');

    ipcMain.handle('bookmarks:list', (event) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      return this.list();
    });
    ipcMain.handle('bookmarks:add', (event, label: unknown, bookmarkPath: unknown) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      assertText(label, 'label', MAX_LABEL_LENGTH);
      assertText(bookmarkPath, 'path', MAX_VALUE_LENGTH);
      return this.add({ id: randomUUID(), label, path: bookmarkPath });
    });
    ipcMain.handle('bookmarks:remove', (event, id: unknown) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      assertText(id, 'id', MAX_LABEL_LENGTH);
      return this.remove(id);
    });
  }
}

export interface Snippet {
  id: string;
  label: string;
  text: string;
}

export class SnippetsStore extends JsonListStore<Snippet> {
  public constructor(window: BrowserWindow) {
    super(window, 'snippets.json');

    ipcMain.handle('snippets:list', (event) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      return this.list();
    });
    ipcMain.handle('snippets:add', (event, label: unknown, text: unknown) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      assertText(label, 'label', MAX_LABEL_LENGTH);
      assertText(text, 'text', MAX_VALUE_LENGTH);
      return this.add({ id: randomUUID(), label, text });
    });
    ipcMain.handle('snippets:remove', (event, id: unknown) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      assertText(id, 'id', MAX_LABEL_LENGTH);
      return this.remove(id);
    });
  }
}

export interface AppSettings {
  defaultCwd: string;
  editorCommand: string;
  shellOverride: string;
  shellArgs: string;
  fontFamily: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  confirmBeforeClose: boolean;
  mcpEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
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
};

/** Single JSON-object-backed settings file, persisted under userData. */
export class SettingsStore {
  private window: BrowserWindow | null;
  private readonly filePath: string;
  private cache: AppSettings | null = null;

  public constructor(window: BrowserWindow) {
    this.window = window;
    this.filePath = path.join(app.getPath('userData'), 'settings.json');

    ipcMain.handle('settings:get', (event) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      return this.get();
    });
    ipcMain.handle('settings:set', (event, settings: unknown) => {
      if (!this.isSender(event)) throw new Error('Unauthorized');
      return this.set(this.validate(settings));
    });
  }

  public setWindow(window: BrowserWindow | null): void {
    this.window = window;
  }

  private isSender(event: { sender: WebContents }): boolean {
    return this.window !== null && event.sender === this.window.webContents;
  }

  private validate(settings: unknown): AppSettings {
    if (typeof settings !== 'object' || settings === null) {
      throw new Error('Invalid settings');
    }
    const {
      defaultCwd,
      editorCommand,
      shellOverride,
      shellArgs,
      fontFamily,
      fontSize,
      cursorStyle,
      cursorBlink,
      scrollback,
      confirmBeforeClose,
      mcpEnabled,
    } = settings as Partial<AppSettings>;
    if (defaultCwd !== undefined && (typeof defaultCwd !== 'string' || defaultCwd.length > MAX_VALUE_LENGTH)) {
      throw new Error('Invalid defaultCwd');
    }
    if (editorCommand !== undefined && (typeof editorCommand !== 'string' || editorCommand.length > MAX_VALUE_LENGTH)) {
      throw new Error('Invalid editorCommand');
    }
    if (shellOverride !== undefined && (typeof shellOverride !== 'string' || shellOverride.length > MAX_VALUE_LENGTH)) {
      throw new Error('Invalid shellOverride');
    }
    if (shellArgs !== undefined && (typeof shellArgs !== 'string' || shellArgs.length > MAX_VALUE_LENGTH)) {
      throw new Error('Invalid shellArgs');
    }
    if (fontFamily !== undefined && (typeof fontFamily !== 'string' || fontFamily.length > MAX_VALUE_LENGTH)) {
      throw new Error('Invalid fontFamily');
    }
    if (fontSize !== undefined && (typeof fontSize !== 'number' || !Number.isFinite(fontSize) || fontSize < 6 || fontSize > 72)) {
      throw new Error('Invalid fontSize');
    }
    if (cursorStyle !== undefined && !['block', 'underline', 'bar'].includes(cursorStyle)) {
      throw new Error('Invalid cursorStyle');
    }
    if (cursorBlink !== undefined && typeof cursorBlink !== 'boolean') {
      throw new Error('Invalid cursorBlink');
    }
    if (scrollback !== undefined && (typeof scrollback !== 'number' || !Number.isInteger(scrollback) || scrollback < 0 || scrollback > 1_000_000)) {
      throw new Error('Invalid scrollback');
    }
    if (confirmBeforeClose !== undefined && typeof confirmBeforeClose !== 'boolean') {
      throw new Error('Invalid confirmBeforeClose');
    }
    if (mcpEnabled !== undefined && typeof mcpEnabled !== 'boolean') {
      throw new Error('Invalid mcpEnabled');
    }
    return {
      defaultCwd: defaultCwd ?? '',
      editorCommand: editorCommand?.trim() || 'nvim',
      shellOverride: shellOverride ?? '',
      shellArgs: shellArgs ?? '',
      fontFamily: fontFamily?.trim() || DEFAULT_SETTINGS.fontFamily,
      fontSize: fontSize ?? DEFAULT_SETTINGS.fontSize,
      cursorStyle: cursorStyle ?? DEFAULT_SETTINGS.cursorStyle,
      cursorBlink: cursorBlink ?? DEFAULT_SETTINGS.cursorBlink,
      scrollback: scrollback ?? DEFAULT_SETTINGS.scrollback,
      confirmBeforeClose: confirmBeforeClose ?? false,
      mcpEnabled: mcpEnabled ?? true,
    };
  }

  /** Reads persisted settings without going through the IPC sender check, for main-process startup decisions. */
  public async getSettings(): Promise<AppSettings> {
    return this.get();
  }

  private async get(): Promise<AppSettings> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.cache = this.validate(parsed);
    } catch {
      this.cache = DEFAULT_SETTINGS;
    }
    return this.cache;
  }

  private async set(settings: AppSettings): Promise<AppSettings> {
    this.cache = settings;
    const tempPath = `${this.filePath}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf-8');
    await fs.rm(this.filePath, { force: true });
    await fs.rename(tempPath, this.filePath);
    return settings;
  }
}

