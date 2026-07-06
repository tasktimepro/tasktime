import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'fs'
import { PUBLIC_STATIC_ROUTE_DENYLIST } from './src/config/publicRoutes.js'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url))
)
const appBuildVersion = `${packageJson.version}-${Date.now()}`

const isPreviewCommand = process.argv.includes('preview')
const publicRouteProxy = isPreviewCommand
  ? undefined
  : {
      '/blog': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
      '/agents': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
      '/llms.txt': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
      '/privacy': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
      '/contact': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
      '/terms': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
      '/src/styles/global.css': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
      '^/@fs/app/blog/': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: false,
      },
    }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      // The app owns service worker registration in src/utils/serviceWorkerRegistration.js
      // so the plugin must not inject its own registerSW.js script into production HTML.
      injectRegister: false,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'favicon-96x96.png', 'icons/*.png'],
      manifest: false, // Use our custom manifest.json in public/
      injectManifest: {
        injectionPoint: 'self.__WB_MANIFEST',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      workbox: {
        navigateFallbackDenylist: PUBLIC_STATIC_ROUTE_DENYLIST,
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
    __APP_VERSION__: JSON.stringify(appBuildVersion),
  },
  server: {
    port: 5173,
    strictPort: true, // Exit if port is already in use instead of automatically trying the next available port
    host: 'localhost',
    proxy: publicRouteProxy,
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
          if (id.includes('sonner')) return 'sonner';

          return 'vendor';
        }
      }
    }
  }
})
