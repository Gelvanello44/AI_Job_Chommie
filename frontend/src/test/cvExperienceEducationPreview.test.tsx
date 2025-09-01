import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import CvBuilder from '@/pages/CvBuilder'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/queryClient'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = createQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('experience and education editors reflect in preview', async () => {
  render(<Wrapper><CvBuilder /></Wrapper>)
  expect(await screen.findByText('CV Builder')).toBeInTheDocument()

  // Fill name and summary to ensure preview visible
  const nameInput = screen.getByPlaceholderText('Full name') as HTMLInputElement
  fireEvent.change(nameInput, { target: { value: 'Jane Doe' } })
  const summaryInput = screen.getByPlaceholderText('Professional summary') as HTMLTextAreaElement
  fireEvent.change(summaryInput, { target: { value: 'Energetic developer' } })

  // Add experience
  fireEvent.click(screen.getByText('Add experience'))
  const roleInput = screen.getAllByPlaceholderText('Role')[0] as HTMLInputElement
  fireEvent.change(roleInput, { target: { value: 'Developer' } })

  // Add education
  fireEvent.click(screen.getByText('Add education'))
  const degreeInput = screen.getAllByPlaceholderText('Degree')[0] as HTMLInputElement
  fireEvent.change(degreeInput, { target: { value: 'BSc CS' } })

  // Check preview reflects values
  expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
  expect(await screen.findByText(/Developer @/)).toBeInTheDocument()
  expect(await screen.findByText(/BSc CS @/)).toBeInTheDocument()
})

