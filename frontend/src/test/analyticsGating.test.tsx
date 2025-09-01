import { render, screen } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'
import { TestProviders } from './utils'

test('analytics page shows upsell for free plan', async () => {
  render(<TestProviders><Analytics /></TestProviders>)
  expect(await screen.findByText(/Application performance analytics/)).toBeInTheDocument()
})

test('analytics page shows content for pro plan', async () => {
  render(<TestProviders><Analytics /></TestProviders>)
  expect(await screen.findByText('Applications')).toBeInTheDocument()
})

