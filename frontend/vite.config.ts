import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the FastAPI backend so the browser sees a
    // same-origin request (no CORS), whatever port Vite picks.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
