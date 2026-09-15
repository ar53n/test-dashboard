import { ApiError } from './http.ts'

export interface ErrorDescription {
  title: string
  description: string
  details: readonly string[]
}

export function describeError(error: unknown): ErrorDescription {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return {
          title: 'Нет связи с сервером',
          description: 'Проверьте подключение и попробуйте ещё раз.',
          details: [],
        }
      case 'http':
        return {
          title: 'Сервер не смог обработать запрос',
          description: `Код ответа: ${error.status}. Попробуйте повторить запрос позже.`,
          details: [],
        }
      case 'validation':
        return {
          title: 'Сервер вернул некорректные данные',
          description: `${error.message}. Данные не отображаются, чтобы не показать неверные цифры.`,
          details: error.details,
        }
    }
  }
  return {
    title: 'Что-то пошло не так',
    description: error instanceof Error ? error.message : 'Неизвестная ошибка',
    details: [],
  }
}
