I’ll anchor the plan in the existing workspace docs first, then turn the architecture into an ordered implementation sequence with checkpoints, risks, and the first executable milestone.

Read 

Read memory

Read 

**Implementation Plan**

The workspace currently contains only the architecture and a minimal README, so implementation should begin with project scaffolding.

1. **Bootstrap the Electron project**
   - Add `package.json`, TypeScript configuration, Electron entry points, and build scripts.
   - Install Electron, React, Jotai, Xterm.js, `node-pty`, and required addons.
   - Configure Electron native-module rebuilding for `node-pty`.

2. **Implement the main process**
   - Create the `BrowserWindow` with context isolation and sandboxing.
   - Add Windows shell detection and environment normalization.
   - Implement `pty-manager.ts` with:
     - PTY creation and registry
     - Input forwarding
     - Resize handling
     - Output events
     - Cleanup on tab destruction and app exit

3. **Implement the typed preload bridge**
   - Define shared IPC types.
   - Expose only tab-scoped terminal operations through `contextBridge`.
   - Validate tab IDs and payloads at the IPC boundary.

4. **Build renderer state and tab management**
   - Add Jotai atoms for tabs, active tab, and terminal metadata.
   - Implement create, close, activate, and keyboard navigation behavior.
   - Keep terminal viewport components mounted while switching visibility.

5. **Build the terminal viewport**
   - Initialize Xterm.js with Nerd Font fallbacks and truecolor settings.
   - Add Fit, Web Links, and WebGL addons.
   - Provide a Canvas fallback if WebGL initialization fails.
   - Wire terminal input/output and resize events to the preload bridge.

6. **Create the user interface**
   - Implement `TabBar`, `TerminalContainer`, and `TerminalViewport`.
   - Add responsive layout and focused-tab styling.
   - Ensure hidden terminals retain their DOM and Xterm.js instances.

7. **Validate core behavior**
   - Launch multiple tabs and confirm each has an independent shell.
   - Verify input/output isolation between tabs.
   - Switch tabs while running `vim`, `tmux`, or another full-screen TUI.
   - Confirm resizing updates the PTY dimensions.
   - Confirm closing a tab terminates its PTY.
   - Test WebGL fallback and application shutdown cleanup.

8. **Package and document**
   - Add Electron Builder configuration.
   - Test a packaged Windows build.
   - Update the README with setup, development, rebuild, and packaging commands.

**First milestone**

Create the runnable Electron/React shell with one PTY-backed Xterm terminal. Once that path works end to end, add multi-tab state and DOM preservation. This gives us a small, testable foundation before introducing tab lifecycle complexity.

Two architecture details should be resolved during implementation:

- The planned WebGL fallback requires adding `@xterm/addon-canvas` to the dependency list.
- The diagram shows four tabs, but the implementation should use dynamic tab creation rather than hard-coding four terminals.