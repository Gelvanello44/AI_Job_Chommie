import React, { useState, useEffect } from 'react'
import { Shield, FileText, AlertCircle, Check, ChevronRight, Clock } from 'lucide-react'
import '../styles/futuristic-theme.css'

const TermsPage = () => {
  const [activeSection, setActiveSection] = useState('introduction')
  const [scrollProgress, setScrollProgress] = useState(0)
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPosition = window.scrollY
      const progress = (scrollPosition / scrollHeight) * 100
      setScrollProgress(progress)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  const sections = [
    { id: 'introduction', title: 'Introduction', icon: FileText },
    { id: 'acceptance', title: 'Acceptance of Terms', icon: Check },
    { id: 'services', title: 'Services Description', icon: Shield },
    { id: 'accounts', title: 'User Accounts', icon: AlertCircle },
    { id: 'privacy', title: 'Privacy & Data', icon: Shield },
    { id: 'payment', title: 'Payment Terms', icon: FileText },
    { id: 'liability', title: 'Limitation of Liability', icon: AlertCircle },
    { id: 'termination', title: 'Termination', icon: AlertCircle },
    { id: 'contact', title: 'Contact Information', icon: FileText }
  ]
  
  return (
    <div className="futuristic-container min-h-screen pt-24 pb-16">
      <div className="grid-background"></div>
      
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-800 z-50">
        <div 
          className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="glowing-title" data-text="Terms of Service">
              Terms of Service
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
            Please read these terms carefully before using AI Job Chommie
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            <span>Last Updated: August 30, 2025</span>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="glass-card sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-4">Navigate Sections</h3>
              <nav className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id)
                        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                        activeSection === section.id
                          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-l-2 border-cyan-400'
                          : 'hover:bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{section.title}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>
          
          {/* Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Introduction */}
            <section id="introduction" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FileText className="h-6 w-6 text-cyan-400" />
                Introduction
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>
                  Welcome to AI Job Chommie ("we," "our," or "us"). These Terms of Service ("Terms") govern your use of our website, 
                  mobile applications, and services (collectively, the "Services") provided by AI Job Chommie, 
                  registered in South Africa (Registration: AIJOBCHOMMIE | TRN: 2025/599261/07).
                </p>
                <p>
                  By accessing or using our Services, you agree to be bound by these Terms. If you disagree with any part of these terms, 
                  then you may not access the Services.
                </p>
              </div>
            </section>
            
            {/* Acceptance of Terms */}
            <section id="acceptance" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <Check className="h-6 w-6 text-purple-400" />
                Acceptance of Terms
              </h2>
              <div className="space-y-4 text-gray-300">
                <p className="font-semibold text-cyan-400">By using AI Job Chommie, you acknowledge that:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You are at least 18 years old or have parental consent</li>
                  <li>You have the legal capacity to enter into these Terms</li>
                  <li>You will comply with all applicable laws and regulations</li>
                  <li>You will provide accurate and complete information</li>
                  <li>You will maintain the security of your account credentials</li>
                </ul>
              </div>
            </section>
            
            {/* Services Description */}
            <section id="services" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <Shield className="h-6 w-6 text-pink-400" />
                Services Description
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>AI Job Chommie provides the following services:</p>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 rounded-lg bg-black/30 border border-cyan-400/20">
                    <h4 className="font-semibold text-cyan-400 mb-2">Job Matching</h4>
                    <p className="text-sm">AI-powered job recommendations based on your profile and preferences</p>
                  </div>
                  <div className="p-4 rounded-lg bg-black/30 border border-purple-400/20">
                    <h4 className="font-semibold text-purple-400 mb-2">Application Management</h4>
                    <p className="text-sm">Tools to track and manage your job applications</p>
                  </div>
                  <div className="p-4 rounded-lg bg-black/30 border border-pink-400/20">
                    <h4 className="font-semibold text-pink-400 mb-2">Career Insights</h4>
                    <p className="text-sm">Analytics and insights to improve your job search success</p>
                  </div>
                  <div className="p-4 rounded-lg bg-black/30 border border-cyan-400/20">
                    <h4 className="font-semibold text-cyan-400 mb-2">Resume Tools</h4>
                    <p className="text-sm">AI-assisted resume building and optimization</p>
                  </div>
                </div>
              </div>
            </section>
            
            {/* User Accounts */}
            <section id="accounts" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-cyan-400" />
                User Accounts
              </h2>
              <div className="space-y-4 text-gray-300">
                <h3 className="font-semibold text-purple-400">Account Responsibilities</h3>
                <p>When you create an account with us, you must:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and promptly update your account information</li>
                  <li>Maintain the security and confidentiality of your password</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized use</li>
                </ul>
                
                <h3 className="font-semibold text-purple-400 mt-6">Prohibited Activities</h3>
                <p>You may not:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Use the Services for any illegal or unauthorized purpose</li>
                  <li>Violate any laws in your jurisdiction</li>
                  <li>Submit false or misleading information</li>
                  <li>Interfere with or disrupt the Services</li>
                  <li>Attempt to gain unauthorized access to any portion of the Services</li>
                </ul>
              </div>
            </section>
            
            {/* Privacy & Data */}
            <section id="privacy" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <Shield className="h-6 w-6 text-purple-400" />
                Privacy & Data
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>
                  Your use of our Services is also governed by our Privacy Policy. Please review our Privacy Policy, 
                  which also governs the Site and informs users of our data collection practices.
                </p>
                <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/30">
                  <p className="text-sm">
                    <strong className="text-cyan-400">Important:</strong> We are committed to protecting your personal information 
                    and comply with the Protection of Personal Information Act (POPIA) of South Africa.
                  </p>
                </div>
              </div>
            </section>
            
            {/* Payment Terms */}
            <section id="payment" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FileText className="h-6 w-6 text-pink-400" />
                Payment Terms
              </h2>
              <div className="space-y-4 text-gray-300">
                <h3 className="font-semibold text-cyan-400">Subscription Plans</h3>
                <p>We offer various subscription plans with different features and pricing:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Free Plan:</strong> Basic features with limited usage</li>
                  <li><strong>Professional Plan:</strong> Enhanced features for serious job seekers</li>
                  <li><strong>Executive Plan:</strong> Premium features with priority support</li>
                </ul>
                
                <h3 className="font-semibold text-cyan-400 mt-6">Billing</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Subscriptions are billed monthly or annually in advance</li>
                  <li>All fees are in South African Rand (ZAR) unless otherwise specified</li>
                  <li>Prices are subject to change with 30 days notice</li>
                  <li>Refunds are processed according to our refund policy</li>
                </ul>
              </div>
            </section>
            
            {/* Limitation of Liability */}
            <section id="liability" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-cyan-400" />
                Limitation of Liability
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, AI JOB CHOMMIE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
                  SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY 
                  OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
                </p>
                <p>
                  Our total liability shall not exceed the amount you have paid us in the twelve (12) months prior to the claim.
                </p>
              </div>
            </section>
            
            {/* Termination */}
            <section id="termination" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-purple-400" />
                Termination
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
                <p>Upon termination, your right to use the Services will cease immediately. If you wish to terminate your account, you may simply discontinue using the Services.</p>
              </div>
            </section>
            
            {/* Contact Information */}
            <section id="contact" className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FileText className="h-6 w-6 text-pink-400" />
                Contact Information
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>If you have any questions about these Terms, please contact us at:</p>
                <div className="p-4 rounded-lg bg-black/30 border border-cyan-400/20">
                  <p><strong className="text-cyan-400">AI Job Chommie</strong></p>
                  <p>Email: legal@aijobchommie.co.za</p>
                  <p>Phone: +27 12 345 6789</p>
                  <p>Address: Port Elizabeth, Eastern Cape, South Africa</p>
                </div>
              </div>
            </section>
            
            {/* Agreement Button */}
            <div className="text-center mt-12">
              <button className="energy-button">
                I Understand and Accept These Terms
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermsPage
