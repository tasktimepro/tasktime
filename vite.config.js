import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Exit if port is already in use instead of automatically trying the next available port
    host: 'localhost',
    // Handle SPA routing - redirect all requests to index.html
    historyApiFallback: true
  },
  // Ensure preview server also handles SPA routing
  preview: {
    port: 4173,
    strictPort: true
  }
})
