import * as S from './ViewSwitch.styled.ts'

export type DashboardView = 'tree' | 'table'

const OPTIONS: readonly { value: DashboardView; label: string }[] = [
  { value: 'tree', label: 'Дерево' },
  { value: 'table', label: 'Таблица' },
]

/** Переключатель «Дерево / Таблица» для экранов уже 1280px. */
export function ViewSwitch({ value, onChange }: { value: DashboardView; onChange: (view: DashboardView) => void }) {
  return (
    <S.Group role="group" aria-label="Вид">
      {OPTIONS.map((option) => (
        <S.Option
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </S.Option>
      ))}
    </S.Group>
  )
}
