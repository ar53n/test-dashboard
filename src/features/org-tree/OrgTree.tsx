import { memo, useRef } from 'react'
import { getChildren } from '@/entities/org/model/buildIndex.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import type { OrgSelection } from '@/entities/org/model/selection.ts'
import { PerformanceIndicator } from '@/entities/org/ui/PerformanceIndicator/index.ts'
import { formatInteger } from '@/shared/lib/format.ts'
import { useScrollToSelected } from '@/shared/lib/useScrollToSelected.ts'
import { Collapse } from '@/shared/ui/Collapse/index.ts'
import { Flash, FlashOverlay, useChangeCount } from '@/shared/ui/Flash/index.ts'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden/index.ts'
import * as S from './OrgTree.styled.ts'

/** Props, которые дерево без изменений передаёт каждому узлу. */
interface TreeInteractionProps {
  model: OrgModel
  expanded: ReadonlySet<string>
  /** Анимировать раскрытие ветвей (по клику — да, при выборе узла из таблицы — нет). */
  animate: boolean
  onToggle: (id: string) => void
  /** Выбор узла: подсвечивает его в обеих панелях и прокручивает к строке сводную таблицу. */
  onSelect: (id: string) => void
}

interface TreeNodeProps extends TreeInteractionProps {
  id: string
  selectedId: string | null
}

const TreeNode = memo(function TreeNode({
  id,
  model,
  expanded,
  selectedId,
  animate,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const node = model.nodes.get(id)!
  const depth = model.depth.get(id)!
  const childIds = getChildren(model, id)
  const hasChildren = childIds.length > 0
  const isExpanded = hasChildren && expanded.has(id)
  const isSelected = selectedId === id
  const groupId = `org-tree-group-${id}`
  const totalHeadcount = model.aggregates.get(id)!.totalHeadcount
  const nameChanges = useChangeCount(node.name)

  return (
    <li>
      <S.Row $selected={isSelected} data-node-id={id} aria-current={isSelected || undefined}>
        {hasChildren ? (
          <S.Toggle
            type="button"
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? groupId : undefined}
            aria-label={`${isExpanded ? 'Свернуть' : 'Развернуть'} «${node.name}»`}
            onClick={() => onToggle(id)}
          >
            <S.Chevron $open={isExpanded} viewBox="0 0 12 12" aria-hidden="true">
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </S.Chevron>
          </S.Toggle>
        ) : (
          <span aria-hidden="true" />
        )}
        <S.SelectButton type="button" onClick={() => onSelect(id)}>
          <S.Name $depth={depth} title={node.name}>
            {nameChanges > 0 && <FlashOverlay key={nameChanges} aria-hidden="true" />}
            {node.name}
            {isSelected && <VisuallyHidden>, выбрано</VisuallyHidden>}
          </S.Name>
          <S.Headcount title="Сотрудников в самом подразделении и во всём поддереве">
            <Flash value={node.headcount}>{formatInteger(node.headcount)} чел.</Flash>
            {hasChildren && (
              <S.Total>
                <Flash value={totalHeadcount}>всего {formatInteger(totalHeadcount)}</Flash>
              </S.Total>
            )}
          </S.Headcount>
          <Flash value={Math.round(node.performance)}>
            <PerformanceIndicator value={node.performance} />
          </Flash>
        </S.SelectButton>
      </S.Row>
      {hasChildren && (
        <Collapse open={isExpanded} animate={animate}>
          <S.Group id={groupId}>
            {childIds.map((childId) => (
              <TreeNode
                key={childId}
                id={childId}
                model={model}
                expanded={expanded}
                selectedId={selectedId}
                animate={animate}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </S.Group>
        </Collapse>
      )}
    </li>
  )
})

interface OrgTreeProps extends TreeInteractionProps {
  selection: OrgSelection | null
}

export const OrgTree = memo(function OrgTree({
  model,
  expanded,
  onToggle,
  onSelect,
  selection,
  animate,
}: OrgTreeProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const selectedId = selection?.id ?? null

  // Прокрутка к узлу при выборе в таблице. Предки раскрываются в том же обновлении состояния,
  // поэтому строка к этому моменту уже в DOM.
  useScrollToSelected(selection?.request, selection?.source === 'tree', () => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-node-id]') ?? []
    return Array.from(rows).find((element) => element.dataset.nodeId === selectedId)
  })

  return (
    <S.List ref={listRef} aria-label="Оргструктура">
      {model.roots.map((id) => (
        <TreeNode
          key={id}
          id={id}
          model={model}
          expanded={expanded}
          selectedId={selectedId}
          animate={animate}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </S.List>
  )
})
