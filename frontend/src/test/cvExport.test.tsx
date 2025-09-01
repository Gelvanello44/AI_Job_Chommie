import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import CvBuilder from '@/pages/CvBuilder'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/queryClient'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = createQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('export calls backend stub and shows Download link', async () => {
  render(<Wrapper><CvBuilder /></Wrapper>)
  expect(await screen.findByText('CV Builder')).toBeInTheDocument()
  const btn = await screen.findByText('Export PDF')
  fireEvent.click(btn)
  await waitFor(async () => {
    expect(await screen.findByText('Download')).toBeInTheDocument()
  })
})

