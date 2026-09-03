# Architecture Master Plan: BaalTerminal

**BaalTerminal** is a modern, high-performance, multi-tab terminal emulator built with Electron, React/TypeScript, Xterm.js, and `node-pty`. It is architected specifically to support interactive developer workflows, full-screen TUI applications (Neovim, Tmux), and streaming AI CLI utilities (Claude Code, Cursor CLI).

---

## 1. System Overview & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                  MAIN PROCESS                                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                            PTY Registry Manager                             |  |
|  |                                                                             |  |
|  |   [Tab 1 PTY]         [Tab 2 PTY]         [Tab 3 PTY]         [Tab 4 PTY]   |  |
|  |    (node-pty)          (node-pty)          (node-pty)          (node-pty)    |  |
|  +--------+-------------------+-------------------+-------------------+--------+  |
|           ^                   ^                   ^                   ^           |
|           |                   |                   |                   |           |
+-----------|-------------------|-------------------|-------------------|-----------+
            |                   |                   |                   |
            |      IPC Channel: Tab-Scoped Event Bus (stdin / stdout / resize)
            |                   |                   |                   |
+-----------|-------------------|-------------------|-------------------|-----------+
|           v                   v                   v                   v           |
|  +--------+-------------------+-------------------+-------------------+--------+  |
|  |                             Preload Context Bridge                          |  |
|  |                                                                             |  |
|  |   `sendInput`             `onOutput`             `resizeTerminal`           |  |
|  +--------+-------------------+-------------------+-------------------+--------+  |
|           |                   |                   |                   |           |
|  +--------v-------------------v-------------------v-------------------v--------+  |
|  |                             Renderer State (Jotai)                          |  |
|  |                                                                             |  |
|  |   activeTabId: 'tab-1'                                                      |  |
|  |   splitLayout: primary 'tab-1', secondary 'tab-2'                            |  |
|  |   tabs: ['tab-1', 'tab-2', 'tab-3', 'tab-4']                                 |  |
|  +--------+-------------------+-------------------+-------------------+--------+  |
|           |                   |                   |                   |           |
|  +--------v-------------------v-------------------v-------------------v--------+  |
|  |                      DOM Viewport Preservation Tree                         |  |
|  |                                                                             |  |
|  |   [Viewport 1]        [Viewport 2]        [Viewport 3]        [Viewport 4]   |  |
|  |   xterm.js + WebGL    xterm.js + WebGL    xterm.js + WebGL    xterm.js + WebGL|  |
|  |   (visible)            (visible in split)  (display: none)     (display: none) |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|                                 RENDERER PROCESS                                  |
+-----------------------------------------------------------------------------------+

