import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import styled from 'styled-components'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { describeError } from '@/shared/api/describeError.ts'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView/index.ts'

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

interface OrgModelBoundaryProps {
  query: UseQueryResult<OrgModel>
  skeleton: 'tree' | 'table'
  children: (model: OrgModel) => ReactNode
}

/** Общие состояния панели: загрузка, ошибка, пустой ответ и неудачное фоновое обновление. */
export function OrgModelBoundary({ query, skeleton, children }: OrgModelBoundaryProps) {
  if (query.isPending) return <LoadingState label="Загружаем оргструктуру…" variant={skeleton} />

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
      {children(model)}
    </>
  )
}
