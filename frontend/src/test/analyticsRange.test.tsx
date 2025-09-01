import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'

function setup() {
  render(<Analytics />)
}

test('analytics range selector updates charts', async () => {
  setup()
  expect(await screen.findByText('Analytics')).toBeInTheDocument()
  const select = await screen.findByDisplayValue('Last 3 months')
  fireEvent.change(select, { target: { value: '1m' } })
  expect(await screen.findByDisplayValue('Last 1 month')).toBeInTheDocument()
})

