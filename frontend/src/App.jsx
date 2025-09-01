import React, { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from './components/ui/sonner'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './lib/queryClient'
import { Menu, X, Brain, Users, Target, Shield, Phone, Mail, MapPin, Clock, DollarSign } from 'lucide-react'
import * as Sentry from '@sentry/react'
import ErrorFallback from './components/ErrorFallback'
import SentryTestButton from './components/SentryTestButton'
import SplashScreen from './components/SplashScreen'
import PricingPage from './PricingPage'
import Payment from './pages/Payment'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Applications from './pages/Applications'
import Preferences from './pages/Preferences'
import Alerts from './pages/Alerts'

// Lazy load heavy components for code splitting
const CvBuilder = lazy(() => import('./pages/CvBuilder'))
const Analytics = lazy(() => import('./pages/Analytics'))
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import PlanGate from './components/PlanGate'
import QuotaMeter from './components/QuotaMeter'
import ProtectedRoute from './components/ProtectedRoute'
import { LoginPage, SignupPage } from './pages/Auth'
import ManagerDashboard from './components/ManagerDashboard'
import WidgetsDemo from './pages/WidgetsDemo'
import backgroundImage from './assets/background.png'

// Import enhanced pages
import HomePage from './pages/HomePage'
import ContactPage from './pages/ContactPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
      <p className="text-white">Loading...</p>
    </div>
  </div>
)
import './App.css'

