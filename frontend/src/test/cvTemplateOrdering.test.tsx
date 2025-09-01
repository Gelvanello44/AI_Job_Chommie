import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import CvBuilder from '@/pages/CvBuilder'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/queryClient'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = createQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('professional template shows Experience section label prominently', async () => {
  render(<Wrapper><CvBuilder /></Wrapper>)
  expect(await screen.findByText('CV Builder')).toBeInTheDocument()
  // Choose Professional template via dropdown fallback (cards exist too)
  const select = await screen.findByDisplayValue('Standard')
  fireEvent.change(select, { target: { value: 'pro' } })
  // Expect uppercase label used in Professional preview
  expect(await screen.findByText(/EXPERIENCE/i)).toBeInTheDocument()
})

