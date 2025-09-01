import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'
import { TestProviders } from './utils'

test('exact TTI and role items per range', async () => {
  render(<TestProviders><Analytics /></TestProviders>)
  expect(await screen.findByText('Analytics')).toBeInTheDocument()

  // Default 3m (from handlers)
  expect(await screen.findByTestId('tti-0-7')).toHaveTextContent('0-7:2')
  expect(await screen.findByTestId('tti-8-14')).toHaveTextContent('8-14:1')
  expect(await screen.findByTestId('tti-15-30')).toHaveTextContent('15-30:1')

  expect(await screen.findByTestId('role-Developer')).toHaveTextContent(/Developer:5\/2/)
  expect(await screen.findByTestId('role-Analyst')).toHaveTextContent(/Analyst:3\/1/)
  expect(await screen.findByTestId('role-Support')).toHaveTextContent(/Support:2\/0/)

  // Switch to 1m
  const select = await screen.findByDisplayValue('Last 3 months')
  fireEvent.change(select, { target: { value: '1m' } })

  expect(await screen.findByTestId('tti-0-7')).toHaveTextContent('0-7:1')
  expect(await screen.findByTestId('tti-8-14')).toHaveTextContent('8-14:0')
  expect(await screen.findByTestId('tti-15-30')).toHaveTextContent('15-30:0')

  expect(await screen.findByTestId('role-Developer')).toHaveTextContent(/Developer:3\/1/)
  expect(await screen.findByTestId('role-Analyst')).toHaveTextContent(/Analyst:2\/1/)
  expect(await screen.findByTestId('role-Support')).toHaveTextContent(/Support:0\/0/)
})

