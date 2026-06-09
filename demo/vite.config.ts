import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// The standalone showcase page (showcase.html) is intentionally NOT a build
// input, so it is excluded from the deployed site. It remains fully previewable
// during `vite` dev (Vite serves any root .html by URL); only `vite build`
// limits its emitted entry points to the main demo.
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      'border-beam': resolve(__dirname, '../src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
