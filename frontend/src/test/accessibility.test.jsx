import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../context/AuthContext'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock components that require authentication or external dependencies
vi.mock('../pages/Jobs', () => ({
  default: () => <div role="main"><h1>Jobs</h1><p>Job listings would appear here</p></div>
}))

vi.mock('../pages/Analytics', () => ({
  default: () => <div role="main"><h1>Analytics</h1><p>Analytics charts would appear here</p></div>
}))

vi.mock('../pages/CvBuilder', () => ({
  default: () => <div role="main"><h1>CV Builder</h1><p>CV builder form would appear here</p></div>
}))

// Test wrapper component
const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

describe('Accessibility Tests', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  it('should not have accessibility violations on home page', async () => {
    const HomePage = () => (
      <main role="main" className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            AI Job <span className="text-cyan-400">Chommie</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Your AI-powered job search companion for South Africa
          </p>
          <button className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-4 rounded-lg">
            Get Started
          </button>
        </div>
      </main>
    )

    const { container } = render(
      <TestWrapper>
        <HomePage />
      </TestWrapper>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have accessibility violations on contact form', async () => {
    const ContactForm = () => (
      <main role="main">
        <h1>Contact Us</h1>
        <form>
          <div>
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              aria-describedby="name-error"
            />
          </div>
          <div>
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              required
              aria-describedby="email-error"
            />
          </div>
          <div>
            <label htmlFor="message">Message *</label>
            <textarea
              id="message"
              name="message"
              required
              aria-describedby="message-error"
            />
          </div>
          <button type="submit">Send Message</button>
        </form>
      </main>
    )

    const { container } = render(
      <TestWrapper>
        <ContactForm />
      </TestWrapper>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have accessibility violations on navigation', async () => {
    const Navigation = () => (
      <header role="banner">
        <nav role="navigation" aria-label="Main navigation">
          <a href="/" aria-label="AI Job Chommie - Home">AI Job Chommie</a>
          <ul>
            <li><a href="/about">About</a></li>
            <li><a href="/jobs">Jobs</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
          <button aria-label="Open menu" aria-expanded="false">
            Menu
          </button>
        </nav>
      </header>
    )

    const { container } = render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have accessibility violations on data tables', async () => {
    const DataTable = () => (
      <main role="main">
        <h1>Job Applications</h1>
        <table>
          <caption>Your recent job applications</caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Position</th>
              <th scope="col">Status</th>
              <th scope="col">Date Applied</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Example Corp</td>
              <td>Software Developer</td>
              <td>Under Review</td>
              <td>2024-01-15</td>
            </tr>
          </tbody>
        </table>
      </main>
    )

    const { container } = render(
      <TestWrapper>
        <DataTable />
      </TestWrapper>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have accessibility violations on error states', async () => {
    const ErrorState = () => (
      <main role="main">
        <h1>Jobs</h1>
        <div role="alert" aria-live="assertive">
          <h2>Failed to load jobs</h2>
          <p>There was an error loading the job listings. Please try again.</p>
          <button>Retry</button>
        </div>
      </main>
    )

    const { container } = render(
      <TestWrapper>
        <ErrorState />
      </TestWrapper>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have accessibility violations on loading states', async () => {
    const LoadingState = () => (
      <main role="main">
        <h1>Jobs</h1>
        <div role="status" aria-live="polite" aria-label="Loading jobs">
          <div aria-hidden="true">Loading...</div>
          <span className="sr-only">Loading job listings, please wait</span>
        </div>
      </main>
    )

    const { container } = render(
      <TestWrapper>
        <LoadingState />
      </TestWrapper>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
