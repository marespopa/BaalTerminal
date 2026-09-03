import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PtyManager } from './pty-manager';

export class BaalMcpServer {
  private started = false;

  public constructor(private readonly ptyManager: PtyManager) {}

  public async start(): Promise<void> {
    if (this.started) return;

    const server = new McpServer({ name: 'baal-terminal', version: '1.0.0' });
    server.registerTool('list_tabs', {
      description: 'List active terminal tabs with shell PIDs, working directories, and detected listening ports.',
    }, async () => ({ content: [{ type: 'text', text: JSON.stringify(this.ptyManager.listSessions()) }] }));
    server.registerTool('get_tab_output', {
      description: 'Get bounded terminal history with credentials and secret-like values redacted.',
      inputSchema: { tabId: z.string() },
    }, async ({ tabId }) => {
      const output = this.ptyManager.getSanitizedOutput(tabId);
      return { content: [{ type: 'text', text: output ?? 'Terminal tab not found.' }], isError: output === undefined };
    });
    server.registerTool('execute_command_in_tab', {
      description: 'Write a command followed by Enter to an existing terminal tab.',
      inputSchema: { tabId: z.string(), command: z.string().min(1).max(1024 * 1024) },
    }, async ({ tabId, command }) => {
      try {
        this.ptyManager.executeCommand(tabId, command);
        return { content: [{ type: 'text', text: 'Command sent.' }] };
      } catch (error) {
        return { content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unable to send command.' }], isError: true };
      }
    });
    server.registerTool('get_listening_ports', {
      description: 'List listening ports observed in current terminal output, grouped by terminal tab.',
    }, async () => ({ content: [{ type: 'text', text: JSON.stringify(this.ptyManager.listSessions().map(({ id, pid, ports }) => ({ id, pid, ports }))) }] }));

    await server.connect(new StdioServerTransport());
    this.started = true;
  }
}