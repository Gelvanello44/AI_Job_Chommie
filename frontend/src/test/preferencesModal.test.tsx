import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Preferences from '@/pages/Preferences'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/queryClient'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = createQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('shows confirmation modal when enabling auto-apply', async () => {
  render(<Wrapper><Preferences /></Wrapper>)
  // wait for content
  expect(await screen.findByText('Job Preferences')).toBeInTheDocument()
  const checkbox = screen.getByLabelText('Enable auto-apply') as HTMLInputElement
  fireEvent.click(checkbox)
  fireEvent.click(screen.getByText('Save preferences'))
  expect(await screen.findByText('Enable auto-apply?')).toBeInTheDocument()
})

