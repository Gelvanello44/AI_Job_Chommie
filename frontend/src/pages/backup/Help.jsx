import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  MessageCircle, 
  Book, 
  Video, 
  HelpCircle, 
  ChevronDown, 
  ChevronRight,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Lightbulb,
  Users,
  Settings,
  CreditCard,
  FileText,
  Zap,
  Shield
} from 'lucide-react'

const FAQ_CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <Lightbulb className="h-5 w-5" />,
    questions: [
      {
        question: 'How do I create my first job application?',
        answer: 'After signing up, complete your profile in the Dashboard, then go to Jobs to browse opportunities. Click "Apply" on any job that interests you, and our AI will automatically customize your application materials.'
      },
      {
        question: 'What information should I include in my profile?',
        answer: 'Include your contact details, work experience, education, skills, and career preferences. The more complete your profile, the better our AI can match you with relevant opportunities and optimize your applications.'
      },
      {
        question: 'How does the AI job matching work?',
        answer: 'Our AI analyzes your profile, skills, experience, and preferences to match you with suitable job opportunities. It considers factors like location, salary expectations, company culture, and role requirements to find your best fits.'
      }
    ]
  },
  {
    id: 'applications',
    title: 'Job Applications',
    icon: <FileText className="h-5 w-5" />,
    questions: [
      {
        question: 'Can I track my job applications?',
        answer: 'Yes! Go to the Applications page to see all your submitted applications, their current status, and next actions. You can update statuses as you hear back from employers and add notes to track your progress.'
      },
      {
        question: 'How do I customize my cover letters?',
        answer: 'In the AI Writing section, you can generate personalized cover letters for specific jobs. Our AI considers the job description, company information, and your profile to create tailored content that you can further customize.'
      },
      {
        question: 'What if I want to apply manually instead of using auto-apply?',
        answer: 'You can disable auto-apply in your Preferences and apply manually to jobs. This gives you full control over when and how you apply, while still benefiting from our AI-optimized application materials.'
      }
    ]
  },
  {
    id: 'subscription',
    title: 'Subscription & Billing',
    icon: <CreditCard className="h-5 w-5" />,
    questions: [
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept major credit cards (Visa, Mastercard, American Express) and bank transfers. All payments are processed securely through our payment partners and we never store your financial information.'
      },
      {
        question: 'Can I change my subscription plan?',
        answer: 'Yes, you can upgrade or downgrade your plan anytime in Settings > Subscription. Changes take effect immediately for upgrades, or at the end of your current billing cycle for downgrades.'
      },
      {
        question: 'Do you offer refunds?',
        answer: 'We offer a 7-day money-back guarantee for new subscriptions. For other refund requests, please contact our support team and we\'ll review your case based on our refund policy and South African consumer protection laws.'
      }
    ]
  },
  {
    id: 'technical',
    title: 'Technical Support',
    icon: <Settings className="h-5 w-5" />,
    questions: [
      {
        question: 'Why is my CV not uploading?',
        answer: 'Ensure your CV is in PDF, DOC, or DOCX format and under 5MB. Clear your browser cache and try again. If the issue persists, try using a different browser or contact support with your file details.'
      },
      {
        question: 'I\'m not receiving email notifications',
        answer: 'Check your spam/junk folder first. Then verify your email address in Settings and ensure notifications are enabled in your preferences. Add notifications@aijobchommie.co.za to your contacts to prevent filtering.'
      },
      {
        question: 'How do I reset my password?',
        answer: 'Click "Forgot Password" on the login page and enter your email address. You\'ll receive a password reset link within a few minutes. Check your spam folder if you don\'t see it in your inbox.'
      }
    ]
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    icon: <Shield className="h-5 w-5" />,
    questions: [
      {
        question: 'How is my personal information protected?',
        answer: 'We use enterprise-grade security measures including encryption, secure servers, and regular security audits. We\'re POPIA compliant and never sell your personal information. Read our Privacy Policy for full details.'
      },
      {
        question: 'Who can see my profile information?',
        answer: 'Only employers you apply to can see your application materials. Your profile is private by default. You can control visibility settings in your Privacy preferences to determine what information is shared and when.'
      },
      {
        question: 'How do I delete my account and data?',
        answer: 'Go to Settings > Account > Delete Account. This will permanently remove all your data from our systems within 30 days, as required by POPIA. You can also contact support for assistance with account deletion.'
      }
    ]
  }
]

const TUTORIALS = [
  {
    id: 'profile-setup',
    title: 'Complete Profile Setup',
    description: 'Learn how to create a compelling profile that gets noticed by employers',
    duration: '5 min',
    difficulty: 'Beginner',
    steps: [
      'Navigate to your Dashboard after signing up',
      'Click "Complete Profile" and fill in your personal details',
      'Add your work experience with specific achievements',
      'List your skills and education background',
      'Set your job preferences and location settings',
      'Upload a professional photo (optional but recommended)'
    ]
  },
  {
    id: 'cv-optimization',
    title: 'AI CV Optimization',
    description: 'Maximize your CV\'s impact with our AI-powered optimization tools',
    duration: '8 min',
    difficulty: 'Intermediate',
    steps: [
      'Go to the CV Builder from your dashboard',
      'Upload your existing CV or create a new one',
      'Choose from professional templates',
      'Use the AI optimization feature to improve content',
      'Review and accept suggested keywords',
      'Download your optimized CV in PDF format'
    ]
  },
  {
    id: 'job-search',
    title: 'Effective Job Searching',
    description: 'Master the art of finding and applying to the right opportunities',
    duration: '10 min',
    difficulty: 'Beginner',
    steps: [
      'Set up job alerts in the Alerts section',
      'Browse jobs using filters for location, salary, and role',
      'Read job descriptions carefully and check match scores',
      'Use Company Intelligence to research employers',
      'Apply with one click or customize your application',
      'Track your applications in the Applications dashboard'
    ]
  }
]

