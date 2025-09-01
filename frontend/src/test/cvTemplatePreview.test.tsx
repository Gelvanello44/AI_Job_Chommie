import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import CvBuilder from '@/pages/CvBuilder'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/queryClient'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = createQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('template card selection updates dropdown and keeps preview visible', async () => {
  render(<Wrapper><CvBuilder /></Wrapper>)
  expect(await screen.findByText('CV Builder')).toBeInTheDocument()
  // Click first template card (Standard)
  const stdCard = (await screen.findAllByText('Standard'))[0]
  fireEvent.click(stdCard)
  // Dropdown should reflect selection
  const select = screen.getByDisplayValue('Standard') as HTMLSelectElement
  expect(select.value).toBe('std')
  // Fill some content and see preview
  // We will just assert the preview container exists
  expect(await screen.findByText(/ATS guidance/)).toBeInTheDocument()
})

