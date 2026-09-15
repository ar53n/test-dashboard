import { useCallback, useSyncExternalStore } from 'react'

const canMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * Подписка на media query. Значение читается синхронно при первом рендере,
 * поэтому раскладка не «мигает» между вариантами.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatchMedia()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => canMatchMedia() && window.matchMedia(query).matches,
    () => false,
  )
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
