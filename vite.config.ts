import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const apiTarget = `http://localhost:${process.env.SERVER_PORT ?? 3001}`

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': { target: apiTarget, ws: true },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/src/**/*.test.ts'],
    environment: 'node',
  },
})
