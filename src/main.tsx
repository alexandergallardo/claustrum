import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/components/theme-provider'
import { queryClient } from '@/lib/query-client'
import { getRouter } from './router'
import './styles.css'

const router = getRouter()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
