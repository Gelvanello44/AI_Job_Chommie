import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Zap, Shield, Target, Users, TrendingUp, Award, Globe, Sparkles, ChevronRight } from 'lucide-react'
import '../styles/futuristic-theme.css'

// Particle System Component
const ParticleSystem = () => {
  const particlesRef = useRef([])
  
  useEffect(() => {
    const createParticle = () => {
      const particle = document.createElement('div')
      particle.className = 'energy-particle'
      particle.style.left = `${Math.random() * 100}%`
      particle.style.animationDelay = `${Math.random() * 10}s`
      particle.style.animationDuration = `${10 + Math.random() * 10}s`
      return particle
    }
    
    const container = document.getElementById('particle-container')
    if (container) {
      for (let i = 0; i < 30; i++) {
        const particle = createParticle()
        container.appendChild(particle)
        particlesRef.current.push(particle)
      }
    }
    
    return () => {
      particlesRef.current.forEach(p => p.remove())
    }
  }, [])
  
  return <div id="particle-container" className="particle-container" />
}

// Energy Ring Component
const EnergyRing = ({ size = 200 }) => (
  <div className="energy-ring" style={{ width: size, height: size }}>
    <div className="energy-ring-outer"></div>
    <div className="energy-ring-inner"></div>
  </div>
)

// Stats Counter Component
const StatsCounter = ({ end, label, duration = 2000 }) => {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )
    
    if (ref.current) {
      observer.observe(ref.current)
    }
    
    return () => observer.disconnect()
  }, [])
  
  useEffect(() => {
    if (!isVisible) return
    
    let start = 0
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    
    return () => clearInterval(timer)
  }, [isVisible, end, duration])
  
  return (
    <div ref={ref} className="text-center">
      <div className="counter">{count.toLocaleString()}+</div>
      <p className="text-gray-400 mt-2">{label}</p>
    </div>
  )
}

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, description, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  
  return (
    <div 
      className={`feature-card transform transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="flex items-center mb-4">
        <div className="p-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 mr-4">
          <Icon className="h-6 w-6 text-cyan-400" />
        </div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
      </div>
      <p className="text-gray-400">{description}</p>
    </div>
  )
}

const HomePage = () => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  
  useEffect(() => {
    setIsLoaded(true)
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 6)
    }, 3000)
    return () => clearInterval(interval)
  }, [])
  
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Matching",
      description: "Advanced algorithms match you with perfect opportunities based on your unique profile"
    },
    {
      icon: Zap,
      title: "Instant Applications",
      description: "Apply to multiple positions with one click using our smart application system"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is encrypted and protected with enterprise-grade security"
    },
    {
      icon: Target,
      title: "Precision Targeting",
      description: "Focus on jobs that truly match your skills and career aspirations"
    },
    {
      icon: Users,
      title: "Network Building",
      description: "Connect with professionals and expand your career network"
    },
    {
      icon: TrendingUp,
      title: "Career Growth",
      description: "Track your progress and get insights to accelerate your career"
    }
  ]
  
  return (
    <div className="futuristic-container">
      <ParticleSystem />
      <div className="grid-background"></div>
      
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative px-4 pt-20">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-20">
          <EnergyRing size={600} />
        </div>
        
        <div className="max-w-6xl mx-auto text-center z-10">
          <div className={`transform transition-all duration-1000 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            {/* Animated Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 mb-8">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">Revolutionizing Job Search in South Africa</span>
            </div>
            
            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="glowing-title" data-text="AI Job Chommie">
                AI Job Chommie
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
              Where cutting-edge AI meets the South African job market.
              Your intelligent career companion powered by revolutionary technology.
            </p>
            
            {/* Energy Bar */}
            <div className="max-w-md mx-auto mb-12">
              <div className="energy-bar">
                <div className="energy-bar-fill" style={{ width: '75%' }}></div>
              </div>
              <p className="text-sm text-cyan-400 mt-2">System Online • Ready to Transform Your Career</p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/signup" className="energy-button group">
                <span className="flex items-center justify-center">
                  Start Your Journey
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <Link 
                to="/pricing" 
                className="px-8 py-4 rounded-full border-2 border-cyan-400/50 text-cyan-400 font-semibold hover:bg-cyan-400/10 hover:border-cyan-400 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.5)]"
              >
                View Plans
              </Link>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <StatsCounter end={10000} label="Active Job Seekers" />
              <StatsCounter end={500} label="Partner Companies" />
              <StatsCounter end={95} label="Success Rate %" />
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Powered by <span className="text-cyan-400">Advanced Technology</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Experience the future of job searching with our suite of intelligent features
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                {...feature}
                delay={index * 100}
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              How It <span className="text-purple-400">Works</span>
            </h2>
            <p className="text-xl text-gray-400">Three simple steps to your dream career</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Create Your Profile",
                description: "Build your professional profile with our AI-assisted tools",
                color: "cyan"
              },
              {
                step: "02",
                title: "AI Matches You",
                description: "Our algorithms analyze thousands of opportunities to find your perfect fit",
                color: "purple"
              },
              {
                step: "03",
                title: "Land Your Dream Job",
                description: "Apply with confidence and track your applications in real-time",
                color: "pink"
              }
            ].map((item, index) => (
              <div key={index} className="glass-card text-center group">
                <div className={`text-5xl font-bold mb-4 bg-gradient-to-r from-${item.color}-400 to-${item.color === 'pink' ? 'purple' : item.color}-600 bg-clip-text text-transparent`}>
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
                <div className="mt-6 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Success <span className="text-cyan-400">Stories</span>
            </h2>
            <p className="text-xl text-gray-400">Join thousands who've transformed their careers</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "Thabo M.",
                role: "Software Developer",
                company: "Tech Corp SA",
                text: "AI Job Chommie understood exactly what I was looking for. Found my dream job in just 2 weeks!"
              },
              {
                name: "Sarah K.",
                role: "Marketing Manager",
                company: "Digital Agency",
                text: "The AI matching is incredible. It connected me with opportunities I never would have found myself."
              },
              {
                name: "James L.",
                role: "Data Analyst",
                company: "Finance Plus",
                text: "From application to offer in record time. This platform is a game-changer for job seekers."
              }
            ].map((testimonial, index) => (
              <div key={index} className="glass-card hover:border-cyan-400/50 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 flex items-center justify-center text-white font-bold">
                    {testimonial.name[0]}
                  </div>
                  <div className="ml-4">
                    <p className="text-white font-semibold">{testimonial.name}</p>
                    <p className="text-cyan-400 text-sm">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-300 italic">"{testimonial.text}"</p>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <Award className="h-4 w-4 mr-2 text-purple-400" />
                  Now at {testimonial.company}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-card bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-400/30">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Transform Your Career?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join the AI revolution in job searching. Your next opportunity is waiting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="energy-button">
                Get Started Free
              </Link>
              <Link 
                to="/about" 
                className="px-8 py-4 rounded-full border-2 border-white/30 text-white font-semibold hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              >
                Learn More
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-400">
              No credit card required • Free tier available • Cancel anytime
            </p>
          </div>
        </div>
      </section>
      
      {/* Partner Logos */}
      <section className="py-12 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-gray-500 mb-8">Trusted by leading South African companies</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            {['Company A', 'Company B', 'Company C', 'Company D', 'Company E'].map((company, index) => (
              <div key={index} className="text-gray-400 font-semibold hover:text-cyan-400 transition-colors">
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
