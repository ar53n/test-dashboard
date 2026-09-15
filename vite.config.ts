import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // Порт сервера берётся из того же .env, что читает сервер в `npm run dev`
  // (переменная окружения процесса важнее файла — как и у Node --env-file).
  // Только префикс SERVER_: остальное из .env (например, AI_API_KEY) конфигу Vite не нужно.
  const env = loadEnv(mode, process.cwd(), 'SERVER_')
  const apiTarget = `http://localhost:${env.SERVER_PORT || 3001}`

  return {
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
  }
})