```

---

## 2. Core Architectural Pillars

### Pillar I: Dual-Process Isolation & IPC Messaging Bus

To maintain safety and fast rendering, the Main and Renderer processes are separated with context isolation enabled.

* **Main Process:** Spawns native child processes using `node-pty`. Manages active session lifetimes, process signals (SIGINT, SIGTERM), and environment inheritance.
* **Preload Layer:** Exposes a typed API bridge using `contextBridge`. IPC channels are explicitly namespaced by `tabId` (e.g., `terminal:data:tab-1`) to isolate multi-tab streams.
* **Renderer Process:** Operates in a sandboxed browser context, delegating input events and rendering canvas/WebGL buffers received from IPC streams.

### Pillar II: DOM Preservation State Strategy

Terminal instances are **never destroyed or unmounted** when switching tabs.

* All open `xterm.js` viewport nodes remain mounted in the DOM tree.
* Normal tab switches show one viewport; split mode shows two tab viewports side by side.
* This design guarantees zero loss of scrollback history, maintains active Neovim visual buffers, and keeps background tasks (AI CLIs, compilation tasks, SSH sessions) running without interruption.

### Pillar III: TUI & Truecolor Environment Standards

Full support for Neovim, Tmux, and modern terminal interfaces requires explicit shell environment variables.

| Variable | Target Value | Purpose |
| --- | --- | --- |
| `TERM` | `xterm-256color` | Standard 256-color palette escape sequence support |
| `COLORTERM` | `truecolor` | 24-bit RGB true color rendering for Neovim themes |
| `TERM_PROGRAM` | `BaalTerminal` | Application identifier for CLI tool capability detection |

---

## 3. Directory & Module Structure

```text
baal-terminal/
├── src/
│   ├── main/
│   │   ├── index.ts                # App lifecycle & window creation
│   │   ├── pty-manager.ts          # PTY process registry & IPC handlers
│   │   └── environment.ts          # System shell detection & ENV resolution
│   ├── preload/
│   │   ├── index.ts                # Context bridge API exports
│   │   └── types.ts                # Shared IPC message type definitions
│   └── renderer/
│       ├── components/
│       │   ├── TabBar.tsx          # Tab bar navigation header
│       │   ├── TerminalContainer.tsx # DOM wrapper for all viewport instances
│       │   └── TerminalViewport.tsx  # Single Xterm.js canvas wrapper
│       ├── hooks/
│       │   ├── useTerminal.ts      # Xterm.js lifecycle & WebGL initialization
│       │   └── useTabManager.ts    # Tab state & keyboard navigation hooks
│       ├── store/
│       │   └── atoms.ts            # State management for tabs and layout
│       ├── styles/
│       │   └── main.css            # Layout, tab styling, and font bindings
│       └── index.tsx               # Renderer entry point
├── electron-builder.json           # Native module packaging configuration
├── package.json
└── tsconfig.json

```

---

## 4. Key Component Specifications

### 1. PTY Process Registry (`src/main/pty-manager.ts`)

* Maintains an internal map: `Map<string, pty.IPty>`.
* Listens for `terminal:create`, `terminal:input`, `terminal:resize`, and `terminal:destroy` IPC messages.
* Subscribes to `pty.onData` streams and broadcasts payload events to the exact renderer window and tab channel.

### 2. Viewport Engine (`src/renderer/hooks/useTerminal.ts`)

* Instantiates `Terminal` from `@xterm/xterm`.
* Loads essential extensions:
* `@xterm/addon-webgl` (Fallback to `@xterm/addon-canvas` if WebGL2 context is unavailable).
* `@xterm/addon-fit` for automatic element grid sizing.
* `@xterm/addon-web-links` for clickable URL detection.


* Configures `attachCustomKeyEventHandler` to ensure key combos (e.g., `Ctrl+C`, `Esc`, `Alt` shortcuts) are passed directly to Neovim and active CLI sessions instead of being captured by Electron accelerators.

### 3. Viewport Refit Strategy (`src/renderer/components/TerminalViewport.tsx`)

* When a tab transitions from hidden (`display: none`) to active (`display: block`), its bounding rectangle changes from `0x0` to full dimensions.
* The tab switch event fires `fitAddon.fit()`, recalculates `cols` and `rows`, and emits `terminal:resize` across IPC to update the backend PTY grid dimensions immediately.

---

## 5. Build, Native Compilation & Packaging

Because `node-pty` includes native C++ bindings, native compilation must target Electron's specific Node.js ABI:

1. **Dependencies:**
```bash
npm install @xterm/xterm @xterm/addon-webgl @xterm/addon-fit @xterm/addon-web-links node-pty
npm install -D electron electron-rebuild typescript

```


2. **Native Rebuild Script:**
Add a post-install trigger to `package.json` to compile `node-pty` against Electron headers:
```json
"scripts": {
  "rebuild": "electron-rebuild -f -w node-pty"
}

```


3. **Font Configuration:** Enforce system or local fallback to a Nerd Font (e.g., `JetBrainsMono Nerd Font`, `FiraCode Nerd Font`) within Xterm option overrides to ensure prompt symbols, Powerline bars, and Neovim statusline glyphs render cleanly.