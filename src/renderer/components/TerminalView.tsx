import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import { useAtomValue, useSetAtom } from 'jotai';
import '@xterm/xterm/css/xterm.css';
import { setTabPortsAtom } from '../state/tabs';
import { settingsAtom } from '../state/settings';
import { terminalThemes, themeAtom } from '../state/theme';
import { TerminalContextMenu } from './TerminalContextMenu';

export interface TerminalViewProps {
  tabId: string;
  isActive: boolean;
  cwd?: string;
  initialCommand?: string;
  onFocus?: () => void;
}

/**
 * Mounts a single Xterm.js instance bound to one PTY session via the preload bridge.
 * Kept mounted for the lifetime of its tab so scrollback and TUI state survive tab switches.
 */
export function TerminalView({ tabId, isActive, cwd, initialCommand, onFocus }: TerminalViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const setTabPorts = useSetAtom(setTabPortsAtom);
  const theme = useAtomValue(themeAtom);
  const settings = useAtomValue(settingsAtom);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      scrollback: settings.scrollback,
      allowTransparency: false,
      theme: terminalThemes[theme],
      windowsMode: navigator.userAgent.includes('Windows'),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    // WebGL rendering can fail to initialize on some GPUs/drivers; fall back to the canvas renderer.
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch {
      term.loadAddon(new CanvasAddon());
    }

    term.open(container);
    fitAddonRef.current = fitAddon;
    termRef.current = term;

    // Intercept right-click in the capture phase, before it reaches xterm's own element:
    // xterm forwards right mousedown to mouse-tracking CLIs (breaking selection) and its
    // built-in contextmenu handler steals focus to a hidden textarea. Stopping propagation
    // here keeps the terminal selection intact so our own context menu can copy it.
    const handleNativeMouseDown = (event: MouseEvent) => {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleNativeContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ x: event.clientX, y: event.clientY, hasSelection: !!termRef.current?.hasSelection() });
    };
    container.addEventListener('mousedown', handleNativeMouseDown, true);
    container.addEventListener('contextmenu', handleNativeContextMenu, true);

    let disposed = false;
    const disposables: Array<() => void> = [];

    const inputDisposable = term.onData((data) => window.terminal.input(tabId, data));
    const resizeDisposable = term.onResize(({ cols, rows }) => window.terminal.resize(tabId, cols, rows));

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);

    fitAddon.fit();
    const shellArgs = settings.shellArgs.trim().length > 0 ? settings.shellArgs.trim().split(/\s+/) : undefined;
    void window.terminal
      .create(tabId, { cols: term.cols, rows: term.rows, cwd, shellOverride: settings.shellOverride || undefined, shellArgs })
      .then(() => {
        if (disposed) return;
        disposables.push(window.terminal.onOutput(tabId, (data) => term.write(data)));
        disposables.push(window.terminal.onPorts(tabId, (ports) => setTabPorts(tabId, ports)));
        disposables.push(
          window.terminal.onExit(tabId, () => {
            term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
          }),
        );
        if (initialCommand) window.terminal.input(tabId, `${initialCommand}\r`);
      });

    return () => {
      disposed = true;
      fitAddonRef.current = null;
      termRef.current = null;
      resizeObserver.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      disposables.forEach((dispose) => dispose());
      container.removeEventListener('mousedown', handleNativeMouseDown, true);
      container.removeEventListener('contextmenu', handleNativeContextMenu, true);
      window.terminal.destroy(tabId);
      term.dispose();
    };
  }, [tabId]);

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = terminalThemes[theme];
  }, [theme]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontFamily = settings.fontFamily;
    term.options.fontSize = settings.fontSize;
    term.options.cursorStyle = settings.cursorStyle;
    term.options.cursorBlink = settings.cursorBlink;
    term.options.scrollback = settings.scrollback;
    fitAddonRef.current?.fit();
  }, [settings.fontFamily, settings.fontSize, settings.cursorStyle, settings.cursorBlink, settings.scrollback]);

  useEffect(() => {
    if (!isActive) return;
    // Hidden viewports report a 0x0 layout, so refit before focusing when a tab becomes active.
    const frame = requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
      termRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isActive]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleCopy = useCallback(() => {
    const term = termRef.current;
    if (term?.hasSelection()) void navigator.clipboard.writeText(term.getSelection());
    closeContextMenu();
  }, [closeContextMenu]);

  const handlePaste = useCallback(() => {
    void navigator.clipboard
      .readText()
      .then((text) => {
        if (text) termRef.current?.paste(text);
      })
      .catch((error: unknown) => {
        console.error('Failed to read clipboard:', error);
      });
    closeContextMenu();
  }, [closeContextMenu]);

  const handleSelectAll = useCallback(() => {
    termRef.current?.selectAll();
    closeContextMenu();
  }, [closeContextMenu]);

  const handleClear = useCallback(() => {
    termRef.current?.clear();
    closeContextMenu();
  }, [closeContextMenu]);

  return (
    <div className="terminal-view" ref={containerRef} onMouseDown={onFocus}>
      {contextMenu && (
        <TerminalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={contextMenu.hasSelection}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onSelectAll={handleSelectAll}
          onClear={handleClear}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
