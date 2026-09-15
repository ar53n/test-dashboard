import styled from 'styled-components'
import { useOrgModel } from '@/entities/org/api/orgTreeQuery.ts'
import { OrgTree } from '@/features/org-tree/OrgTree.tsx'
import { describeError } from '@/shared/api/describeError.ts'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView.tsx'

const Page = styled.div`
  max-width: 1440px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space(6)} ${theme.space(6)} ${theme.space(10)}`};

  @media (max-width: 640px) {
    padding: ${({ theme }) => `${theme.space(4)} ${theme.space(3)}`};
  }
`

const Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space(2)};
  margin-bottom: ${({ theme }) => theme.space(5)};
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

const Panel = styled.section`
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

const StaleBanner = styled.div`
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(4)}`};
  background: ${({ theme }) => theme.color.dangerSurface};
  color: ${({ theme }) => theme.color.danger};
  font-size: ${({ theme }) => theme.font.size.sm};
`

const InlineButton = styled.button`
  margin-left: ${({ theme }) => theme.space(2)};
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
`

const numberFormat = new Intl.NumberFormat('ru-RU')

function TreePanelBody() {
  const query = useOrgModel()

  if (query.isPending) return <LoadingState label="Загружаем оргструктуру…" />

  if (query.isError && !query.data) {
    const { title, description, details } = describeError(query.error)
    return <ErrorState title={title} description={description} details={details} onRetry={() => query.refetch()} />
  }

  const model = query.data!
  if (model.nodes.size === 0) {
    return <EmptyState title="Подразделений нет" description="Сервер вернул пустую оргструктуру." />
  }

  return (
    <>
      {query.isError && (
        <StaleBanner role="status">
          Не удалось обновить данные, показаны последние загруженные.
          <InlineButton type="button" onClick={() => query.refetch()}>
            Повторить
          </InlineButton>
        </StaleBanner>
      )}
      <OrgTree model={model} />
    </>
  )
}

function HeaderSummary() {
  const { data } = useOrgModel()
  if (!data || data.nodes.size === 0) return null

  const totalHeadcount = data.roots.reduce((sum, id) => sum + data.aggregates.get(id)!.totalHeadcount, 0)
  return (
    <Summary>
      {numberFormat.format(data.nodes.size)} подразделений · {numberFormat.format(totalHeadcount)} сотрудников
    </Summary>
  )
}

export function Dashboard() {
  return (
    <Page>
      <Header>
        <Title>Оргструктура компании</Title>
        <HeaderSummary />
      </Header>
      <Panel aria-labelledby="tree-panel-title">
        <PanelHeader id="tree-panel-title">Дерево подразделений</PanelHeader>
        <TreePanelBody />
      </Panel>
    </Page>
  )
}
