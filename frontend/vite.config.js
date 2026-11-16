import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'Geosand - Quarry Mapping System',
        short_name: 'Geosand',
        description: 'Quarry Mapping & Management System for Bongabong, Oriental Mindoro',
        lang: 'en-PH',
        categories: ['business', 'government', 'navigation', 'productivity'],
        theme_color: '#0F766E',
        background_color: '#F9FAFB',
        display: 'standalone',
        scope: '/',
        start_url: '/dashboard?source=pwa',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'My Dashboard',
            short_name: 'Dashboard',
            description: 'Open your role dashboard',
            url: '/dashboard?source=shortcut',
            icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: 'Notifications',
            short_name: 'Notifications',
            description: 'View Geosand notifications',
            url: '/notifications?source=shortcut',
            icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: 'Public Quarry Map',
            short_name: 'Map',
            description: 'Open the public quarry map',
            url: '/?source=shortcut',
            icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json,geojson}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/(?:[abc]\.)?tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/(services|server)\.arcgisonline\.com\/ArcGIS\/rest\/services\/(World_Imagery|World_Topo_Map)\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geosand-basemap-cache',
              expiration: { maxEntries: 750, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geosand-terrain-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/v1\/(quarries|checkpoints)(\/[^?]*)?(\?.*)?$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'geosand-public-map-data',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    port: 5173,
    host: true,
  },
})
