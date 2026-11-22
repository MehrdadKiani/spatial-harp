/// <reference types="vitest" />
import { defineConfig } from 'vite';
import fs from 'node:fs';

const appVersion = fs.existsSync(new URL('./VERSION', import.meta.url))
  ? fs.readFileSync(new URL('./VERSION', import.meta.url), 'utf-8').trim()
  : '0.1.2';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    globals: true,
    environment: 'node',
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-tone': ['tone'],
          'vendor-mediapipe': ['@mediapipe/tasks-vision'],
        },
      },
    },
  },
});
