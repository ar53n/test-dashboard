import styled, { css } from 'styled-components'
import { flashHost } from '@/shared/ui/Flash/index.ts'
import { media } from '@/shared/ui/media.ts'

export const List = styled.ul`
  margin: 0;
  padding: ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(2)};
  list-style: none;
`

export const Group = styled.ul`
  margin: 0 0 0 ${({ theme }) => theme.space(5)};
  padding: 0 0 0 ${({ theme }) => theme.space(1)};
  list-style: none;
  border-left: 1px solid ${({ theme }) => theme.color.border};

  /* На телефоне каждый уровень отнимает у названия меньше ширины. */
  @media ${media.narrow} {
    margin-left: ${({ theme }) => theme.space(3)};
  }
`

export const Row = styled.div<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
  min-height: 36px;
  padding: 0 ${({ theme }) => theme.space(3)} 0 ${({ theme }) => theme.space(1)};
  border-radius: ${({ theme }) => theme.radius.sm};
  scroll-margin: ${({ theme }) => theme.space(10)} 0;

  @media ${media.narrow} {
    column-gap: ${({ theme }) => theme.space(2)};
    padding-right: ${({ theme }) => theme.space(2)};
  }

  &:hover {
    background: ${({ theme }) => theme.color.surfaceHover};
  }

  ${({ $selected, theme }) =>
    $selected &&
    css`
      &,
      &:hover {
        background: ${theme.color.surfaceSelected};
        box-shadow: inset 3px 0 0 ${theme.color.accent};
      }
    `}
`

export const Toggle = styled.button`
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.color.border};
    color: ${({ theme }) => theme.color.text};
  }
`

/**
 * Содержимое строки — кнопка: клик (и Enter/Space с клавиатуры) выбирает узел
 * и прокручивает к нему сводную таблицу. Раскрытие ветви остаётся за отдельным Toggle.
 */
export const SelectButton = styled.button`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
  min-height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;

  @media ${media.narrow} {
    column-gap: ${({ theme }) => theme.space(2)};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.focus};
    outline-offset: -2px;
  }
`

export const Chevron = styled.svg<{ $open: boolean }>`
  width: 12px;
  height: 12px;
  transform: rotate(${({ $open }) => ($open ? 90 : 0)}deg);
  transition: transform 150ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const Name = styled.span<{ $depth: number }>`
  ${flashHost};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${({ $depth }) => ($depth === 0 ? 600 : 400)};

  /* На телефоне названия переносятся: иначе от «Платформа: команда «Альфа»» остаётся «Платфо…».
     Длинные слова (от 10 букв) переносятся по слогам (lang="ru"), разрыв в произвольном месте — последнее средство. */
  @media ${media.narrow} {
    padding-block: ${({ theme }) => theme.space(1.5)};
    white-space: normal;
    -webkit-hyphens: auto;
    hyphens: auto;
    hyphenate-limit-chars: 10 4 4;
    overflow-wrap: break-word;
  }
`

export const Headcount = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  @media ${media.narrow} {
    text-align: end;
  }
`

export const Total = styled.span`
  margin-left: ${({ theme }) => theme.space(2)};
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};

  /* На телефоне «всего N» уходит второй строкой и оставляет место названию. */
  @media ${media.narrow} {
    display: block;
    margin-left: 0;
  }
`
