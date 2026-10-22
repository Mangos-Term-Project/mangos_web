import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL } = loadEnv(mode, process.cwd(), 'VITE_API_BASE_URL')

  if (!VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL must be set in the frontend environment.')
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: VITE_API_BASE_URL,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})