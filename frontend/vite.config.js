import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/api/auth': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
