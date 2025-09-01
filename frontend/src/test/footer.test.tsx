import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import App from '@/App'

test('footer shows accessible links, version and last-updated, and is keyboard navigable', async () => {
  render(<App />)
  const user = userEvent.setup()

  const terms = await screen.findByLabelText(/Terms of Service link/i)
  const privacy = await screen.findByLabelText(/Privacy Policy link/i)
  expect(terms).toBeInTheDocument()
  expect(terms).toHaveAttribute('href', '/terms')
  expect(privacy).toBeInTheDocument()
  expect(privacy).toHaveAttribute('href', '/privacy')

  expect(await screen.findByLabelText(/app-version/i)).toHaveTextContent(/^v\d+/)
  expect(await screen.findByLabelText(/last-updated/i)).toHaveTextContent(/Last updated:/)

  // Keyboard navigation: tab through Terms -> Privacy
  terms.focus()
  expect(terms).toHaveFocus()
  await user.tab()
  expect(privacy).toHaveFocus()
})

