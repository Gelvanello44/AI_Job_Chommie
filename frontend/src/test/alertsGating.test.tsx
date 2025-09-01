import { render, screen } from '@testing-library/react'
import React from 'react'
import Alerts from '@/pages/Alerts'
import { TestProviders } from './utils'

test('alerts page shows upsell for free plan', async () => {
  render(<TestProviders><Alerts /></TestProviders>)
  expect(await screen.findByText(/Weekly job alerts/)).toBeInTheDocument()
})

test('alerts page shows settings for pro plan', async () => {
  render(<TestProviders><Alerts /></TestProviders>)
  expect(await screen.findByText('Alert settings')).toBeInTheDocument()
})

