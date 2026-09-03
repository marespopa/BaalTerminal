import * as os from 'os';

export function resolveShell(override?: string): string {
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  if (process.platform === 'win32') {
    return process.env.COMSPEC ?? 'cmd.exe';
  }

  return process.env.SHELL ?? (os.platform() === 'darwin' ? '/bin/zsh' : '/bin/bash');
}

export function resolveEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  return {
    ...environment,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'BaalTerminal',
  };
}

export function resolveWorkingDirectory(): string {
  return process.platform === 'win32'
    ? process.env.USERPROFILE ?? process.cwd()
    : process.env.HOME ?? process.cwd();
}