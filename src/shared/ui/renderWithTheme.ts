import { render, type RenderOptions } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { theme } from './theme.ts'

/** Рендер в тестах с темой styled-components. */
export function renderWithTheme(ui: ReactElement, options: Omit<RenderOptions, 'wrapper'> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(ThemeProvider, { theme }, children)
  return render(ui, { wrapper, ...options })
}
