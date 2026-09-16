import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from 'styled-components'
import { GlobalStyle } from '@/shared/ui/GlobalStyle/index.ts'
import { theme } from '@/shared/ui/theme.ts'
import { Dashboard } from '@/widgets/dashboard/Dashboard.tsx'
import { createQueryClient } from './queryClient.ts'

export function App() {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <Dashboard />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
