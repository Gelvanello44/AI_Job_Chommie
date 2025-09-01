import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'

// Expected values mirror MSW handler data for /me/analytics
const totalsByRange = {
  '1m': { apps: 5, interviews: 2, offers: 1, hires: 0 },
  '3m': { apps: 15, interviews: 6, offers: 2, hires: 1 },
  '6m': { apps: 23, interviews: 9, offers: 3, hires: 1 }, // last 5 months in handler
}

function parseTotals(text: string) {
  // Apps: X • Interviews: Y • Offers: Z • Hires: W
  const m = text.match(/Apps:\s*(\d+).*Interviews:\s*(\d+).*Offers:\s*(\d+).*Hires:\s*(\d+)/)
  if (!m) return null
  return { apps: Number(m[1]), interviews: Number(m[2]), offers: Number(m[3]), hires: Number(m[4]) }
}

test('conversion summary exact totals for each range', async () => {
  render(<Analytics />)
  expect(await screen.findByText('Analytics')).toBeInTheDocument()

  // Default 3m
  const conv3 = await screen.findByTestId('summary-conv')
  expect(parseTotals(conv3.textContent || '')).toEqual(totalsByRange['3m'])

  // Switch to 1m
  const select = await screen.findByDisplayValue('Last 3 months')
  fireEvent.change(select, { target: { value: '1m' } })
  const conv1 = await screen.findByTestId('summary-conv')
  expect(parseTotals(conv1.textContent || '')).toEqual(totalsByRange['1m'])

  // Switch to 6m
  fireEvent.change(select, { target: { value: '6m' } })
  const conv6 = await screen.findByTestId('summary-conv')
  expect(parseTotals(conv6.textContent || '')).toEqual(totalsByRange['6m'])
})

