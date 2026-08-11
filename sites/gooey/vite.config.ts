import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Aliased to the library SOURCE rather than its built dist, so editing
      // the library hot-reloads this site with no rebuild step. Matches how
      // the beam site resolves border-beam.
      'liquid-gooey': fileURLToPath(
        new URL('../../packages/liquid-gooey/src/index.ts', import.meta.url),
      ),
    },
  },
})
