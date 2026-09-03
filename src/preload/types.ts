export interface CreateTerminalOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  shellOverride?: string;
  shellArgs?: string[];
}

export interface TerminalApi {
  create(tabId: string, options?: CreateTerminalOptions): Promise<void>;
  input(tabId: string, data: string): void;
  resize(tabId: string, cols: number, rows: number): void;
  destroy(tabId: string): void;
  onOutput(tabId: string, listener: (data: string) => void): () => void;
  onPorts(tabId: string, listener: (ports: number[]) => void): () => void;
  onExit(tabId: string, listener: (exitCode: number) => void): () => void;
}

export interface AppWindowApi {
  minimize(): void;
  maximize(): void;
  close(): void;
  onMaximizedChange(listener: (isMaximized: boolean) => void): () => void;
}

export interface Bookmark {
  id: string;
  label: string;
  path: string;
}

export interface Snippet {
  id: string;
  label: string;
  text: string;
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

export interface BookmarksApi {
  list(): Promise<Bookmark[]>;
  add(label: string, path: string): Promise<Bookmark>;
  remove(id: string): Promise<void>;
}

export interface SnippetsApi {
  list(): Promise<Snippet[]>;
  add(label: string, text: string): Promise<Snippet>;
  remove(id: string): Promise<void>;
}

export interface SettingsApi {
  get(): Promise<AppSettings>;
  set(settings: AppSettings): Promise<AppSettings>;
}

export interface PickPathResult {
  path: string;
  isDirectory: boolean;
  dirName: string;
  baseName: string;
  quotedPath: string;
}

export interface PathPickerApi {
  pickFile(): Promise<PickPathResult | null>;
  pickFolder(): Promise<PickPathResult | null>;
}

export interface ShellOpenerApi {
  openPath(path: string): Promise<void>;
}
