import styled from 'styled-components'

export type DashboardView = 'tree' | 'table'

const OPTIONS: readonly { value: DashboardView; label: string }[] = [
  { value: 'tree', label: 'Дерево' },
  { value: 'table', label: 'Таблица' },
]

const Group = styled.div`
  display: inline-flex;
  padding: ${({ theme }) => theme.space(0.5)};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
`

const Option = styled.button`
  padding: ${({ theme }) => `${theme.space(1.5)} ${theme.space(4)}`};
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  font-weight: 500;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.color.text};
  }

  &[aria-pressed='true'] {
    background: ${({ theme }) => theme.color.accent};
    color: ${({ theme }) => theme.color.accentText};
  }
`

/** Переключатель «Дерево / Таблица» для экранов уже 1280px. */
export function ViewSwitch({ value, onChange }: { value: DashboardView; onChange: (view: DashboardView) => void }) {
  return (
    <Group role="group" aria-label="Вид">
      {OPTIONS.map((option) => (
        <Option
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Option>
      ))}
    </Group>
  )
}
