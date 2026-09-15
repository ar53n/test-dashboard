// @vitest-environment jsdom
import { ORG_EPOCH_HEADER, ORG_REVISION_HEADER } from '@shared/contract.ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { media } from '@/shared/ui/media.ts'
import { renderWithTheme } from '@/shared/ui/renderWithTheme.ts'
import { Dashboard } from './Dashboard.tsx'

const nodes = [
  makeNode('tech', null, { name: 'Технологии' }),
  makeNode('platform', 'tech', { name: 'Платформа' }),
  makeNode('alpha', 'platform', { name: 'Платформа: команда «Альфа»' }),
  makeNode('sales', null, { name: 'Продажи' }),
]

const fetchMock = vi.fn<typeof fetch>()
const scrollIntoView = vi.fn()

function stubViewport({ split }: { split: boolean }) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === media.split ? split : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderWithTheme(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  )
}

const tree = () => screen.getByRole('list', { name: 'Оргструктура' })
const table = () => screen.getByRole('table')
const selectedTreeRow = () => tree().querySelector('[aria-current="true"]')

beforeEach(() => {
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify(nodes), {
        status: 200,
        headers: { [ORG_EPOCH_HEADER]: 'epoch-1', [ORG_REVISION_HEADER]: '1' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  scrollIntoView.mockReset()
  vi.unstubAllGlobals()
})

describe('Dashboard: split-view (≥1280px)', () => {
  it('показывает дерево и таблицу одновременно, обе панели делят один запрос', async () => {
    stubViewport({ split: true })
    renderDashboard()

    await screen.findByRole('table')
    expect(tree()).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Вид' })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('клик по строке таблицы раскрывает свёрнутых предков, выделяет узел и прокручивает к нему', async () => {
    stubViewport({ split: true })
    renderDashboard()
    await screen.findByRole('table')

    fireEvent.click(within(tree()).getByRole('button', { name: 'Свернуть «Технологии»' }))
    expect(within(tree()).queryByText('Платформа: команда «Альфа»')).toBeNull()

    fireEvent.click(within(table()).getByRole('cell', { name: 'Платформа: команда «Альфа»' }))

    expect(selectedTreeRow()?.textContent).toContain('Платформа: команда «Альфа»')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(selectedTreeRow())
  })
})

describe('Dashboard: вкладки (<1280px)', () => {
  it('рендерит только активную вкладку и сохраняет выбор и поиск при переключении', async () => {
    stubViewport({ split: false })
    renderDashboard()
    await screen.findByRole('list', { name: 'Оргструктура' })
    expect(screen.queryByRole('table')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Таблица' }))
    expect(screen.queryByRole('list', { name: 'Оргструктура' })).toBeNull()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'альфа' } })
    fireEvent.click(within(table()).getByRole('cell', { name: 'Платформа: команда «Альфа»' }))
    // Вкладка сама не переключается.
    expect(screen.getByRole('button', { name: 'Таблица' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Дерево' }))
    expect(selectedTreeRow()?.textContent).toContain('Платформа: команда «Альфа»')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Таблица' }))
    expect(screen.getByRole('searchbox')).toHaveProperty('value', 'альфа')
  })
})
