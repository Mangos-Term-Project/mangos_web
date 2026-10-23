import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL } = loadEnv(mode, projectRoot, 'VITE_API_BASE_URL')

  return {
    plugins: [react()],
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