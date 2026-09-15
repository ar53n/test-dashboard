import { memo } from 'react'
import styled from 'styled-components'
import { getChildren } from '@/entities/org/model/buildIndex.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { PerformanceIndicator } from '@/entities/org/ui/PerformanceIndicator.tsx'
import { useExpandedState } from './useExpandedState.ts'

const List = styled.ul`
  margin: 0;
  padding: ${({ theme }) => theme.space(2)} 0;
  list-style: none;
`

const Group = styled.ul`
  margin: 0 0 0 ${({ theme }) => theme.space(5)};
  padding: 0 0 0 ${({ theme }) => theme.space(1)};
  list-style: none;
  border-left: 1px solid ${({ theme }) => theme.color.border};
`

const Row = styled.div`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
  min-height: 36px;
  padding: 0 ${({ theme }) => theme.space(3)} 0 ${({ theme }) => theme.space(1)};
  border-radius: ${({ theme }) => theme.radius.sm};

  &:hover {
    background: ${({ theme }) => theme.color.surfaceHover};
  }
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
`

const Headcount = styled.span`
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.color.textMuted};
  white-space: nowrap;
`

interface TreeNodeProps {
  id: string
  model: OrgModel
  expanded: ReadonlySet<string>
  onToggle: (id: string) => void
}

const TreeNode = memo(function TreeNode({ id, model, expanded, onToggle }: TreeNodeProps) {
  const node = model.nodes.get(id)!
  const depth = model.depth.get(id)!
  const childIds = getChildren(model, id)
  const hasChildren = childIds.length > 0
  const isExpanded = hasChildren && expanded.has(id)
  const groupId = `org-tree-group-${id}`

  return (
    <li>
      <Row>
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
        </Name>
        <Headcount title="Сотрудников в подразделении">{node.headcount} чел.</Headcount>
        <PerformanceIndicator value={node.performance} />
      </Row>
      {isExpanded && (
        <Group id={groupId}>
          {childIds.map((childId) => (
            <TreeNode key={childId} id={childId} model={model} expanded={expanded} onToggle={onToggle} />
          ))}
        </Group>
      )}
    </li>
  )
})

export function OrgTree({ model }: { model: OrgModel }) {
  const { expanded, toggle } = useExpandedState(model)

  return (
    <List aria-label="Оргструктура">
      {model.roots.map((id) => (
        <TreeNode key={id} id={id} model={model} expanded={expanded} onToggle={toggle} />
      ))}
    </List>
  )
}
