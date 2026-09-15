// @vitest-environment jsdom
import type { OrgFilter } from '@shared/orgFilter.ts'
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrgModel } from '@/entities/org/model/orgModel.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { renderWithTheme } from '@/shared/ui/renderWithTheme.ts'
import { AI_SEARCH_GC_TIME_MS, aiSearchQueryOptions } from './ai/aiSearchQuery.ts'
import { OrgTable } from './OrgTable.tsx'
import { SEARCH_DEBOUNCE_MS, useOrgTableState } from './useOrgTableState.ts'

const model = createOrgModel(
  [
    makeNode('sales', null, { name: 'Продажи', headcount: 2, budget: 3_000_000 }),
    makeNode('sales-team', 'sales', { name: 'Команда продаж', headcount: 10, budget: 2_000_000 }),
    makeNode('tech', null, { name: 'Технологии', headcount: 3, budget: 1_000_000 }),
    makeNode('tech-team', 'tech', { name: 'Команда платформы', headcount: 20, budget: 9_000_000 }),
  ],
  null,
)

function Harness() {
  const state = useOrgTableState()
  return <OrgTable model={model} state={state} selectedId={null} onSelect={() => {}} />
}

const fetchMock = vi.fn<typeof fetch>()
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const filterResponse = (filter: OrgFilter) => jsonResponse(200, { filter })

