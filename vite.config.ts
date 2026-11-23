/// <reference types="vitest" />
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [basicSsl()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'node',
  },
  server: {
    host: true,
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
