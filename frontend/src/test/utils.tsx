import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/context/AuthContext'

export function TestProviders({ children }: { children: React.ReactNode }) {
  const qc = createQueryClient()
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

