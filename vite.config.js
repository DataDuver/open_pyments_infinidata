import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // En desarrollo, el front (5173) le pasa las llamadas /api al backend (3000)
  // host: true para abrirlo también desde el celular en la misma WiFi
  server: { host: true, proxy: { '/api': 'http://localhost:3000' } },
})
