import { BrowserWindow, WebContents, ipcMain } from 'electron';
import * as pty from 'node-pty';
import treeKill from 'tree-kill';
import { resolveEnvironment, resolveShell, resolveWorkingDirectory } from './environment';
import { sanitizeOutput } from './sanitizer';

const TAB_ID_PATTERN = /^tab-[a-z0-9-]+$/i;
const MAX_INPUT_LENGTH = 1024 * 1024;
const MAX_HISTORY_LENGTH = 200_000;
// Secrets can straddle chunk boundaries (e.g. a token split across two PTY writes), so the
// tail is re-sanitized together with each new chunk instead of being committed immediately.
const SANITIZER_TAIL_LENGTH = 4_096;

export interface TerminalSessionInfo {
  id: string;
  pid: number;
  cwd: string;
  ports: number[];
}

interface ManagedSession {
  pty: pty.IPty;
  cwd: string;
  ports: Set<number>;
  sanitizedOutput: string;
  unsanitizedTail: string;
}

function detectPorts(output: string): number[] {
  const ports = new Set<number>();
  for (const match of output.matchAll(/(?:https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])|(?:listening|port)\s*(?:on)?\s*[:=]?)\s*(\d{2,5})/gi)) {
    const port = Number(match[1]);
    if (port >= 1 && port <= 65535) ports.add(port);
  }
  return [...ports];
}

function appendSanitizedOutput(session: ManagedSession, data: string): void {
  const combinedOutput = session.unsanitizedTail + data;
  const committedLength = Math.max(0, combinedOutput.length - SANITIZER_TAIL_LENGTH);
  const committedOutput = combinedOutput.slice(0, committedLength);
  session.unsanitizedTail = combinedOutput.slice(committedLength);
  session.sanitizedOutput = (session.sanitizedOutput + sanitizeOutput(committedOutput)).slice(-MAX_HISTORY_LENGTH);
}

function isValidTabId(tabId: unknown): tabId is string {
  return typeof tabId === 'string' && TAB_ID_PATTERN.test(tabId);
}

function assertTabId(tabId: unknown): asserts tabId is string {
  if (!isValidTabId(tabId)) {
    throw new Error('Invalid tab ID');
  }
}

function assertDimensions(cols: unknown, rows: unknown): void {
  if (typeof cols !== 'number' || typeof rows !== 'number'
    || !Number.isInteger(cols) || !Number.isInteger(rows)
    || cols < 1 || rows < 1 || cols > 1000 || rows > 500) {
    throw new Error('Invalid terminal dimensions');
  }
}

interface CreateTerminalOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
}

function assertCreateOptions(options: unknown): asserts options is CreateTerminalOptions | undefined {
  if (options === undefined) return;
  if (typeof options !== 'object' || options === null) {
    throw new Error('Invalid create options');
  }
  const { cols, rows, cwd } = options as Partial<CreateTerminalOptions>;
  if (cols !== undefined && (typeof cols !== 'number' || !Number.isInteger(cols) || cols < 1 || cols > 1000)) {
    throw new Error('Invalid cols dimension');
  }
  if (rows !== undefined && (typeof rows !== 'number' || !Number.isInteger(rows) || rows < 1 || rows > 500)) {
    throw new Error('Invalid rows dimension');
  }
  if (cwd !== undefined && typeof cwd !== 'string') {
    throw new Error('Invalid cwd');
  }
}

export class PtyManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private window: BrowserWindow | null;

  public constructor(window: BrowserWindow) {
    this.window = window;
    ipcMain.handle('terminal:create', (event, tabId: unknown, options: unknown) => {
      this.assertSender(event);
      assertTabId(tabId);
      assertCreateOptions(options);
      this.create(tabId, options);
    });
    ipcMain.on('terminal:input', (event, tabId: unknown, data: unknown) => {
      if (!this.isSender(event)) return;
      if (!isValidTabId(tabId)) return;
      if (typeof data !== 'string' || data.length > MAX_INPUT_LENGTH) return;
      this.write(tabId, data);
    });
    ipcMain.on('terminal:resize', (event, tabId: unknown, cols: unknown, rows: unknown) => {
      if (!this.isSender(event)) return;
      if (!isValidTabId(tabId)) return;
      assertDimensions(cols, rows);
      this.resize(tabId, cols as number, rows as number);
    });
    ipcMain.on('terminal:destroy', (event, tabId: unknown) => {
      if (!this.isSender(event)) return;
      if (!isValidTabId(tabId)) return;
      this.destroy(tabId);
    });
  }

  public setWindow(window: BrowserWindow | null): void {
    this.window = window;
  }

  private isSender(event: { sender: WebContents }): boolean {
    return this.window !== null && event.sender === this.window.webContents;
  }

  private assertSender(event: { sender: WebContents }): void {
    if (!this.isSender(event)) throw new Error('Unauthorized terminal request');
  }

  private create(tabId: string, options?: CreateTerminalOptions): void {
    if (this.sessions.has(tabId)) return;
    const session = pty.spawn(resolveShell(), [], {
      name: 'xterm-256color',
      cols: options?.cols ?? 80,
      rows: options?.rows ?? 24,
      cwd: options?.cwd ?? resolveWorkingDirectory(),
      env: resolveEnvironment(),
    });
    const managedSession: ManagedSession = {
      pty: session,
      cwd: options?.cwd ?? resolveWorkingDirectory(),
      ports: new Set(),
      sanitizedOutput: '',
      unsanitizedTail: '',
    };
    this.sessions.set(tabId, managedSession);
    session.onData((data) => {
      appendSanitizedOutput(managedSession, data);
      const discoveredPorts = detectPorts(data).filter((port) => !managedSession.ports.has(port));
      if (discoveredPorts.length > 0) {
        discoveredPorts.forEach((port) => managedSession.ports.add(port));
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send(`terminal:ports:${tabId}`, [...managedSession.ports].sort((a, b) => a - b));
        }
      }
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(`terminal:output:${tabId}`, data);
      }
    });
    session.onExit(({ exitCode }) => {
      this.sessions.delete(tabId);
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(`terminal:exit:${tabId}`, exitCode);
      }
    });
  }

  private write(tabId: string, data: string): void {
    this.sessions.get(tabId)?.pty.write(data);
  }

  private resize(tabId: string, cols: number, rows: number): void {
    this.sessions.get(tabId)?.pty.resize(cols, rows);
  }

  private destroy(tabId: string): void {
    const session = this.sessions.get(tabId);
    if (!session) return;
    this.sessions.delete(tabId);
    treeKill(session.pty.pid, 'SIGTERM', () => session.pty.kill());
  }

  public listSessions(): TerminalSessionInfo[] {
    return [...this.sessions.entries()].map(([id, session]) => ({
      id,
      pid: session.pty.pid,
      cwd: session.cwd,
      ports: [...session.ports].sort((a, b) => a - b),
    }));
  }

  public getSanitizedOutput(tabId: string): string | undefined {
    const session = this.sessions.get(tabId);
    if (!session) return undefined;
    return (session.sanitizedOutput + sanitizeOutput(session.unsanitizedTail)).slice(-MAX_HISTORY_LENGTH);
  }

  public executeCommand(tabId: string, command: string): void {
    assertTabId(tabId);
    if (typeof command !== 'string' || command.length === 0 || command.length > MAX_INPUT_LENGTH) {
      throw new Error('Invalid command');
    }
    const session = this.sessions.get(tabId);
    if (!session) throw new Error('Terminal tab not found');
    session.pty.write(`${command}\r`);
  }

  public destroyAll(): void {
    for (const tabId of this.sessions.keys()) this.destroy(tabId);
  }
}