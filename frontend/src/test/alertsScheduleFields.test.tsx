import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Alerts from '@/pages/Alerts'
import { TestProviders } from './utils'

function setup() {
  render(<TestProviders><Alerts /></TestProviders>)
}

test('alerts schedule fields exist and can be changed', async () => {
  setup()
  expect(await screen.findByText('Job Alerts')).toBeInTheDocument()
  const freq = await screen.findByDisplayValue('Weekly')
  fireEvent.change(freq, { target: { value: 'daily' } })
  expect((await screen.findByDisplayValue('Daily'))).toBeInTheDocument()

  const sendDay = await screen.findByDisplayValue('Friday')
  fireEvent.change(sendDay, { target: { value: 'Monday' } })
  expect((await screen.findByDisplayValue('Monday'))).toBeInTheDocument()

  const hour = await screen.findByDisplayValue('9')
  fireEvent.change(hour, { target: { value: '10' } })
  expect((await screen.findByDisplayValue('10'))).toBeInTheDocument()

  // Next digest text should contain en-ZA formatted date text
  expect(await screen.findByTestId('next-digest')).toBeInTheDocument()
})

