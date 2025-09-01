import { render, screen } from '@testing-library/react'
import React from 'react'
import Alerts from '@/pages/Alerts'

test('alerts next digest shows en-ZA formatted date and countdown', async () => {
  render(<Alerts />)
  expect(await screen.findByText('Job Alerts')).toBeInTheDocument()
  const el = await screen.findByTestId('next-digest')
  expect(el.textContent).toMatch(/Next digest on /)
  // Allow either SAST or a fallback 'GMT' depending on environment, but prefer SAST
  expect(el.textContent).toMatch(/SAST|GMT/)
  expect(el.textContent).toMatch(/in \d+[dhm]/)
})

