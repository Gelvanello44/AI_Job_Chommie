import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { vi } from 'vitest'
import Alerts from '@/pages/Alerts'

vi.useFakeTimers()

function getCountdownText() {
  const el = screen.getByTestId('next-digest')
  return el.textContent || ''
}

test('countdown updates after a minute', async () => {
  render(<Alerts />)
  expect(await screen.findByText('Job Alerts')).toBeInTheDocument()
  const before = getCountdownText()
  await act(async () => {
    vi.advanceTimersByTime(60000)
  })
  const after = getCountdownText()
  expect(after).not.toEqual(before)
  expect(after).toMatch(/in\s+\d+[dhm]/)
})

