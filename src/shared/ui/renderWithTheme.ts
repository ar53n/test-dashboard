import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { theme } from './theme.ts'

interface RenderWithThemeOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Клиент запросов; по умолчанию новый на каждый рендер, без повторов. */
  queryClient?: QueryClient
}

/** Рендер в тестах с темой styled-components и клиентом TanStack Query. */
export function renderWithTheme(ui: ReactElement, { queryClient, ...options }: RenderWithThemeOptions = {}) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, createElement(ThemeProvider, { theme }, children))
  return render(ui, { wrapper, ...options })
}
