import React, { useEffect, useRef } from 'react';
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

  return <div className="terminal-view" ref={containerRef} onMouseDown={onFocus} />;
}
