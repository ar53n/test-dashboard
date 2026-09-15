export const theme = {
  color: {
    background: '#f4f5f7',
    surface: '#ffffff',
    surfaceHover: '#f0f3f8',
    surfaceSelected: '#e6efff',
    border: '#e1e4ea',
    text: '#1c2230',
    textMuted: '#667085',
    accent: '#2f6fed',
    accentText: '#ffffff',
    danger: '#c4320a',
    dangerSurface: '#fef3f2',
    focus: '#2f6fed',
    skeleton: '#e7eaf0',
    performance: {
      low: '#d92d20',
      mid: '#dc9a06',
      high: '#12a150',
    },
  },
  font: {
    family: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
    size: { sm: '0.8125rem', md: '0.9375rem', lg: '1.25rem' },
  },
  space: (multiplier: number) => `${multiplier * 4}px`,
  radius: { sm: '6px', md: '10px' },
  shadow: { panel: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)' },
} as const

export type AppTheme = typeof theme
