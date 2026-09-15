import { createHttpServer } from './http.ts'
import { OrgStore } from './store.ts'

const port = Number(process.env.SERVER_PORT ?? 3001)
const store = new OrgStore()
const server = createHttpServer(store)

server.listen(port, () => {
  console.log(`[server] http://localhost:${port} epoch=${store.epoch} nodes=${store.snapshot().length}`)
})

const shutdown = () => server.close(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
