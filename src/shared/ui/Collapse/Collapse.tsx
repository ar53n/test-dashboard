import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react'
import { usePrefersReducedMotion } from '@/shared/lib/useMediaQuery.ts'
import * as S from './Collapse.styled.ts'
import { COLLAPSE_DURATION_MS } from './constants.ts'

type Phase = 'open' | 'closed' | 'opening' | 'closing'

interface CollapseProps {
  open: boolean
  /** `false` — раскрыть/свернуть мгновенно (например, при программном раскрытии для прокрутки к узлу). */
  animate?: boolean
  children: ReactNode
}

/**
 * Раскрытие через transition `height`: 0 ↔ измеренный `scrollHeight`, после анимации — `auto`,
 * чтобы вложенные раскрытия меняли высоту естественно. Свёрнутое содержимое размонтируется.
 * При `prefers-reduced-motion` измерение пропускается и состояние меняется сразу
 * (в CSS переход тоже отключён).
 */
export function Collapse({ open, animate = true, children }: CollapseProps) {
  const reducedMotion = usePrefersReducedMotion()
  const shouldAnimate = animate && !reducedMotion
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed')
  /** `null` — `height: auto`. */
  const [height, setHeight] = useState<number | null>(null)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!shouldAnimate) {
      setPhase(open ? 'open' : 'closed')
      setHeight(null)
    } else if (open) {
      setPhase('opening')
      // Из закрытого состояния стартуем с 0; если закрытие ещё идёт — с текущей высоты.
      if (phase === 'closed') setHeight(0)
    } else {
      setPhase('closing')
    }
  }

  const finish = (next: 'open' | 'closed') => {
    setPhase(next)
    setHeight(null)
  }

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    if (phase === 'closing') {
      if (height === null) {
        // auto → px без анимации; в следующем проходе px → 0 уже с анимацией.
        if (element.scrollHeight === 0) finish('closed')
        else setHeight(element.scrollHeight)
      } else if (height > 0) {
        // Принудительный reflow фиксирует стартовую высоту, иначе браузер склеит изменения и не анимирует.
        element.getBoundingClientRect()
        setHeight(0)
      }
      return
    }

    if (phase === 'opening') {
      const target = element.scrollHeight
      if (target === 0) finish('open')
      else if (height !== target) {
        element.getBoundingClientRect()
        setHeight(target)
      }
    }
    // Дальше ждём transitionend.
  }, [phase, height])

  // Страховка: transitionend не приходит, если элемент скрыт или вкладка неактивна.
  useEffect(() => {
    if (phase !== 'opening' && phase !== 'closing') return
    const timer = setTimeout(() => finish(phase === 'opening' ? 'open' : 'closed'), COLLAPSE_DURATION_MS + 100)
    return () => clearTimeout(timer)
  }, [phase])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'height') return
    if (phase === 'opening') finish('open')
    else if (phase === 'closing') finish('closed')
  }

  if (phase === 'closed') return null
  return (
    <S.Root ref={ref} $height={height} onTransitionEnd={handleTransitionEnd}>
      {children}
    </S.Root>
  )
}
