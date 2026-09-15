import 'styled-components'
import type { AppTheme } from '@/shared/ui/theme.ts'

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
