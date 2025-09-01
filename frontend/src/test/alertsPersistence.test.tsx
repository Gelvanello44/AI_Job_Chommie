import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Alerts from '@/pages/Alerts'

function renderAlerts() {
  return render(<Alerts />)
}

test('alerts settings persist round-trip', async () => {
  renderAlerts()
  expect(await screen.findByText('Job Alerts')).toBeInTheDocument()
  const roles = (await screen.findByPlaceholderText('Roles (comma separated)')) as HTMLInputElement
  fireEvent.change(roles, { target: { value: 'developer, analyst' } })
  fireEvent.click(screen.getByText('Save alerts'))
  // Simulate re-render
  renderAlerts()
  const rolesAgain = (await screen.findByPlaceholderText('Roles (comma separated)')) as HTMLInputElement
  expect(rolesAgain.value).toContain('developer')
})

