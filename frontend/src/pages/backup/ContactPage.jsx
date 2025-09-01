import React, { useState } from 'react'
import { Mail, Phone, MapPin, Send, MessageSquare, User, Building, Clock } from 'lucide-react'
import '../styles/futuristic-theme.css'

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: ''
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      company: '',
      subject: '',
      message: ''
    })
    setIsSubmitting(false)
    alert('Thank you for your message! We will get back to you soon.')
  }
  
  return (
    <div className="futuristic-container min-h-screen pt-24 pb-16">
      <div className="grid-background"></div>
      
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="glowing-title" data-text="Get In Touch">
              Get In Touch
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Have questions? We're here to help you navigate your career journey with AI Job Chommie.
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div className="space-y-8">
            <div className="glass-card">
              <h2 className="text-2xl font-bold text-white mb-6">Contact Information</h2>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20">
                    <Mail className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Email</p>
                    <a href="mailto:support@aijobchommie.co.za" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                      support@aijobchommie.co.za
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20">
                    <Phone className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Phone</p>
                    <a href="tel:+27123456789" className="text-purple-400 hover:text-purple-300 transition-colors">
                      +27 12 345 6789
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20">
                    <MapPin className="h-6 w-6 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Location</p>
                    <p className="text-gray-400">
                      Port Elizabeth, Eastern Cape<br />
                      South Africa
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20">
                    <Clock className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Business Hours</p>
                    <p className="text-gray-400">
                      Monday - Friday: 8:00 AM - 6:00 PM SAST<br />
                      Saturday: 9:00 AM - 1:00 PM SAST
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="glass-card">
              <h3 className="text-xl font-bold text-white mb-4">Quick Support</h3>
              <div className="space-y-3">
                <a href="/help" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors">
                  <MessageSquare className="h-5 w-5 mr-3" />
                  Visit Help Center
                </a>
                <a href="/pricing" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors">
                  <Building className="h-5 w-5 mr-3" />
                  View Pricing Plans
                </a>
                <a href="/about" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors">
                  <User className="h-5 w-5 mr-3" />
                  Learn About Us
                </a>
              </div>
            </div>
          </div>
          
          {/* Contact Form */}
          <div className="glass-card">
            <h2 className="text-2xl font-bold text-white mb-6">Send Us a Message</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className={`w-full px-4 py-3 bg-black/30 border rounded-lg text-white placeholder-gray-500 transition-all duration-300 ${
                    focusedField === 'name' 
                      ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)]' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  placeholder="John Doe"
                />
              </div>
              
              {/* Email Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className={`w-full px-4 py-3 bg-black/30 border rounded-lg text-white placeholder-gray-500 transition-all duration-300 ${
                    focusedField === 'email' 
                      ? 'border-purple-400 shadow-[0_0_15px_rgba(153,69,255,0.3)]' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  placeholder="john@example.com"
                />
              </div>
              
              {/* Company Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('company')}
                  onBlur={() => setFocusedField(null)}
                  className={`w-full px-4 py-3 bg-black/30 border rounded-lg text-white placeholder-gray-500 transition-all duration-300 ${
                    focusedField === 'company' 
                      ? 'border-pink-400 shadow-[0_0_15px_rgba(255,0,255,0.3)]' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  placeholder="Your Company"
                />
              </div>
              
              {/* Subject Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Subject *
                </label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('subject')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className={`w-full px-4 py-3 bg-black/30 border rounded-lg text-white transition-all duration-300 ${
                    focusedField === 'subject' 
                      ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)]' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <option value="">Select a subject</option>
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="billing">Billing Question</option>
                  <option value="partnership">Partnership Opportunity</option>
                  <option value="feedback">Feedback</option>
                </select>
              </div>
              
              {/* Message Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('message')}
                  onBlur={() => setFocusedField(null)}
                  required
                  rows="5"
                  className={`w-full px-4 py-3 bg-black/30 border rounded-lg text-white placeholder-gray-500 transition-all duration-300 resize-none ${
                    focusedField === 'message' 
                      ? 'border-purple-400 shadow-[0_0_15px_rgba(153,69,255,0.3)]' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  placeholder="Tell us how we can help you..."
                />
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="energy-button w-full flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="energy-spinner w-5 h-5"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
            
            <p className="mt-6 text-sm text-gray-400 text-center">
              We typically respond within 24 hours during business days.
            </p>
          </div>
        </div>
        
        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently Asked <span className="text-cyan-400">Questions</span>
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                question: "How does AI Job Chommie work?",
                answer: "Our AI analyzes your profile and matches you with relevant job opportunities across South Africa."
              },
              {
                question: "Is there a free plan available?",
                answer: "Yes! We offer a free tier with basic features to help you get started on your job search journey."
              },
              {
                question: "How secure is my data?",
                answer: "We use enterprise-grade encryption and follow strict privacy protocols to protect your information."
              },
              {
                question: "Can I cancel my subscription anytime?",
                answer: "Absolutely! You can upgrade, downgrade, or cancel your subscription at any time from your account settings."
              }
            ].map((faq, index) => (
              <div key={index} className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactPage
