import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { describeError } from '@/shared/api/describeError.ts'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView/index.ts'
import * as S from './OrgModelBoundary.styled.ts'

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
        <S.StaleBanner role="status">
          Не удалось обновить данные, показаны последние загруженные.
          <S.InlineButton type="button" onClick={() => query.refetch()}>
            Повторить
          </S.InlineButton>
        </S.StaleBanner>
      )}
      {children(model)}
    </>
  )
}
