import { useState } from 'react'
import styled from 'styled-components'
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
import { OrgModelBoundary } from './OrgModelBoundary.tsx'
import { ViewSwitch, type DashboardView } from './ViewSwitch.tsx'

const Page = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space(6)} ${theme.space(6)} ${theme.space(10)}`};

  @media ${media.narrow} {
    padding: ${({ theme }) => `${theme.space(4)} ${theme.space(3)}`};
  }

  /* В split-view страница занимает ровно экран, а панели прокручиваются независимо. */
  @media ${media.split} {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding-bottom: ${({ theme }) => theme.space(6)};
  }
`

const Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => `${theme.space(2)} ${theme.space(4)}`};
  margin-bottom: ${({ theme }) => theme.space(5)};
`

const TitleGroup = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space(0.5)};
`

const HeaderControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
`

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
`

const Summary = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.color.textMuted};
  font-variant-numeric: tabular-nums;
`

const Main = styled.main`
  display: grid;
  gap: ${({ theme }) => theme.space(4)};

  @media ${media.split} {
    flex: 1;
    min-height: 0;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    /* Без явной высоты строки grid растягивается по содержимому и панели не прокручиваются. */
    grid-template-rows: minmax(0, 1fr);
  }
`

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.panel};
  overflow: hidden;
`

const PanelHeader = styled.h2`
  margin: 0;
  padding: ${({ theme }) => `${theme.space(3)} ${theme.space(4)}`};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  font-size: ${({ theme }) => theme.font.size.md};
`

const ScrollArea = styled.div`
  /* Контейнер для скрытых подписей (position: absolute), иначе они выходят за overflow и растягивают страницу. */
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
`

function HeaderSummary({ model }: { model: OrgModel | undefined }) {
  if (!model || model.nodes.size === 0) return null

  const totalHeadcount = model.roots.reduce((sum, id) => sum + model.aggregates.get(id)!.totalHeadcount, 0)
  return (
    <Summary>
      {formatInteger(model.nodes.size)} подразделений · {formatInteger(totalHeadcount)} сотрудников
    </Summary>
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
  const tree = useOrgTreeState(model)
  const table = useOrgTableState()

  const treePanel = (
    <Panel aria-labelledby="tree-panel-title">
      <PanelHeader id="tree-panel-title">Дерево подразделений</PanelHeader>
      <OrgModelBoundary query={query} skeleton="tree">
        {(data) => (
          <ScrollArea>
            <OrgTree
              model={data}
              expanded={tree.expanded}
              onToggle={tree.toggle}
              selection={tree.selection}
              animate={tree.animate}
            />
          </ScrollArea>
        )}
      </OrgModelBoundary>
    </Panel>
  )

  const tablePanel = (
    <Panel aria-labelledby="table-panel-title">
      <PanelHeader id="table-panel-title">Сводная таблица</PanelHeader>
      <OrgModelBoundary query={query} skeleton="table">
        {(data) => (
          <OrgTable model={data} state={table} selectedId={tree.selection?.id ?? null} onSelect={tree.select} />
        )}
      </OrgModelBoundary>
    </Panel>
  )

  return (
    <Page>
      <Header>
        <TitleGroup>
          <Title>Оргструктура компании</Title>
          <HeaderSummary model={model} />
        </TitleGroup>
        <HeaderControls>
          <ConnectionIndicator status={liveStatus} />
          {!isSplit && <ViewSwitch value={view} onChange={setView} />}
        </HeaderControls>
      </Header>
      <Main>
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
      </Main>
    </Page>
  )
}
