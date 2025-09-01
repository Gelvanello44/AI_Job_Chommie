import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Menu, X, Brain } from 'lucide-react'
import HomePage from './pages/HomePage'
import ContactPage from './pages/ContactPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import PricingPage from './PricingPage'
import './App.css'

// Navigation Component
const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/founder', label: 'Meet the Founder' },
    { path: '/mission', label: 'Our Mission' },
    { path: '/pricing', label: 'Pricing' },
    { path: '/contact', label: 'Contact' },
    { path: '/terms', label: 'Terms' },
    { path: '/privacy', label: 'Privacy' }
  ]
  
  return (
    <header role="banner">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-cyan-400" />
              <span className="text-white font-bold text-xl">AI Job Chommie</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-white hover:text-cyan-400 transition-colors ${
                    location.pathname === item.path ? 'text-cyan-400' : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-white hover:text-cyan-400"
              >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
          
          {/* Mobile Navigation */}
          {isOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 bg-black/90 rounded-lg mt-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-3 py-2 text-white hover:text-cyan-400 ${
                      location.pathname === item.path ? 'text-cyan-400' : ''
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}

// About Page Component
const AboutPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 bg-black">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 text-center">
          About <span className="text-cyan-400">AI Job Chommie</span>
        </h1>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <p className="text-gray-300 text-lg leading-relaxed">
            AI Job Chommie is revolutionizing the job search experience in South Africa. 
            Our AI-powered platform connects talented individuals with meaningful employment 
            opportunities, making the job search process more efficient and effective.
          </p>
        </div>
      </div>
    </div>
  )
}

// Founder Page Component
const FounderPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 bg-black">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 text-center">
          Meet the <span className="text-cyan-400">Founder</span>
        </h1>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <h2 className="text-2xl font-semibold text-white mb-4">Fernando Steyn</h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            Fernando Steyn founded AI Job Chommie with a vision to democratize employment 
            opportunities across South Africa. With a deep understanding of both technology 
            and the local job market, Fernando is committed to helping every South African 
            find meaningful work.
          </p>
        </div>
      </div>
    </div>
  )
}

// Mission Page Component
const MissionPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 bg-black">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 text-center">
          Our <span className="text-cyan-400">Mission</span>
        </h1>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            To democratize employment opportunities across South Africa by leveraging 
            artificial intelligence to create equal access to meaningful work for every 
            job seeker, regardless of background, location, or resources.
          </p>
          <p className="text-gray-300 text-lg leading-relaxed">
            We believe that everyone deserves the chance to find fulfilling work that 
            matches their skills and aspirations. Our AI technology is designed to bridge 
            the gap between talent and opportunity.
          </p>
        </div>
      </div>
    </div>
  )
}

// Main App Component
function AppSimple() {
  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/founder" element={<FounderPage />} />
          <Route path="/mission" element={<MissionPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default AppSimple
