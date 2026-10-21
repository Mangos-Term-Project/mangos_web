import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { API_TARGET } = loadEnv(mode, process.cwd(), 'API_TARGET')

  if (!API_TARGET) {
    throw new Error('API_TARGET must be set in the frontend environment.')
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})