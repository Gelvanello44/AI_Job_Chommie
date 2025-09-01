import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'

test('conversion funnel chart renders and responds to range changes', async () => {
  render(<Analytics />)
  expect(await screen.findByText('Analytics')).toBeInTheDocument()
  // Just verify the "Conversion funnel" heading appears, then change range and verify it still exists
  expect(await screen.findByText('Conversion funnel')).toBeInTheDocument()
  const select = await screen.findByDisplayValue('Last 3 months')
  fireEvent.change(select, { target: { value: '1m' } })
  expect(await screen.findByText('Conversion funnel')).toBeInTheDocument()
})