const input = () => screen.getByRole('searchbox', { name: 'Поиск по названию подразделения' })
const type = (value: string) => fireEvent.change(input(), { target: { value } })
const submit = () => fireEvent.submit(input().closest('form')!)
const names = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)
/** Текст всех живых регионов: строка статуса AI и, возможно, пустое состояние таблицы. */
const status = () =>
  screen
    .queryAllByRole('status')
    .map((element) => element.textContent)
    .join(' | ')

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AI-поиск в таблице', () => {
  it('Enter отправляет запрос; фильтр заменяет текстовый поиск и задаёт сортировку', async () => {
    fetchMock.mockResolvedValue(filterResponse({ levels: [2], sort: { key: 'totalBudget', dir: 'desc' } }))
    renderWithTheme(<Harness />)

    type('  Команды   С БЮДЖЕТОМ побольше ')
    submit()

    await waitFor(() => expect(status()).toContain('AI-фильтр'))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ai-search')
    expect(init!.method).toBe('POST')
    expect(JSON.parse(String(init!.body))).toEqual({ query: 'команды с бюджетом побольше' })

    // Фраза как подстрока ничего бы не нашла — применён структурированный фильтр.
    expect(names()).toEqual(['Команда платформы', 'Команда продаж'])
    expect(status()).toContain('Отделы')
    expect(status()).toContain('Сортировка по бюджету ↓')
    expect(screen.getByRole('columnheader', { name: /Бюджет суммарный/ }).getAttribute('aria-sort')).toBe('descending')
  })

  it('изменение ввода снимает AI-фильтр; повтор того же запроса берётся из кэша без обращения к API', async () => {
    fetchMock.mockResolvedValue(filterResponse({ levels: [1] }))
    renderWithTheme(<Harness />)

    type('дивизионы')
    submit()
    await waitFor(() => expect(names()).toEqual(['Продажи', 'Технологии']))

    type('дивизионы!')
    expect(status()).not.toContain('AI-фильтр')

    type('Дивизионы')
    submit()
    expect(names()).toEqual(['Продажи', 'Технологии'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('AI-запросы кэшируются: staleTime Infinity, gcTime 30 минут', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    fetchMock.mockResolvedValue(filterResponse({ levels: [1] }))
    const view = renderWithTheme(<Harness />, { queryClient })
    type('дивизионы')
    submit()
    await waitFor(() => expect(status()).toContain('AI-фильтр'))

    const query = queryClient.getQueryCache().find({ queryKey: ['ai-search', 'дивизионы'] })!
    expect(query.options.gcTime).toBe(AI_SEARCH_GC_TIME_MS)
    expect(aiSearchQueryOptions('дивизионы').staleTime).toBe(Infinity)
    expect(query.isStale()).toBe(false)
    view.unmount()
  })

  it('после сбоя повторная отправка того же ввода делает новый запрос', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network error'))
    renderWithTheme(<Harness />)
    type('дивизионы')
    submit()
    await waitFor(() => expect(status()).toContain('AI-поиск не ответил'))

    fetchMock.mockResolvedValueOnce(filterResponse({ levels: [1] }))
    submit()
    await waitFor(() => expect(status()).toContain('AI-фильтр'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(names()).toEqual(['Продажи', 'Технологии'])
  })

  it('повторная отправка того же ввода после успеха берёт результат из кэша', async () => {
    fetchMock.mockResolvedValue(filterResponse({ levels: [1] }))
    renderWithTheme(<Harness />)
    type('дивизионы')
    submit()
    await waitFor(() => expect(status()).toContain('AI-фильтр'))

    submit()
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(status()).toContain('AI-фильтр')
  })

  it('429 — подсказка о лимите и текстовый поиск; повторная отправка позже делает новый запрос', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: 'rate_limited', message: 'Слишком много AI-запросов' }))
    renderWithTheme(<Harness />)
    type('дивизионы')
    submit()
    await waitFor(() => expect(status()).toContain('Слишком много AI-запросов'))

    fetchMock.mockResolvedValueOnce(filterResponse({ levels: [1] }))
    submit()
    await waitFor(() => expect(status()).toContain('AI-фильтр'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('503 — подсказка и текстовый поиск по введённой строке', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetchMock.mockResolvedValue(jsonResponse(503, { error: 'not_configured', message: 'AI-поиск не настроен' }))
    renderWithTheme(<Harness />)

    type('платформ')
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    submit()

    await waitFor(() => expect(status()).toContain('AI-поиск не настроен'))
    expect(names()).toEqual(['Команда платформы'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('фильтр не по контракту и пустой фильтр — подсказка и текстовый поиск', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { filter: { levels: [7] } }))
    renderWithTheme(<Harness />)
    type('странный запрос')
    submit()
    await waitFor(() => expect(status()).toContain('некорректный фильтр'))

    fetchMock.mockResolvedValueOnce(filterResponse({}))
    type('погода')
    submit()
    await waitFor(() => expect(status()).toContain('не нашёл условий'))
  })

  it('изменение ввода отменяет идущий запрос, и его запоздавший ответ не применяется', async () => {
    let signal: AbortSignal | undefined
    let respond!: (response: Response) => void
    fetchMock.mockImplementationOnce((_url, init) => {
      signal = init!.signal!
      return new Promise((resolve) => (respond = resolve))
    })
    renderWithTheme(<Harness />)

    type('дивизионы')
    submit()
    await waitFor(() => expect(status()).toContain('AI разбирает запрос'))

    type('')
    await waitFor(() => expect(signal!.aborted).toBe(true))
    respond(filterResponse({ levels: [1] }))
    await act(async () => {})

    expect(status()).not.toContain('AI-фильтр')
    expect(names()).toHaveLength(4)
  })

  it('сортировка заголовком после ответа AI важнее сортировки из фильтра', async () => {
    fetchMock.mockResolvedValue(filterResponse({ levels: [2], sort: { key: 'totalBudget', dir: 'desc' } }))
    renderWithTheme(<Harness />)
    type('команды по бюджету')
    submit()
    await waitFor(() => expect(names()).toEqual(['Команда платформы', 'Команда продаж']))

    fireEvent.click(within(screen.getByRole('columnheader', { name: /Бюджет суммарный/ })).getByRole('button'))
    expect(names()).toEqual(['Команда продаж', 'Команда платформы'])
  })

  it('«Сбросить» очищает поле и AI-фильтр', async () => {
    fetchMock.mockResolvedValue(filterResponse({ levels: [1] }))
    renderWithTheme(<Harness />)
    type('дивизионы')
    submit()
    await waitFor(() => expect(names()).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(input()).toHaveProperty('value', '')
    expect(names()).toHaveLength(4)
  })
})
