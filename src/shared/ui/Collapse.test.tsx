// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Collapse, COLLAPSE_DURATION_MS } from './Collapse.tsx'
import { renderWithTheme } from './renderWithTheme.ts'

const CONTENT_HEIGHT = 120

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const render = (open: boolean, animate = true) =>
  renderWithTheme(
    <Collapse open={open} animate={animate}>
      <p>Содержимое</p>
    </Collapse>,
  )

/** Обёртка Collapse вокруг содержимого. */
const wrapper = () => screen.queryByText('Содержимое')?.parentElement ?? null
const heightClassRule = (element: HTMLElement) => {
  // styled-components кладёт правила в <style>; ищем правило по классу элемента.
  const css = Array.from(document.querySelectorAll('style')).map((style) => style.textContent).join('\n')
  const classes = Array.from(element.classList)
  const match = classes
    .map((className) => css.match(new RegExp(`\\.${className}\\{([^}]*)\\}`))?.[1])
    .find((rule) => rule?.includes('height'))
  return match?.match(/height:([^;]+);/)?.[1]
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(CONTENT_HEIGHT)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Collapse', () => {
  it('раскрытие: 0 → измеренная высота → auto после transitionend', () => {
    stubReducedMotion(false)
    const { rerender } = render(false)
    expect(wrapper()).toBeNull()

    rerender(
      <Collapse open animate>
        <p>Содержимое</p>
      </Collapse>,
    )
    const element = wrapper()!
    expect(heightClassRule(element)).toBe(`${CONTENT_HEIGHT}px`)

    fireEvent.transitionEnd(element, { propertyName: 'height' })
    expect(heightClassRule(wrapper()!)).toBe('auto')
  })

  it('свёртывание: auto → высота → 0, содержимое размонтируется после анимации', () => {
    stubReducedMotion(false)
    const { rerender } = render(true)
    expect(heightClassRule(wrapper()!)).toBe('auto')

    rerender(
      <Collapse open={false} animate>
        <p>Содержимое</p>
      </Collapse>,
    )
    expect(heightClassRule(wrapper()!)).toBe('0px')

    fireEvent.transitionEnd(wrapper()!, { propertyName: 'height' })
    expect(wrapper()).toBeNull()
  })

  it('если transitionend не пришёл, состояние завершается по таймеру', () => {
    stubReducedMotion(false)
    const { rerender } = render(true)
    rerender(
      <Collapse open={false} animate>
        <p>Содержимое</p>
      </Collapse>,
    )
    expect(wrapper()).not.toBeNull()
    act(() => vi.advanceTimersByTime(COLLAPSE_DURATION_MS + 100))
    expect(wrapper()).toBeNull()
  })

  it('prefers-reduced-motion: без измерений и ожидания', () => {
    stubReducedMotion(true)
    const { rerender } = render(true)
    rerender(
      <Collapse open={false} animate>
        <p>Содержимое</p>
      </Collapse>,
    )
    expect(wrapper()).toBeNull()

    rerender(
      <Collapse open animate>
        <p>Содержимое</p>
      </Collapse>,
    )
    expect(heightClassRule(wrapper()!)).toBe('auto')
  })

  it('animate=false: мгновенно, даже без reduced motion', () => {
    stubReducedMotion(false)
    const { rerender } = render(false, false)
    rerender(
      <Collapse open animate={false}>
        <p>Содержимое</p>
      </Collapse>,
    )
    expect(heightClassRule(wrapper()!)).toBe('auto')
  })
})
