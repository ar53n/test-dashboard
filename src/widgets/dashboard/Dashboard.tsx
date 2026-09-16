import { useState } from 'react'
import { useOrgModel } from '@/entities/org/api/orgTreeQuery.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { ConnectionIndicator } from '@/features/live-updates/ConnectionIndicator.tsx'
import { useLiveOrgSync } from '@/features/live-updates/useLiveOrgSync.ts'
import { OrgTable } from '@/features/org-table/OrgTable.tsx'
import { useOrgTableState } from '@/features/org-table/useOrgTableState.ts'
import { OrgTree } from '@/features/org-tree/OrgTree.tsx'
import { useOrgTreeState } from '@/features/org-tree/useOrgTreeState.ts'
import { getScenario } from '@/shared/api/http.ts'
import { formatInteger } from '@/shared/lib/format.ts'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.ts'
import { media } from '@/shared/ui/media.ts'
import { ScrollArea } from '@/shared/ui/ScrollArea/index.ts'
import * as S from './Dashboard.styled.ts'
import { OrgModelBoundary } from './OrgModelBoundary.tsx'
import { ViewSwitch, type DashboardView } from './ViewSwitch.tsx'

function HeaderSummary({ model }: { model: OrgModel | undefined }) {
  if (!model || model.nodes.size === 0) return null

  const totalHeadcount = model.roots.reduce((sum, id) => sum + model.aggregates.get(id)!.totalHeadcount, 0)
  return (
    <S.Summary>
      {formatInteger(model.nodes.size)} подразделений · {formatInteger(totalHeadcount)} сотрудников
    </S.Summary>
  )
}

export function Dashboard() {
  const query = useOrgModel()
  const model = query.data
  const isSplit = useMediaQuery(media.split)
  const [view, setView] = useState<DashboardView>('tree')
  // Демо-сценарии отдают фиксированный ответ без версии — патчи к нему не применимы.
  const [liveEnabled] = useState(() => getScenario() === null)
  const liveStatus = useLiveOrgSync(liveEnabled)

  // Состояние обеих панелей живёт здесь: на узком экране неактивная панель размонтируется,
  // а раскрытые ветви, выбранный узел, поиск и сортировка должны сохраниться.
  // Выбранный узел общий: клик в одной панели прокручивает к узлу вторую.
  const tree = useOrgTreeState(model)
  const table = useOrgTableState()

  const treePanel = (
    <S.Panel aria-labelledby="tree-panel-title">
      <S.PanelHeader id="tree-panel-title">Дерево подразделений</S.PanelHeader>
      <OrgModelBoundary query={query} skeleton="tree">
        {(data) => (
          <ScrollArea>
            <OrgTree
              model={data}
              expanded={tree.expanded}
              onToggle={tree.toggle}
              onSelect={tree.selectFromTree}
              selection={tree.selection}
              animate={tree.animate}
            />
          </ScrollArea>
        )}
      </OrgModelBoundary>
    </S.Panel>
  )

  const tablePanel = (
    <S.Panel aria-labelledby="table-panel-title">
      <S.PanelHeader id="table-panel-title">Сводная таблица</S.PanelHeader>
      <OrgModelBoundary query={query} skeleton="table">
        {(data) => (
          <OrgTable model={data} state={table} selection={tree.selection} onSelect={tree.selectFromTable} />
        )}
      </OrgModelBoundary>
    </S.Panel>
  )

  return (
    <S.Page>
      <S.Header>
        <S.TitleGroup>
          <S.Title>Оргструктура компании</S.Title>
          <HeaderSummary model={model} />
        </S.TitleGroup>
        <S.HeaderControls>
          <ConnectionIndicator status={liveStatus} />
          {!isSplit && <ViewSwitch value={view} onChange={setView} />}
        </S.HeaderControls>
      </S.Header>
      <S.Main>
        {isSplit ? (
          <>
            {treePanel}
            {tablePanel}
          </>
        ) : view === 'tree' ? (
          treePanel
        ) : (
          tablePanel
        )}
      </S.Main>
    </S.Page>
  )
}
