import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'liquid-gooey': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
})
