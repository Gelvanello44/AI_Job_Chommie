import { render, screen } from '@testing-library/react'
import React from 'react'
import QuotaBanner from '@/components/QuotaBanner'

function Wrapper({ used, limit }: { used: number, limit: number }) {
  const Ctx = React.createContext({ user: { quotas: { autoApplicationsUsed: used, autoApplicationsLimit: limit }}} as any)
  return (
    <Ctx.Provider value={{ user: { quotas: { autoApplicationsUsed: used, autoApplicationsLimit: limit }}} as any}>
      {/* @ts-ignore */}
      <QuotaBanner />
    </Ctx.Provider>
  )
}

test('shows banner when near limit', () => {
  render(<Wrapper used={8} limit={10} />)
  expect(screen.getByText(/Approaching auto-apply limit/)).toBeInTheDocument()
})

test('does not show banner when far from limit', () => {
  render(<Wrapper used={2} limit={10} />)
  expect(screen.queryByText(/Approaching auto-apply limit|limit reached/)).toBeNull()
})

