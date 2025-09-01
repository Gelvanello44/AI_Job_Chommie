import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'

function setup() {
  render(<Analytics />)
}

test('conversion summary shows totals and updates by range', async () => {
  setup()
  expect(await screen.findByText('Analytics')).toBeInTheDocument()
  const conv = await screen.findByTestId('summary-conv')
  expect(conv.textContent).toMatch(/Apps:/)
  const select = await screen.findByDisplayValue('Last 3 months')
  fireEvent.change(select, { target: { value: '1m' } })
  const conv1m = await screen.findByTestId('summary-conv')
  expect(conv1m.textContent).toMatch(/Apps:/)
})

test('tti bucket summary shows labels and values', async () => {
  setup()
  expect(await screen.findByText('Analytics')).toBeInTheDocument()
  const summary = await screen.findByTestId('summary-tti')
  expect(summary.textContent).toMatch(/0-7:\d+/)
})

test('role summary shows role totals', async () => {
  setup()
  expect(await screen.findByText('Analytics')).toBeInTheDocument()
  const summary = await screen.findByTestId('summary-roles')
  expect(summary.textContent).toMatch(/Developer:\d+\/\d+/)
})

