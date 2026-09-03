import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import { useAtomValue, useSetAtom } from 'jotai';
import '@xterm/xterm/css/xterm.css';
import { setTabPortsAtom } from '../state/tabs';
import { terminalThemes, themeAtom } from '../state/theme';

const FONT_FAMILY = '"JetBrainsMono Nerd Font", "FiraCode Nerd Font", "JetBrains Mono", "Fira Code", monospace';

export interface TerminalViewProps {
  tabId: string;
  isActive: boolean;
  cwd?: string;
  onFocus?: () => void;
}

/**
 * Mounts a single Xterm.js instance bound to one PTY session via the preload bridge.
 * Kept mounted for the lifetime of its tab so scrollback and TUI state survive tab switches.
 */
export function TerminalView({ tabId, isActive, cwd, onFocus }: TerminalViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const setTabPorts = useSetAtom(setTabPortsAtom);
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: FONT_FAMILY,
      fontSize: 14,
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
    fitAddon.fit();
    fitAddonRef.current = fitAddon;
    termRef.current = term;

    let disposed = false;
    const disposables: Array<() => void> = [];

    void window.terminal.create(tabId, { cols: term.cols, rows: term.rows, cwd }).then(() => {
      if (disposed) return;
      disposables.push(window.terminal.onOutput(tabId, (data) => term.write(data)));
      disposables.push(window.terminal.onPorts(tabId, (ports) => setTabPorts(tabId, ports)));
      disposables.push(
        window.terminal.onExit(tabId, () => {
          term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
        }),
      );
    });

    const inputDisposable = term.onData((data) => window.terminal.input(tabId, data));
    const resizeDisposable = term.onResize(({ cols, rows }) => window.terminal.resize(tabId, cols, rows));

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);

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
    if (!isActive) return;
    // Hidden viewports report a 0x0 layout, so refit before focusing when a tab becomes active.
    fitAddonRef.current?.fit();
    termRef.current?.focus();
  }, [isActive]);

  return <div className="terminal-view" ref={containerRef} onMouseDown={onFocus} />;
}
