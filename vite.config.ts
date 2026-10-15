import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/analysis/**', '**/src-tauri/**', '**/test-results*/**', '**/playwright-report/**'] } },
  build: { target: 'es2022', rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
});
