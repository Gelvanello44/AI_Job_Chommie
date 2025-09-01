import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'

test('exact TTI and role items for 6m', async () => {
  render(<Analytics />)
  expect(await screen.findByText('Analytics')).toBeInTheDocument()
  const select = await screen.findByDisplayValue('Last 3 months')
  fireEvent.change(select, { target: { value: '6m' } })

  expect(await screen.findByTestId('tti-0-7')).toHaveTextContent('0-7:3')
  expect(await screen.findByTestId('tti-8-14')).toHaveTextContent('8-14:2')
  expect(await screen.findByTestId('tti-15-30')).toHaveTextContent('15-30:1')

  expect(await screen.findByTestId('role-Developer')).toHaveTextContent(/Developer:8\/3/)
  expect(await screen.findByTestId('role-Analyst')).toHaveTextContent(/Analyst:5\/2/)
  expect(await screen.findByTestId('role-Support')).toHaveTextContent(/Support:3\/0/)
})

