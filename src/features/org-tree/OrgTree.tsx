import { memo, useEffect, useRef } from 'react'
import styled, { css } from 'styled-components'
import { getChildren } from '@/entities/org/model/buildIndex.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { PerformanceIndicator } from '@/entities/org/ui/PerformanceIndicator.tsx'
import { formatInteger } from '@/shared/lib/format.ts'
import { usePrefersReducedMotion } from '@/shared/lib/useMediaQuery.ts'
import { Collapse } from '@/shared/ui/Collapse.tsx'
import { Flash } from '@/shared/ui/Flash.tsx'
import { media } from '@/shared/ui/media.ts'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden.ts'
import type { TreeSelection } from './useOrgTreeState.ts'

const List = styled.ul`
  margin: 0;
  padding: ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(2)};
  list-style: none;
`

const Group = styled.ul`
  margin: 0 0 0 ${({ theme }) => theme.space(5)};
  padding: 0 0 0 ${({ theme }) => theme.space(1)};
  list-style: none;
  border-left: 1px solid ${({ theme }) => theme.color.border};

  /* На телефоне каждый уровень отнимает у названия меньше ширины. */
  @media ${media.narrow} {
    margin-left: ${({ theme }) => theme.space(3)};
  }
`

const Row = styled.div<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto auto;
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

const Toggle = styled.button`
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

const Chevron = styled.svg<{ $open: boolean }>`
  width: 12px;
  height: 12px;
  transform: rotate(${({ $open }) => ($open ? 90 : 0)}deg);
  transition: transform 150ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Name = styled.span<{ $depth: number }>`
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

const Headcount = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  @media ${media.narrow} {
    text-align: end;
  }
`

const Total = styled.span`
  margin-left: ${({ theme }) => theme.space(2)};
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};

  /* На телефоне «всего N» уходит второй строкой и оставляет место названию. */
  @media ${media.narrow} {
    display: block;
    margin-left: 0;
  }
`

interface TreeNodeProps {
  id: string
  model: OrgModel
  expanded: ReadonlySet<string>
  selectedId: string | null
  animate: boolean
  onToggle: (id: string) => void
}

const TreeNode = memo(function TreeNode({ id, model, expanded, selectedId, animate, onToggle }: TreeNodeProps) {
  const node = model.nodes.get(id)!
  const depth = model.depth.get(id)!
  const childIds = getChildren(model, id)
  const hasChildren = childIds.length > 0
  const isExpanded = hasChildren && expanded.has(id)
  const isSelected = selectedId === id
  const groupId = `org-tree-group-${id}`
  const totalHeadcount = model.aggregates.get(id)!.totalHeadcount

  return (
    <li>
      <Row $selected={isSelected} data-node-id={id} aria-current={isSelected || undefined}>
        {hasChildren ? (
          <Toggle
            type="button"
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? groupId : undefined}
            aria-label={`${isExpanded ? 'Свернуть' : 'Развернуть'} «${node.name}»`}
            onClick={() => onToggle(id)}
          >
            <Chevron $open={isExpanded} viewBox="0 0 12 12" aria-hidden="true">
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </Chevron>
          </Toggle>
        ) : (
          <span aria-hidden="true" />
        )}
        <Name $depth={depth} title={node.name}>
          {node.name}
          {isSelected && <VisuallyHidden>, выбрано</VisuallyHidden>}
        </Name>
        <Headcount title="Сотрудников в самом подразделении и во всём поддереве">
          <Flash value={node.headcount}>{formatInteger(node.headcount)} чел.</Flash>
          {hasChildren && (
            <Total>
              <Flash value={totalHeadcount}>всего {formatInteger(totalHeadcount)}</Flash>
            </Total>
          )}
        </Headcount>
        <Flash value={Math.round(node.performance)}>
          <PerformanceIndicator value={node.performance} />
        </Flash>
      </Row>
      {hasChildren && (
        <Collapse open={isExpanded} animate={animate}>
          <Group id={groupId}>
            {childIds.map((childId) => (
              <TreeNode
                key={childId}
                id={childId}
                model={model}
                expanded={expanded}
                selectedId={selectedId}
                animate={animate}
                onToggle={onToggle}
              />
            ))}
          </Group>
        </Collapse>
      )}
    </li>
  )
})

interface OrgTreeProps {
  model: OrgModel
  expanded: ReadonlySet<string>
  onToggle: (id: string) => void
  selection: TreeSelection | null
  /** Анимировать раскрытие ветвей (по клику — да, при выборе узла из таблицы — нет). */
  animate: boolean
}

export const OrgTree = memo(function OrgTree({ model, expanded, onToggle, selection, animate }: OrgTreeProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const selectedId = selection?.id ?? null
  const request = selection?.request
  // Настройка читается через ref: её смена не должна сама прокручивать дерево.
  const reducedMotion = usePrefersReducedMotion()
  const reducedMotionRef = useRef(reducedMotion)
  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  // Прокрутка к узлу при каждом выборе в таблице и при монтировании дерева с уже выбранным узлом.
  // Предки раскрываются в том же обновлении состояния, поэтому строка к этому моменту уже в DOM.
  useEffect(() => {
    if (!selectedId || !listRef.current) return
    const rows = listRef.current.querySelectorAll<HTMLElement>('[data-node-id]')
    const row = Array.from(rows).find((element) => element.dataset.nodeId === selectedId)
    row?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotionRef.current ? 'auto' : 'smooth' })
  }, [selectedId, request])

  return (
    <List ref={listRef} aria-label="Оргструктура">
      {model.roots.map((id) => (
        <TreeNode
          key={id}
          id={id}
          model={model}
          expanded={expanded}
          selectedId={selectedId}
          animate={animate}
          onToggle={onToggle}
        />
      ))}
    </List>
  )
})
