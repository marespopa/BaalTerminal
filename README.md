# BaalTerminal

BaalTerminal is a modern, high-performance, multi-tab terminal emulator built with Electron, React/TypeScript, Xterm.js, and node-pty.

It is architected to support interactive developer workflows, full-screen TUI applications (for example, Neovim and Tmux), and streaming AI CLI utilities such as Claude Code and Cursor CLI.

Each tab is its own terminal.

## Setup

```bash
npm install
```

`node-pty`'s native module is rebuilt automatically against Electron's ABI via the `postinstall` script.

## Development

```bash
npm run dev
```

Runs the TypeScript watcher, Vite dev server (`http://localhost:5173`), and Electron concurrently. The main process loads the Vite dev server URL when the app is not packaged.

## Rebuilding native modules

If Electron's version changes or `node-pty` fails to load:

```bash
npm run rebuild
```

## Packaging

```bash
npm run build      # tsc + vite build -> dist/
npm run package     # build + electron-builder installer -> release/
npm run package:dir # build + unpacked app only (faster, no installer) -> release/win-unpacked/
```

Packaging targets Windows (NSIS) via the `build` config in [package.json](package.json). If `electron-builder` fails to extract its `winCodeSign` cache with a symbolic-link privilege error, enable Windows Developer Mode (Settings → For developers) or run the terminal as Administrator, then retry.
