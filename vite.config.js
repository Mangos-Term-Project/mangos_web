import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL } = loadEnv(mode, projectRoot, 'VITE_API_BASE_URL')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'mango-icon.png', 'icons.svg'],
        manifest: {
          name: 'Mangos Learning English',
          short_name: 'Mangos',
          description: 'Learn English with Mangos.',
          lang: 'en-US',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#3d2b19',
          theme_color: '#ffdc96',
          categories: ['education'],
          icons: [
            {
              src: '/mango-icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    server: {
      proxy: VITE_API_BASE_URL
        ? {
            '/api': {
              target: VITE_API_BASE_URL,
              changeOrigin: true,
              secure: false,
            },
          }
        : {},
    },
  }
})