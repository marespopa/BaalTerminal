import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // xterm core + addons are the bulk of the bundle; keep them in their own chunk
          // so they are only fetched when the lazily-loaded TerminalView first renders.
          if (id.includes('@xterm')) return 'xterm';
          return 'vendor';
        },
      },
    },
  },
});