function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="border border-white/10 rounded-lg">
      <button
        className="w-full p-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-white font-medium">{question}</span>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-gray-300 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  )
}

function ContactSupport() {
  const [ticket, setTicket] = useState({
    subject: '',
    category: '',
    priority: 'medium',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    alert('Support ticket submitted successfully! We\'ll respond within 24 hours.')
    setTicket({ subject: '', category: '', priority: 'medium', message: '' })
    setIsSubmitting(false)
  }
  
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center">
            <Mail className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Email Support</h3>
            <p className="text-gray-300 text-sm mb-3">
              Get help via email with detailed responses
            </p>
            <div className="text-cyan-400 text-sm">
              support@aijobchommie.co.za
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 text-green-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Response Time</h3>
            <p className="text-gray-300 text-sm mb-3">
              We aim to respond quickly to your queries
            </p>
            <div className="text-green-400 text-sm">
              Within 24 hours
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center">
            <Users className="h-8 w-8 text-purple-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Support Hours</h3>
            <p className="text-gray-300 text-sm mb-3">
              Mon-Fri: 8AM-5PM SAST
            </p>
            <div className="text-purple-400 text-sm">
              Saturday: 9AM-1PM
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Submit a Support Ticket</CardTitle>
          <CardDescription className="text-gray-300">
            Describe your issue and we'll get back to you as soon as possible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-white text-sm font-medium block mb-2">
                  Subject *
                </label>
                <Input
                  value={ticket.subject}
                  onChange={(e) => setTicket(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief description of your issue"
                  required
                />
              </div>
              <div>
                <label className="text-white text-sm font-medium block mb-2">
                  Category *
                </label>
                <select
                  value={ticket.category}
                  onChange={(e) => setTicket(prev => ({ ...prev, category: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                >
                  <option value="">Select category</option>
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing & Subscription</option>
                  <option value="application">Job Applications</option>
                  <option value="account">Account & Profile</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Priority
              </label>
              <div className="flex gap-4">
                {['low', 'medium', 'high'].map(priority => (
                  <label key={priority} className="flex items-center gap-2 text-gray-300">
                    <input
                      type="radio"
                      value={priority}
                      checked={ticket.priority === priority}
                      onChange={(e) => setTicket(prev => ({ ...prev, priority: e.target.value }))}
                      className="text-cyan-500"
                    />
                    <span className="capitalize">{priority}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Description *
              </label>
              <Textarea
                value={ticket.message}
                onChange={(e) => setTicket(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Please provide as much detail as possible about your issue, including steps to reproduce if it's a technical problem."
                rows={6}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Help() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  
  const filteredFAQs = FAQ_CATEGORIES.map(category => ({
    ...category,
    questions: category.questions.filter(q =>
      q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => 
    !selectedCategory || category.id === selectedCategory
  )
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Help <span className="text-cyan-400">Center</span>
          </h1>
          <p className="text-xl text-gray-300">
            Get the support you need to succeed in your job search
          </p>
        </div>
        
        {/* Search */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for help articles, FAQs, or tutorials..."
              className="pl-10 py-3 text-lg bg-white/10 border-white/20"
            />
          </div>
        </div>
        
        <Tabs defaultValue="faq" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-white/10">
              <TabsTrigger value="faq" className="data-[state=active]:bg-white/20">
                <HelpCircle className="h-4 w-4 mr-2" />
                FAQs
              </TabsTrigger>
              <TabsTrigger value="tutorials" className="data-[state=active]:bg-white/20">
                <Video className="h-4 w-4 mr-2" />
                Tutorials
              </TabsTrigger>
              <TabsTrigger value="contact" className="data-[state=active]:bg-white/20">
                <MessageCircle className="h-4 w-4 mr-2" />
                Contact Support
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="faq">
            <div className="space-y-8">
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={!selectedCategory ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory('')}
                >
                  All Categories
                </Button>
                {FAQ_CATEGORIES.map(category => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="flex items-center gap-2"
                  >
                    {category.icon}
                    {category.title}
                  </Button>
                ))}
              </div>
              
              {/* FAQ Categories */}
              <div className="grid gap-8">
                {filteredFAQs.map(category => (
                  category.questions.length > 0 && (
                    <Card key={category.id} className="bg-white/5 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          {category.icon}
                          {category.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {category.questions.map((faq, index) => (
                            <FAQItem
                              key={index}
                              question={faq.question}
                              answer={faq.answer}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="tutorials">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {TUTORIALS.map(tutorial => (
                <Card key={tutorial.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-white text-lg">{tutorial.title}</CardTitle>
                        <CardDescription className="text-gray-300 mt-2">
                          {tutorial.description}
                        </CardDescription>
                      </div>
                      <Book className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Badge variant="outline" className="text-xs">
                        {tutorial.duration}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tutorial.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {tutorial.steps.slice(0, 3).map((step, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-gray-300">
                          <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                          {step}
                        </div>
                      ))}
                      {tutorial.steps.length > 3 && (
                        <div className="text-sm text-gray-400">
                          +{tutorial.steps.length - 3} more steps...
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      View Tutorial
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="contact">
            <ContactSupport />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
