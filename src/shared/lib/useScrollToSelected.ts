import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './useMediaQuery.ts'

/**
 * Прокручивает панель к выбранному элементу: при каждом новом выборе и при монтировании панели
 * с уже выбранным элементом (на узком экране панели переключаются вкладками и теряют прокрутку).
 *
 * Выбор, сделанный в самой панели (`own`), пропускается: элемент уже под курсором,
 * а прокрутка только дёргала бы список из-под клика.
 */
export function useScrollToSelected(
  request: number | undefined,
  own: boolean,
  findElement: () => HTMLElement | null | undefined,
) {
  // Поиск элемента и настройка анимации читаются через ref: их смена не должна сама прокручивать панель.
  const findRef = useRef(findElement)
  useEffect(() => {
    findRef.current = findElement
  })

  const reducedMotion = usePrefersReducedMotion()
  const reducedMotionRef = useRef(reducedMotion)
  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  const mountedRef = useRef(false)
  useEffect(() => {
    const isMount = !mountedRef.current
    mountedRef.current = true
    if (request === undefined || (own && !isMount)) return
    const element = findRef.current()
    element?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotionRef.current ? 'auto' : 'smooth' })
  }, [request, own])
}
