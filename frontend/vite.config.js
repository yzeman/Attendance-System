import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensure public directory is copied
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  // This is the key - it ensures the public folder is copied to dist
  publicDir: 'public'
})
