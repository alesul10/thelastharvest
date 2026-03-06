import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          babylonjs: ['@babylonjs/core'],
          babylonjs_gui: ['@babylonjs/gui'],
        },
      },
    },
  },
});
