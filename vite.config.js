import { defineConfig } from 'vite'

// Relative asset paths so the build works under https://<user>.github.io/report-editor/
export default defineConfig({
  base: './',
  // KaTeX and the editor together are one ~0.7 MB bundle; that's fine here.
  build: { chunkSizeWarningLimit: 1000 },
})