// Navigation Component
const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()

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

  const authedItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/manager', label: 'Manager Dashboard' },
    { path: '/jobs', label: 'Jobs' },
    { path: '/applications', label: 'Applications' },
    { path: '/profile', label: 'Profile' },
    { path: '/settings', label: 'Settings' }
  ]

  return (
    <header role="banner">
      <nav id="main-navigation" className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2" aria-label="AI Job Chommie - Home">
              <Brain className="h-8 w-8 text-cyan-400" aria-hidden="true" />
              <span className="text-white font-bold text-xl">AI Job Chommie</span>
            </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {[...navItems, ...(isAuthenticated ? authedItems : [])].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-white hover:text-cyan-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded ${
                  location.pathname === item.path ? 'text-cyan-400' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <button onClick={logout} className="text-white/80 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded">Logout</button>
            ) : (
              <>
                <Link to="/login" className="text-white/80 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded">Login</Link>
                <Link to="/signup" className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-cyan-500">Sign up</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-white hover:text-cyan-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-black/40 backdrop-blur-md rounded-lg mt-2">
              {[...navItems, ...(isAuthenticated ? authedItems : [])].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-3 py-2 text-white hover:text-cyan-400 transition-colors duration-200 ${
                    location.pathname === item.path ? 'text-cyan-400' : ''
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="px-3 py-2 border-t border-white/10 flex gap-4">
                {isAuthenticated ? (
                  <button onClick={() => { setIsOpen(false); logout() }} className="text-white/80 hover:text-cyan-400">Logout</button>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-cyan-400">Login</Link>
                    <Link to="/signup" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-cyan-400">Sign up</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
    </header>
  )
}

// Footer Component
const Footer = () => {
  // Get version from package.json via import.meta.env or build-time injection
  const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

  // Use build timestamp if available, otherwise current date
  const buildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP
  const lastUpdated = buildTimestamp
    ? new Intl.DateTimeFormat('en-ZA', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Johannesburg'
      }).format(new Date(parseInt(buildTimestamp)))
    : new Intl.DateTimeFormat('en-ZA', {
        dateStyle: 'medium',
        timeZone: 'Africa/Johannesburg'
      }).format(new Date())

  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-gray-300">
        <div className="flex items-center gap-3 flex-wrap">
          <span>© {new Date().getFullYear()} AI Job Chommie</span>
          <span aria-label="app-version" className="text-gray-400">v{APP_VERSION}</span>
          <span aria-label="last-updated" className="text-gray-400">Last updated: {lastUpdated} SAST</span>
          <span className="text-gray-400">• Reg: AIJOBCHOMMIE | TRN: 2025/599261/07 | TRef: 9481880228</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link to="/terms" className="text-cyan-400 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded" aria-label="Terms of Service link">Terms</Link>
          <Link to="/privacy" className="text-cyan-400 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded" aria-label="Privacy Policy link">Privacy</Link>
        </nav>
      </div>
    </footer>
  )
}


// HomePage component is imported from './pages/HomePage'

// About Page Component
const AboutPage = () => {
  return (
    <main id="main-content" role="main" className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            The Legend of AI Job <span className="text-cyan-400">Chommie</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Where Ancient Wisdom Meets Modern Hope
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">The Three Wise Men and a Vision Born</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              In the heart of Port Elizabeth, where the Indian Ocean whispers stories of possibility to those who dare to listen, a legend was taking shape. This is not just the story of a platform—it's the tale of how ancient wisdom converged with modern technology to birth something extraordinary: AI Job Chommie.
            </p>
            <h3 className="text-2xl font-semibold text-white mb-4">The Pilgrimage from Mount Masiagwala</h3>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              The first sign came through Good-Danny, a man whose footsteps carried the weight of sacred purpose as he descended from Mount Masiagwala. The ancient mountain, keeper of ancestral wisdom, had chosen its messenger well. Good-Danny arrived not with fanfare, but with the quiet authority of someone who had witnessed suffering and envisioned transformation.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              "The working society cries out for change," he declared, his voice carrying the echo of countless prayers whispered by the unemployed, the overlooked, the forgotten. "In every township, in every city, in every corner of our beloved South Africa, there are dreams deferred and potential buried. You have been called to unearth these treasures."
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              His mission was clear: democratize employment opportunities for every South African, using revolutionary technology that would understand not just jobs, but the beating heart of our unique market.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h3 className="text-2xl font-semibold text-white mb-4">J-Baai: The Revealer of Hidden Worth</h3>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              As the vision began crystallizing, a second figure emerged—JWD, known to those blessed by his presence as J-Baai. Like a master jeweler who sees diamonds in rough stone, J-Baai possessed the extraordinary gift of revealing worth where others saw only ordinary clay.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              "You carry within you more value than you know," J-Baai would say, his words cutting through layers of self-doubt that had accumulated like dust on forgotten dreams. He understood that behind every CV was a human story, behind every application was someone's hope for a better tomorrow.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              Through J-Baai's teaching, the platform's deeper purpose was revealed: this wasn't just about matching skills to job descriptions—it was about recognizing the inherent dignity in every job seeker, ensuring that no one's potential would ever again be overlooked or undervalued.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h3 className="text-2xl font-semibold text-white mb-4">Jeremiah Jakobus Steyn: The Wise Gardener's Truth</h3>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              The final piece of wisdom came through patient, weathered hands—those of Jeremiah Jakobus Steyn, gardener, father, and keeper of life's most profound truths. In the quiet hours before dawn, as he tended to seedlings with the care of one who understood growth's sacred mysteries, Jeremiah shared his deepest knowing.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              "Every seed knows its season," he would say, soil-stained fingers gentle with both earth and spirit. "Your role is not to force the flowering, but to create the conditions where flourishing becomes inevitable. Some will bloom quickly, others need patience—but all deserve the chance to grow."
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              His wisdom became AI Job Chommie's foundation: that connecting people to opportunities is sacred work, requiring the same patience, understanding, and nurturing care that transforms seeds into mighty trees.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">From Legend to Living Reality</h2>
            <h3 className="text-2xl font-semibold text-white mb-4">A Seed Planted in Real Soil</h3>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              This wasn't just conceived as a business idea; it grew from walking the dusty streets of townships, feeling the frustration of talented individuals trapped in a maze of bureaucracy and outdated systems. In vibrant communities across our nation, millions of gifted people wake each day facing the soul-crushing challenge of finding meaningful work—not because opportunities don't exist, but because the bridges to reach them have been broken or were never built at all.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              We witnessed the human gap—the space where potential gets lost, where dreams defer, where dignity gets eroded by systems that see numbers instead of names. That gap became our calling.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h3 className="text-2xl font-semibold text-white mb-4">Built for the Heart of Mzansi</h3>
            <ul className="space-y-4 text-gray-300 text-lg">
              <li className="flex items-start space-x-3">
                <Target className="h-6 w-6 text-cyan-400 mt-1 flex-shrink-0" />
                <span><strong className="text-white">Deep Local Understanding:</strong> We don't just operate in South Africa; we are bone-deep South African. Our AI breathes with the rhythm of our local job market, understanding that a position in Cape Town carries different weight than one in Polokwane, that industries here pulse with their own unique heartbeat, that cultural contexts matter as much as qualifications.</span>
              </li>
              <li className="flex items-start space-x-3">
                <Users className="h-6 w-6 text-cyan-400 mt-1 flex-shrink-0" />
                <span><strong className="text-white">Embracing Our Beautiful Complexity:</strong> With 11 official languages painting our national conversation in rich hues, South Africa is a symphony of voices. Our platform honors this linguistic diversity, ensuring that whether you dream in Zulu, think in Afrikaans, or hope in Xhosa, language will never stand between you and opportunity.</span>
              </li>
              <li className="flex items-start space-x-3">
                <Brain className="h-6 w-6 text-cyan-400 mt-1 flex-shrink-0" />
                <span><strong className="text-white">Empowering Every Community:</strong> The three wise men's vision extends far beyond urban centers. We carry a passionate commitment to job seekers in townships and rural areas—bringing cutting-edge AI technology directly to those who need it most, building digital bridges across geographical and economic divides, ensuring that your postal code never determines your potential.</span>
              </li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">Our Mission: Beyond the Algorithm, Towards Human Flourishing</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              At AI Job Chommie, our mission is more than just a statement; it's a deeply held belief, a guiding star that illuminates every line of code we write and every connection we facilitate. We believe that every individual possesses inherent worth, unique talents, and a burning desire to contribute meaningfully to the world. Our purpose is to bridge the gap between that potential and the opportunities that allow it to blossom, especially within the vibrant, complex tapestry of South Africa.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              We understand that the job search can often feel like a cold, impersonal process. Resumes disappear into digital black holes, applications go unanswered, and the human spirit can easily become disheartened. This is precisely where AI Job Chommie steps in, not to replace the human element, but to amplify it. We leverage cutting-edge artificial intelligence, not as a barrier, but as a compassionate tool designed to see beyond keywords and algorithms, to recognize the unique spark in every job seeker.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              Our commitment extends beyond mere matching. We are dedicated to fostering an ecosystem where transparency, trust, and genuine partnership are paramount. We aim to demystify the job market, providing clarity and actionable insights that empower you to navigate your career journey with confidence. We believe in equipping you with the knowledge and tools to present your authentic self, ensuring that your story, your skills, and your aspirations are truly seen and valued.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              We are acutely aware of the unique challenges and incredible resilience of the South African workforce. Our AI is not a generic, one-size-fits-all solution; it is meticulously trained on the nuances of our local job market, understanding regional demands, industry specificities, and the rich cultural context that shapes our professional landscape. From the bustling metropolises to the quietest rural communities, we are building digital bridges, ensuring that geographical location never dictates potential.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              Ultimately, our mission is about human flourishing. It's about empowering individuals to find not just a job, but a calling; not just employment, but purpose. It's about contributing to a stronger, more equitable South Africa, one meaningful connection at a time. We are here to walk alongside you, to celebrate your successes, and to provide unwavering support as you unlock your full potential. Welcome to a job search experience where technology meets empathy, and where your future is not just found, but truly cultivated.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">The Living Legend</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              Today, AI Job Chommie stands as more than a platform—it's the living embodiment of Good-Danny's revolutionary vision, J-Baai's gift for revealing hidden worth, and Jeremiah's understanding that growth requires patience, care, and the right conditions.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              We're not just your job-matching service; we're your partners in this sacred journey of finding where you belong. Every connection made honors the wisdom of those three men who saw what could be and dared to plant seeds in willing soil.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              The mountain's call continues to echo. The awakening spreads from person to person. The garden grows, season after season, one meaningful connection at a time.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              This is our story. This is our mission. This is AI Job Chommie—where legends live, where dignity matters, and where every South African's potential finds its home.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              <em>Welcome to the revolution. Welcome to recognition of your worth. Welcome to where dreams and opportunity finally meet.</em>
            </p>
          </section>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Ready to Experience the Future of Job Search?</h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of South Africans who've transformed their careers with AI Job Chommie.
            </p>
            <Link
              to="/pricing"
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 inline-block"
            >
              Start Your Journey
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

// Founder Page Component
const FounderPage = () => {
  return (
    <main role="main" className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Meet the <span className="text-cyan-400">Founder</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            From the welding yards of Port Elizabeth to the forefront of AI innovation – one man's
            journey to democratize employment for all South Africans.
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl p-8 border border-cyan-400/20">
            <blockquote className="text-xl text-gray-200 italic leading-relaxed mb-6">
              "Every job seeker has a story, dreams, and potential waiting to be unlocked. My mother taught me that everyone
              deserves dignity in work. AI Job Chommie is my promise to her memory and my gift to South Africa - technology
              that sees the person behind the resume and matches them with opportunities that can change their life."
            </blockquote>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">FS</span>
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Fernando Steyn</p>
                <p className="text-cyan-400">Founder & CEO, AI Job Chommie</p>
              </div>
            </div>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-gray-300 leading-relaxed text-lg space-y-6">
            <p>
              At the heart of AI Job Chommie lies the unwavering vision of our founder, Fernando Steyn. This isn't just a story of technological innovation; it's a deeply personal narrative rooted in a profound understanding of the South African landscape and a burning desire to empower its people.
            </p>
            <p>
              Fernando's journey began not in a boardroom, but amidst the vibrant, yet often challenging, realities of our local communities. Witnessing firsthand the immense talent that often goes untapped due to systemic barriers and a fragmented job market, a powerful conviction took root: there had to be a better way. This conviction, coupled with a keen insight into the transformative potential of artificial intelligence, sparked the genesis of AI Job Chommie.
            </p>
            <p>
              With a background steeped in both cutting-edge technology and a genuine passion for social upliftment, Fernando embarked on a mission to bridge this critical gap. The goal was clear: to create an intelligent, intuitive platform that not only connects job seekers with opportunities but also understands the unique nuances of the South African employment ecosystem – from diverse industries and regional demands to the rich tapestry of our cultural contexts.
            </p>
            <p>
              It wasn't enough to simply build a tool; it had to be a companion, a trusted guide that walks alongside every individual on their career journey. Fernando's vision extends beyond mere job matching; it's about fostering a sense of dignity, purpose, and belonging for every South African. He believes that by empowering individuals, we collectively strengthen our communities and contribute to a more prosperous nation.
            </p>
            <p>
              His commitment is reflected in every aspect of AI Job Chommie, from its user-friendly interface to its sophisticated AI algorithms that are meticulously trained on local data. Fernando's leadership ensures that the platform remains true to its core values of empathy, innovation, and social impact. He is not just a founder; he is a champion for the South African workforce, dedicated to unlocking the full potential of every individual and building a future where talent is never overlooked.
            </p>
          </section>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Join Fernando's Vision</h2>
            <p className="text-xl text-gray-300 mb-8">
              Experience the job search platform built by someone who truly understands your journey.
              Let AI Job Chommie help you find the opportunity you deserve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
              >
                Create your account
              </Link>
              <Link
                to="/pricing"
                className="border border-white/30 hover:border-cyan-400 text-white hover:text-cyan-400 px-8 py-4 rounded-lg font-semibold transition-all duration-200"
              >
                Choose a plan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// Mission Page Component
const MissionPage = () => {
  return (
    <main role="main" className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Our <span className="text-cyan-400">Mission</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            To democratize employment opportunities across South Africa by leveraging artificial intelligence
            to create equal access to meaningful work for every job seeker, regardless of background, location, or resources.
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">Our Mission Declaration: A Pledge to South Africa</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              At AI Job Chommie, our mission is more than just a statement; it's a heartfelt pledge to every South African seeking meaningful employment.
              We believe, with every fiber of our being, that access to opportunity should not be a privilege, but a fundamental right. In a nation as vibrant
              and resilient as ours, where unemployment casts a long shadow over millions of talented individuals, we refuse to accept the status quo.
              We are here to challenge it, to transform it, and to build a future where potential is never wasted.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              Our purpose is clear: to bridge the gap between exceptional talent and quality opportunities. We do this by harnessing the transformative power of
              artificial intelligence, not as a cold, impersonal tool, but as a warm, intelligent guide. Our AI is designed to understand the unique stories,
              skills, and aspirations of each job seeker, connecting them with roles that don't just offer a paycheck, but a pathway to a fulfilling career and a better life.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-8">Our Core Values: The Pillars of Our Promise</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Empowerment Through Knowledge</h3>
                  <p className="text-gray-300">We empower job seekers by providing them with not just job listings, but with the insights, tools, and confidence to navigate the job market effectively. We believe that an informed job seeker is an unstoppable one.</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Innovation with a Human Touch</h3>
                  <p className="text-gray-300">We continuously innovate our AI technology, pushing the boundaries of what's possible in job matching. Yet, at every step, our innovation is guided by a deep understanding of human needs, ensuring our solutions are intuitive, supportive, and truly helpful.</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Inclusivity for Every Voice</h3>
                  <p className="text-gray-300">South Africa's strength lies in its diversity. We are profoundly committed to creating a platform that serves all South Africans, regardless of their background, location, language, or past experiences. Every individual's potential is valued and recognized here.</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Transparency as Our Foundation</h3>
                  <p className="text-gray-300">We operate with unwavering integrity and clarity. Our processes are open, our pricing is straightforward, and we believe in clear communication. You deserve to understand how our platform works and how it's working for you.</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Social Impact as Our True North</h3>
                  <p className="text-gray-300">Our ultimate success isn't measured in profits, but in the positive impact we create. We are driven by the desire to uplift individuals, strengthen communities, and contribute significantly to the economic well-being and prosperity of South Africa.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">Our Vision for a Brighter Tomorrow</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              We envision a South Africa where every job seeker feels seen, valued, and connected to opportunities that align with their true potential.
              A future where geographical barriers dissolve, where language is a bridge, not a wall, and where the power of AI serves to amplify human capability,
              not replace it. We dream of a nation where talent is never overlooked, and where every individual has the chance to contribute their unique gifts
              to our collective growth.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              This vision fuels our daily work, inspires our innovations, and strengthens our resolve. We are building more than a job platform; we are building a movement
              towards a more equitable, prosperous, and hopeful South Africa.
            </p>
          </section>

          <section className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl p-8 border border-cyan-400/20">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Our Impact: Real Stories, Real Change</h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-cyan-400 mb-2">87%</div>
                <div className="text-white font-semibold mb-2">Placement Rate</div>
                <div className="text-gray-300 text-sm">Job seekers successfully employed within 90 days of active platform use</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-purple-400 mb-2">34%</div>
                <div className="text-white font-semibold mb-2">Salary Improvement</div>
                <div className="text-gray-300 text-sm">Average salary increase for users who found new positions through our platform</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-green-400 mb-2">21</div>
                <div className="text-white font-semibold mb-2">Days to Employment</div>
                <div className="text-gray-300 text-sm">Average days from profile completion to first interview opportunity</div>
              </div>
            </div>
          </section>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Join Our Mission: Be Part of the Change</h2>
            <p className="text-xl text-gray-300 mb-8">
              This journey is a collective one. Whether you're a job seeker ready to transform your career, an employer seeking exceptional talent,
              or a community partner passionate about economic development, there's a vital place for you in our mission to create equal opportunity for all.
              Together, we can build a stronger, more prosperous South Africa.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 inline-block"
              >
                Create your account
              </Link>
              <Link
                to="/pricing"
                className="border border-white/30 hover:border-cyan-400 text-white hover:text-cyan-400 px-8 py-4 rounded-lg font-semibold transition-all duration-200"
              >
                Choose a plan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// ContactPage component is imported from './pages/ContactPage'

// TermsPage component is imported from './pages/TermsPage'

// PrivacyPage component is imported from './pages/PrivacyPage'

// Main App Component
/*
// Component removed to avoid duplication - using import
const OldTermsPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Terms of <span className="text-cyan-400">Service</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Welcome to AI Job Chommie. These Terms of Service are designed to ensure a clear, fair, and transparent relationship between you and us.
            Please read them carefully, as they govern your use of our platform and services.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            Last Updated: August 22, 2025
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">1. Introduction and Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              Welcome to AI Job Chommie (Pty) Ltd ("AI Job Chommie", "we", "us", or "our"). We are a proudly South African company
              (Registration: 2025/599261/07, Tax Reference: 9481880228) dedicated to democratizing employment opportunities across
              our nation through the innovative application of Artificial Intelligence. By accessing or using our website,
              applications, and services (collectively, the "Service"), you ("User", "you", or "your") signify that you have
              read, understood, and agree to be bound by these Terms of Service ("Terms"), our Privacy Policy, and all applicable
              laws and regulations in South Africa.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              If you do not agree with any part of these Terms, you must not use our Service. We reserve the right to update
              and change these Terms from time to time without prior notice. Your continued use of the Service after any such
              changes constitutes your acceptance of the new Terms. It is your responsibility to review these Terms periodically
              for updates.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">2. User Accounts and Eligibility</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              To access certain features of our Service, you may be required to register for an account. You must be at least
              18 years old or the age of majority in your jurisdiction to use our Service. By creating an account, you represent
              and warrant that you meet this age requirement and that all information you provide is accurate, complete, and
              truthful. You are responsible for maintaining the confidentiality of your account login information and for all
              activities that occur under your account.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              You agree to notify AI Job Chommie immediately of any unauthorized use of your account or any other breach of
              security. We will not be liable for any loss or damage arising from your failure to comply with this obligation.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">3. User Responsibilities and Conduct</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              As a user of AI Job Chommie, you agree to:
            </p>
            <ul className="space-y-3 text-gray-300 text-lg list-disc list-inside">
              <li>Provide accurate and up-to-date information in your profile and applications.</li>
              <li>Use the Service only for lawful purposes and in a manner that does not infringe the rights of, or restrict or inhibit the use and enjoyment of the Service by any third party.</li>
              <li>Not upload or transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, libelous, invasive of another\'s privacy, hateful, or racially, ethnically, or otherwise objectionable.</li>
              <li>Not engage in any activity that interferes with or disrupts the Service or the servers and networks connected to the Service.</li>
              <li>Not attempt to gain unauthorized access to any portion or feature of the Service, or any other systems or networks connected to the Service.</li>
              <li>Comply with all applicable local, provincial, national, and international laws and regulations.</li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">4. AI Job Chommie Services</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              Our Service provides an AI-powered platform designed to assist job seekers in South Africa. This includes, but is not limited to:
            </p>
            <ul className="space-y-3 text-gray-300 text-lg list-disc list-inside">
              <li>Automated job application submissions based on your profile and preferences.</li>
              <li>AI-driven matching of your skills and experience to relevant job opportunities.</li>
              <li>CV and cover letter optimization tools.</li>
              <li>Skills assessments and career guidance.</li>
              <li>Job market insights and analytics.</li>
            </ul>
            <p className="text-gray-300 leading-relaxed text-lg mt-4">
              While we strive to provide accurate and effective services, AI Job Chommie does not guarantee employment or specific job outcomes.
              Our Service is a tool to assist your job search, and its effectiveness depends on various factors, including the accuracy of the
              information you provide, market conditions, and your individual efforts.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">5. Payment and Subscriptions</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              Certain features of the Service may require a paid subscription. By selecting a subscription plan, you agree to pay AI Job Chommie
              the monthly or annual subscription fees indicated for that service. Payments will be charged on a recurring basis to your chosen
              payment method. You can manage your subscription and payment details through your account settings.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              All fees are non-refundable, except as required by South African consumer protection laws. We reserve the right to change our
              subscription fees upon reasonable notice. Your continued use of the paid Service after such changes constitutes your acceptance
              of the new fees.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              If you cancel your subscription, your access to paid features will continue until the end of your current billing cycle.
              No refunds will be provided for partial periods of service.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">6. Intellectual Property Rights</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              All content, trademarks, service marks, trade names, logos, and intellectual property displayed on the Service are the
              property of AI Job Chommie or its licensors and are protected by South African and international copyright, trademark,
              and other intellectual property laws. You may not use, reproduce, distribute, modify, or create derivative works of
              any content from the Service without our express written permission.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              You retain ownership of any content you submit, post, or display on or through the Service. However, by submitting
              content, you grant AI Job Chommie a worldwide, non-exclusive, royalty-free, transferable license to use, reproduce,
              distribute, prepare derivative works of, display, and perform the content in connection with the Service and AI Job
              Chommie\'s (and its successors\' and affiliates\') business, including without limitation for promoting and redistributing
              part or all of the Service (and derivative works thereof) in any media formats and through any media channels.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">7. Disclaimers and Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              THE SERVICE IS PROVIDED ON "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
              INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              AI JOB CHOMMIE DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED,
              OR THAT THE SERVICE OR THE SERVERS THAT MAKE THE SERVICE AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL AI JOB CHOMMIE, ITS AFFILIATES, DIRECTORS, EMPLOYEES,
              OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION,
              LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY
              TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (III) ANY CONTENT OBTAINED
              FROM THE SERVICE; AND (IV) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON
              WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE HAVE BEEN INFORMED OF THE
              POSSIBILITY OF SUCH DAMAGE, AND EVEN IF A REMEDY SET FORTH HEREIN IS FOUND TO HAVE FAILED OF ITS ESSENTIAL PURPOSE.
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              NOTHING IN THESE TERMS WILL EXCLUDE OR LIMIT ANY WARRANTY IMPLIED BY LAW THAT IT WOULD BE UNLAWFUL TO EXCLUDE OR LIMIT;
              AND NOTHING IN THESE TERMS WILL EXCLUDE OR LIMIT OUR LIABILITY IN RESPECT OF ANY: (A) DEATH OR PERSONAL INJURY CAUSED BY
              OUR NEGLIGENCE; (B) FRAUD OR FRAUDULENT MISREPRESENTATION; OR (C) MATTER WHICH IT WOULD BE ILLEGAL OR UNLAWFUL FOR US
              TO EXCLUDE OR LIMIT, OR TO ATTEMPT OR PURPORT TO EXCLUDE OR LIMIT, OUR LIABILITY.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">8. Indemnification</h2>
            <p className="text-gray-300 leading-relaxed text-lg">
              You agree to defend, indemnify, and hold harmless AI Job Chommie, its affiliates, licensors, and service providers,
              and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors,
              and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees
              (including reasonable attorneys\' fees) arising out of or relating to your violation of these Terms or your use of
              the Service, including, but not limited to, your User Contributions, any use of the Service\'s content, services,
              and products other than as expressly authorized in these Terms, or your use of any information obtained from the Service.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">9. Governing Law and Dispute Resolution</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              These Terms shall be governed and construed in accordance with the laws of the Republic of South Africa, without
              regard to its conflict of law provisions. Any dispute, controversy, or claim arising out of or relating to these
              Terms or the breach, termination, or validity thereof, shall be resolved through good faith negotiations between
              the parties. If a resolution cannot be reached, the dispute shall be submitted to mediation in Port Elizabeth,
              Eastern Cape, South Africa. If mediation fails, the dispute shall be finally settled by arbitration in accordance
              with the rules of the Arbitration Foundation of Southern Africa (AFSA).
            </p>
            <p className="text-gray-300 leading-relaxed text-lg">
              Nothing in this clause shall prevent either party from seeking urgent interim relief from a court of competent
              jurisdiction in South Africa.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">10. Changes to These Terms</h2>
            <p className="text-gray-300 leading-relaxed text-lg">
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is
              material, we will try to provide at least 30 days\' notice prior to any new terms taking effect. What constitutes
              a material change will be determined at our sole discretion. By continuing to access or use our Service after
              those revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms,
              please stop using the Service.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">11. Contact Information</h2>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li><strong>Email:</strong> legal@aijobchommie.co.za</li>
              <li><strong>Address:</strong> Port Elizabeth, Eastern Cape, South Africa</li>
              <li><strong>General Inquiries:</strong> admin@aijobchommie.co.za</li>
            </ul>
          </section>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Questions About Our Terms?</h2>
            <p className="text-gray-300 mb-6">
              We\'re here to clarify any aspect of our Terms of Service.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:legal@aijobchommie.co.za"
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
              >
                Legal Inquiries
              </a>
              <Link
                to="/contact"
                className="border border-white/30 hover:border-cyan-400 text-white hover:text-cyan-400 px-8 py-4 rounded-lg font-semibold transition-all duration-200"
              >
                General Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

*/

// PrivacyPage component is imported from './pages/PrivacyPage'

// Main App Component
function App() {
  const queryClient = createQueryClient()
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen relative">
          {/* Skip Links for Keyboard Navigation */}
          <div className="sr-only focus-within:not-sr-only">
            <a
              href="#main-content"
              className="absolute top-4 left-4 z-50 bg-cyan-500 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              Skip to main content
            </a>
            <a
              href="#main-navigation"
              className="absolute top-4 left-32 z-50 bg-cyan-500 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              Skip to navigation
            </a>
          </div>

          {/* Background */}
          <div
            className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              imageRendering: 'optimizeQuality'
            }}
          />
          <div className="fixed inset-0 bg-black/60" />

          <AuthProvider>
            {/* Navigation */}
            <Navigation />

            {/* Main Content */}
            <div className="relative z-10">
              <Sentry.ErrorBoundary fallback={ErrorFallback}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/founder" element={<FounderPage />} />
                  <Route path="/mission" element={<MissionPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/payment" element={<Payment />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/widgets-demo" element={<WidgetsDemo />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/manager" element={<ProtectedRoute><ManagerDashboard /></ProtectedRoute>} />
                  <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
                  <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
                  <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
                  <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
                  <Route path="/cv-builder" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <CvBuilder />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                  <Route path="/analytics" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <Analytics />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Sentry.ErrorBoundary>
              <Toaster richColors position="top-right" />
              <SentryTestButton />
            </div>
            <Footer />

          </AuthProvider>
        </div>
      </QueryClientProvider>
    </Router>
  )
}

export default App

