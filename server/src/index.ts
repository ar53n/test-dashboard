import { createHttpServer } from './http.ts'
import { attachLiveServer } from './live.ts'
import { startSimulator } from './simulator.ts'
import { OrgStore } from './store.ts'

const readInt = (name: string, fallback: number) => {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

const port = readInt('SERVER_PORT', 3001)
const minIntervalMs = readInt('SIM_MIN_INTERVAL_MS', 1500)
const maxIntervalMs = Math.max(minIntervalMs, readInt('SIM_MAX_INTERVAL_MS', 4000))

const store = new OrgStore()
const server = createHttpServer(store)
const live = attachLiveServer(server, store)
const stopSimulator = startSimulator(store, { minIntervalMs, maxIntervalMs })

server.listen(port, () => {
  console.log(
    `[server] http://localhost:${port} epoch=${store.epoch} nodes=${store.snapshot().length} ` +
      `simulator=${minIntervalMs}-${maxIntervalMs}ms`,
  )
})

const shutdown = () => {
  stopSimulator()
  live.close()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
