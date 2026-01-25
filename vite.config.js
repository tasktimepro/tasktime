import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url))
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['tasktime-icon.png', 'icons/*.png'],
      manifest: false, // Use our custom manifest.json in public/
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.exchangerate-api\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exchange-rates-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
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
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('yjs') || id.includes('y-indexeddb')) return 'yjs';
          if (id.includes('sonner')) return 'sonner';

          return 'vendor';
        }
      }
    }
  }
})
