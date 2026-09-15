import { connect, type AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHttpServer } from './http.ts'
import { OrgStore } from './store.ts'

const store = new OrgStore()
const server = createHttpServer(store)
let baseUrl = ''

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve))
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

describe('GET /api/org-tree', () => {
  it('отдаёт плоский массив с версией состояния', async () => {
    const response = await fetch(`${baseUrl}/api/org-tree`)
    const body = (await response.json()) as unknown[]

    expect(response.status).toBe(200)
    expect(body.length).toBe(store.snapshot().length)
    expect(response.headers.get('etag')).toBe(`"${store.epoch}-0"`)
    expect(response.headers.get('x-org-epoch')).toBe(store.epoch)
    expect(response.headers.get('x-org-revision')).toBe('0')
  })

  it('отвечает 304 на совпадающий If-None-Match и 200 на чужой epoch', async () => {
    const notModified = await fetch(`${baseUrl}/api/org-tree`, { headers: { 'If-None-Match': `"${store.epoch}-0"` } })
    expect(notModified.status).toBe(304)
    expect(notModified.headers.get('x-org-revision')).toBe('0')

    const otherEpoch = await fetch(`${baseUrl}/api/org-tree`, { headers: { 'If-None-Match': '"old-epoch-0"' } })
    expect(otherEpoch.status).toBe(200)
  })

  it('сравнивает ETag слабо: W/-префикс от gzip в прокси и список значений', async () => {
    const weak = await fetch(`${baseUrl}/api/org-tree`, { headers: { 'If-None-Match': `W/"${store.epoch}-0"` } })
    expect(weak.status).toBe(304)
    const list = await fetch(`${baseUrl}/api/org-tree`, { headers: { 'If-None-Match': `"stale-1", W/"${store.epoch}-0"` } })
    expect(list.status).toBe(304)
  })

  it('на некорректный URL отвечает 400 и продолжает работать', async () => {
    // fetch и http.request сами отклоняют такой адрес, поэтому шлём сырой HTTP-запрос.
    const rawResponse = await new Promise<string>((resolve, reject) => {
      const socket = connect((server.address() as AddressInfo).port, 'localhost', () => {
        socket.end('GET //[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')
      })
      let data = ''
      socket.on('data', (chunk) => (data += chunk))
      socket.on('end', () => resolve(data))
      socket.on('error', reject)
    })

    expect(rawResponse.startsWith('HTTP/1.1 400')).toBe(true)
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200)
  })

  it('поддерживает демо-сценарии', async () => {
    expect((await fetch(`${baseUrl}/api/org-tree?scenario=error`)).status).toBe(500)
    expect(await (await fetch(`${baseUrl}/api/org-tree?scenario=empty`)).json()).toEqual([])
  })
})
