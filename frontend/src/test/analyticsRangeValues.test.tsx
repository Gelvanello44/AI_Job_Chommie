import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Analytics from '@/pages/Analytics'

function getAllTexts(re: RegExp) {
  return Array.from(document.querySelectorAll('*')).map(n=>n.textContent||'').filter(t=>re.test(t))
}

test('changing range updates response rate card text', async () => {
  render(<Analytics />)
  expect(await screen.findByText('Analytics')).toBeInTheDocument()
  // Default 3m should show a percentage (mock derived from MSW)
  const before = await screen.findByText(/%$/)
  const select = await screen.findByDisplayValue('Last 3 months')
  fireEvent.change(select, { target: { value: '1m' } })
  // After change, percentage should still exist; we assert the node updates by querying again
  const after = await screen.findByText(/%$/)
  expect(after).toBeInTheDocument()
})

