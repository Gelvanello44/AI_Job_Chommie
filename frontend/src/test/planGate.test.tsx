import { render, screen } from '@testing-library/react'
import React from 'react'
import PlanGate from '@/components/PlanGate'
import { TestProviders } from './utils'

function Example({ children }: { children: React.ReactNode }) {
  return (
    <TestProviders>
      {/* Allow prop is set at call sites */}
      <>{children}</>
    </TestProviders>
  )
}

test('PlanGate hides children for free plan', () => {
  render(
    <Example>
      <PlanGate allow={['pro','executive']}>
        <div>Pro Content</div>
      </PlanGate>
    </Example>
  )
  expect(screen.queryByText('Pro Content')).toBeNull()
})

test('PlanGate shows children for pro plan', () => {
  render(
    <Example>
      <PlanGate allow={['pro','executive']}>
        <div>Pro Content</div>
      </PlanGate>
    </Example>
  )
  expect(screen.getByText('Pro Content')).toBeInTheDocument()
})

