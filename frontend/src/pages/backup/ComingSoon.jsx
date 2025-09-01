import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Clock,
  Mail,
  Bell,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Calendar,
  Users,
  Zap,
  Shield,
  Smartphone,
  Target,
  TrendingUp,
  Star,
  Rocket,
  Building,
  Crown,
  DollarSign,
  BarChart3,
  Globe,
  Award,
  Briefcase,
  AlertTriangle,
  MapPin,
  FileText,
  Search,
  UserPlus,
  MessageSquare,
  Settings
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const FEATURE_STATUS = {
  PLANNING: 'planning',
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  LAUNCHING: 'launching'
}

const FEATURES = [
  {
    id: 'employer-portal',
    title: 'Employer Job Portal',
    description: 'Revolutionary platform for companies and government agencies to post jobs directly into our AI-powered database',
    icon: <Building className="h-8 w-8" />,
    status: FEATURE_STATUS.DEVELOPMENT,
    progress: 35,
    eta: 'Q1 2025',
    highlights: [
      'Direct job posting to AI-enhanced database',
      'Smart candidate matching algorithms',
      'Real-time application tracking dashboard',
      'Advanced filtering and search capabilities',
      'Bulk job posting tools',
      'Government sector integration',
      'Automated candidate screening',
      'Custom branding and company profiles'
    ],
    category: 'employer'
  },
  {
    id: 'recruitment-analytics',
    title: 'Recruitment Analytics Suite',
    description: 'Comprehensive analytics and insights for employers to optimize their hiring process',
    icon: <BarChart3 className="h-8 w-8" />,
    status: FEATURE_STATUS.PLANNING,
    progress: 20,
    eta: 'Q2 2025',
    highlights: [
      'Hiring funnel analytics',
      'Candidate quality scoring',
      'Time-to-hire optimization',
      'Cost-per-hire tracking',
      'Market salary benchmarking',
      'Diversity and inclusion metrics',
      'Competitor analysis',
      'ROI reporting dashboard'
    ],
    category: 'employer'
  },
  {
    id: 'premium-branding',
    title: 'Premium Company Branding',
    description: 'Enhanced company profiles and branding options to attract top talent',
    icon: <Crown className="h-8 w-8" />,
    status: FEATURE_STATUS.PLANNING,
    progress: 15,
    eta: 'Q2 2025',
    highlights: [
      'Custom company profile pages',
      'Video and multimedia content',
      'Employee testimonials integration',
      'Company culture showcases',
      'Featured job placements',
      'Priority search rankings',
      'Social media integration',
      'Custom recruitment campaigns'
    ],
    category: 'revenue'
  },
  {
    id: 'sponsored-content',
    title: 'Sponsored Job Listings',
    description: 'Premium job advertisement placements with enhanced visibility and Google Ads integration',
    icon: <Star className="h-8 w-8" />,
    status: FEATURE_STATUS.DEVELOPMENT,
    progress: 40,
    eta: 'March 2025',
    highlights: [
      'Priority placement in search results',
      'Google Ads network integration',
      'Targeted audience advertising',
      'Cross-platform promotion',
      'Performance tracking and optimization',
      'A/B testing for job descriptions',
      'Social media amplification',
      'Email newsletter featuring'
    ],
    category: 'revenue'
  },
  {
    id: 'mobile-app',
    title: 'Mobile App',
    description: 'Native iOS and Android apps for job searching on the go',
    icon: <Smartphone className="h-8 w-8" />,
    status: FEATURE_STATUS.DEVELOPMENT,
    progress: 65,
    eta: 'Q2 2025',
    highlights: [
      'Native iOS and Android apps',
      'Offline job browsing',
      'Push notifications for new matches',
      'Mobile-optimized application flow'
    ],
    category: 'user'
  },
  {
    id: 'advanced-analytics',
    title: 'Advanced Analytics',
    description: 'Deep insights into your job search performance and market trends',
    icon: <TrendingUp className="h-8 w-8" />,
    status: FEATURE_STATUS.TESTING,
    progress: 80,
    eta: 'March 2025',
    highlights: [
      'Success prediction modeling',
      'Market trend analysis',
      'Personalized insights dashboard',
      'Competitive salary benchmarking'
    ],
    category: 'user'
  },
  {
    id: 'video-interviews',
    title: 'Video Interview Prep',
    description: 'AI-powered video interview practice and feedback',
    icon: <Target className="h-8 w-8" />,
    status: FEATURE_STATUS.PLANNING,
    progress: 25,
    eta: 'Q3 2025',
    highlights: [
      'AI-powered practice sessions',
      'Real-time feedback and coaching',
      'Industry-specific question banks',
      'Performance tracking'
    ],
    category: 'user'
  },
  {
    id: 'smart-matching',
    title: 'Smart Job Matching 2.0',
    description: 'Next-generation AI matching with personality and culture fit',
    icon: <Sparkles className="h-8 w-8" />,
    status: FEATURE_STATUS.DEVELOPMENT,
    progress: 45,
    eta: 'April 2025',
    highlights: [
      'Personality-based matching',
      'Company culture analysis',
      'Career progression prediction',
      'Work-life balance scoring'
    ],
    category: 'user'
  }
]

function ProgressBar({ progress, color = 'bg-gradient-to-r from-cyan-500 to-purple-500' }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-2">
      <div 
        className={`${color} h-2 rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

function StatusBadge({ status }) {
  const statusConfig = {
    [FEATURE_STATUS.PLANNING]: { 
      label: 'Planning', 
      color: 'text-blue-400 border-blue-400/30', 
      icon: <Calendar className="h-3 w-3" /> 
    },
    [FEATURE_STATUS.DEVELOPMENT]: { 
      label: 'In Development', 
      color: 'text-yellow-400 border-yellow-400/30', 
      icon: <Zap className="h-3 w-3" /> 
    },
    [FEATURE_STATUS.TESTING]: { 
      label: 'Testing', 
      color: 'text-orange-400 border-orange-400/30', 
      icon: <Shield className="h-3 w-3" /> 
    },
    [FEATURE_STATUS.LAUNCHING]: { 
      label: 'Launching Soon', 
      color: 'text-green-400 border-green-400/30', 
      icon: <Rocket className="h-3 w-3" /> 
    }
  }
  
  const config = statusConfig[status]
  
  return (
    <Badge variant="outline" className={`${config.color} flex items-center gap-1 text-xs`}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

function FeatureCard({ feature, onNotifyMe }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-lg flex items-center justify-center text-cyan-400">
              {feature.icon}
            </div>
            <div>
              <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={feature.status} />
                <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                  ETA: {feature.eta}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <CardDescription className="text-gray-300 mt-3">
          {feature.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Development Progress</span>
            <span>{feature.progress}%</span>
          </div>
          <ProgressBar progress={feature.progress} />
        </div>
        
        {isExpanded && (
          <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
            <div>
              <h4 className="text-white font-medium text-sm mb-2">Key Features:</h4>
              <ul className="space-y-1">
                {feature.highlights.map((highlight, index) => (
                  <li key={index} className="text-gray-300 text-sm flex items-center gap-2">
                    <Star className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white"
          >
            {isExpanded ? 'Show Less' : 'Learn More'}
          </Button>
          
          <Button
            size="sm"
            onClick={() => onNotifyMe(feature)}
            className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-400/30 hover:bg-gradient-to-r hover:from-cyan-500/30 hover:to-purple-500/30"
          >
            <Bell className="h-3 w-3 mr-1" />
            Notify Me
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ComingSoon() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [email, setEmail] = useState('')
  const [selectedFeatures, setSelectedFeatures] = useState([])
  const [userType, setUserType] = useState('') // 'jobseeker', 'employer', 'government'
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Get feature from URL params
  const featureParam = searchParams.get('feature')
  
  useEffect(() => {
    if (featureParam) {
      const feature = FEATURES.find(f => f.id === featureParam)
      if (feature && !selectedFeatures.includes(feature.id)) {
        setSelectedFeatures([feature.id])
      }
    }
  }, [featureParam])
  
  const handleNotifyMe = (feature) => {
    if (!selectedFeatures.includes(feature.id)) {
      setSelectedFeatures([...selectedFeatures, feature.id])
    }
    
    // Scroll to subscription form
    document.getElementById('notify-form')?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'center'
    })
  }
  
  const handleSubscribe = async (e) => {
    e.preventDefault()
    if (!email || selectedFeatures.length === 0) return
    
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setIsSubscribed(true)
    } catch (error) {
      setError('Failed to subscribe. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const removeFeature = (featureId) => {
    setSelectedFeatures(selectedFeatures.filter(id => id !== featureId))
  }
  
  if (isSubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">You're All Set!</CardTitle>
            <CardDescription className="text-gray-300">
              Thanks for your interest! We'll notify you when these features are ready.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="text-center space-y-6">
            <div className="space-y-2">
              <p className="text-gray-300">We'll send updates to:</p>
              <p className="text-cyan-400 font-medium">{email}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-gray-300 text-sm">You'll be notified about:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedFeatures.map(featureId => {
                  const feature = FEATURES.find(f => f.id === featureId)
                  return (
                    <Badge key={featureId} variant="outline" className="text-cyan-400 border-cyan-400/30">
                      {feature.title}
                    </Badge>
                  )
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/')}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Explore Current Features
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => setIsSubscribed(false)}
                className="w-full text-gray-400"
              >
                Subscribe to More Updates
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            <span className="text-cyan-400">Coming Soon</span> Features
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Exciting new capabilities are in development. Be the first to know when they're ready!
          </p>
        </div>
        
        {/* Employer Portal Highlight */}
        <div className="mb-16">
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-400/30">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown className="h-12 w-12 text-amber-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                   <span className="text-amber-400">Enterprise</span> & Government Portal
                </h2>
                <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                  We're currently developing a revolutionary platform specifically designed for private companies 
                  and government agencies to seamlessly integrate job advertisements directly into our AI-powered database.
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    For Private Sector
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Direct AI Integration:</strong> Your job posts get enhanced by our AI for maximum candidate matching</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Smart Screening:</strong> AI pre-screens candidates based on your specific requirements</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Instant Notifications:</strong> Real-time alerts for qualified candidate applications</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Global Reach:</strong> Access to our expanding international talent pool</span>
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    For Government Agencies
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Compliance Built-In:</strong> Automated compliance checks for government hiring standards</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Security Clearance Matching:</strong> Intelligent matching based on clearance levels</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Diversity Tracking:</strong> Built-in tools for meeting diversity and inclusion goals</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                      <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Bulk Operations:</strong> Post hundreds of positions simultaneously with ease</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-6 rounded-lg border border-amber-400/30">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center justify-center gap-2">
                    <Users className="h-5 w-5" />
                    Launching Based on Demand
                  </h3>
                  <p className="text-gray-300 mb-4">
                    This powerful employer portal will launch when we reach sufficient interest from potential clients. 
                    Your early signup helps us prioritize development and ensures you'll be among the first to access 
                    this game-changing recruitment platform.
                  </p>
                  <Button 
                    onClick={() => handleNotifyMe(FEATURES.find(f => f.id === 'employer-portal'))}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold px-8"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    I'm Interested - Notify Me!
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Revenue & Monetization Features */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-4"> Revenue & Monetization Features</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Beyond subscriptions, we're developing multiple revenue streams to create a sustainable, 
              profitable platform that benefits both job seekers and employers.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card className="bg-green-500/10 border-green-400/30">
              <CardHeader>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                  <DollarSign className="h-6 w-6 text-green-400" />
                </div>
                <CardTitle className="text-white">Google Ads Integration</CardTitle>
                <CardDescription className="text-gray-300">
                  Strategic ad placements to generate consistent revenue while maintaining user experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Non-intrusive ad placements</li>
                  <li>• Targeted career-related advertisements</li>
                  <li>• Revenue sharing with content creators</li>
                  <li>• Premium ad-free experience option</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-purple-500/10 border-purple-400/30">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Award className="h-6 w-6 text-purple-400" />
                </div>
                <CardTitle className="text-white">Premium Services</CardTitle>
                <CardDescription className="text-gray-300">
                  Enhanced services for power users and professional recruiters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Resume writing and optimization</li>
                  <li>• 1-on-1 career coaching sessions</li>
                  <li>• LinkedIn profile optimization</li>
                  <li>• Interview coaching packages</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-500/10 border-blue-400/30">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                  <MessageSquare className="h-6 w-6 text-blue-400" />
                </div>
                <CardTitle className="text-white">Content Partnerships</CardTitle>
                <CardDescription className="text-gray-300">
                  Sponsored content and educational partnerships with industry leaders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Sponsored career articles and guides</li>
                  <li>• Industry webinars and events</li>
                  <li>• Corporate training partnerships</li>
                  <li>• Certification program affiliations</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          
          {/* Additional Revenue Streams */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-indigo-500/10 border-indigo-400/30">
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-indigo-400" />
                </div>
                <CardTitle className="text-white">Data & Insights Marketplace</CardTitle>
                <CardDescription className="text-gray-300">
                  Anonymized labor market insights and trends for research institutions and corporations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Anonymized hiring trend reports</li>
                  <li>• Salary benchmark data licensing</li>
                  <li>• Skills gap analysis for universities</li>
                  <li>• Market demand forecasting</li>
                  <li>• Regional employment insights</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-rose-500/10 border-rose-400/30">
              <CardHeader>
                <div className="w-12 h-12 bg-rose-500/20 rounded-lg flex items-center justify-center mb-3">
                  <UserPlus className="h-6 w-6 text-rose-400" />
                </div>
                <CardTitle className="text-white">White-Label Solutions</CardTitle>
                <CardDescription className="text-gray-300">
                  Customizable recruitment platforms for large enterprises and government agencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Branded recruitment portals</li>
                  <li>• Custom integration APIs</li>
                  <li>• Enterprise-level support</li>
                  <li>• Dedicated account management</li>
                  <li>• Custom feature development</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Feature Timeline */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Development Timeline</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => (
              <FeatureCard 
                key={feature.id} 
                feature={feature} 
                onNotifyMe={handleNotifyMe}
              />
            ))}
          </div>
        </div>
        
        {/* Employer Call-to-Action */}
        <div className="mb-16">
          <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-400/30">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="h-10 w-10 text-emerald-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                   <span className="text-emerald-400">Why Employers</span> Will Love This
                </h2>
                <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                  Our employer portal isn't just another job board. It's a complete AI-driven recruitment ecosystem 
                  that revolutionizes how organizations find, attract, and hire top talent.
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">10x Faster Hiring</h3>
                  <p className="text-gray-300 text-sm">
                    Our AI pre-screens candidates automatically, reducing your time-to-hire by up to 80% 
                    while ensuring higher quality matches.
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="h-8 w-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Perfect Matches</h3>
                  <p className="text-gray-300 text-sm">
                    Advanced AI analyzes not just skills but personality, culture fit, and career goals 
                    to find candidates who'll thrive at your organization.
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="h-8 w-8 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Data-Driven ROI</h3>
                  <p className="text-gray-300 text-sm">
                    Comprehensive analytics show exactly how your investment translates to successful hires, 
                    with measurable improvements in retention and performance.
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 p-6 rounded-lg border border-emerald-400/30">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-4">
                     Limited Early Access Program
                  </h3>
                  <p className="text-gray-300 mb-6 text-lg">
                    The first 100 companies and government agencies to sign up will receive:
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-black/20 p-4 rounded-lg">
                      <h4 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Founder's Package
                      </h4>
                      <ul className="text-gray-300 text-sm space-y-1">
                        <li> Lifetime early adopter benefits</li>
                        <li> Custom feature requests priority</li>
                        <li> Dedicated success manager</li>
                        <li> Free premium branding setup</li>
                      </ul>
                    </div>
                    
                    <div className="bg-black/20 p-4 rounded-lg">
                      <h4 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                        <Rocket className="h-4 w-4" />
                        Launch Benefits
                      </h4>
                      <ul className="text-gray-300 text-sm space-y-1">
                        <li> Beta testing access (Q4 2024)</li>
                        <li> Platform customization input</li>
                        <li> Integration support included</li>
                        <li> Success story features</li>
                      </ul>
                    </div>
                  </div>
                  
                  <p className="text-amber-400 font-semibold text-lg mb-4">
                     Your interest today determines our launch timeline!
                  </p>
                  
                  <Button 
                    onClick={() => handleNotifyMe(FEATURES.find(f => f.id === 'employer-portal'))}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-12 py-3 text-lg"
                  >
                    <Crown className="h-5 w-5 mr-2" />
                    Reserve My Spot - FREE!
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Notification Signup */}
        <Card id="notify-form" className="max-w-2xl mx-auto bg-white/5 border-white/10">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white mb-2">
              Get Notified First
            </CardTitle>
            <CardDescription className="text-gray-300 text-lg">
              Join our early access list and be among the first to try new features
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubscribe} className="space-y-6">
              <div>
                <label className="text-sm text-gray-300 mb-2 block">Email Address</label>
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400 h-12"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-300 mb-3 block">I am a:</label>
                <div className="grid sm:grid-cols-3 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setUserType('jobseeker')}
                    className={`p-3 rounded-lg border transition-all ${
                      userType === 'jobseeker' 
                        ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-400' 
                        : 'border-gray-600 bg-white/5 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <Search className="h-5 w-5 mx-auto mb-2" />
                    <div className="text-sm font-medium">Job Seeker</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setUserType('employer')}
                    className={`p-3 rounded-lg border transition-all ${
                      userType === 'employer' 
                        ? 'border-amber-400/50 bg-amber-500/10 text-amber-400' 
                        : 'border-gray-600 bg-white/5 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <Building className="h-5 w-5 mx-auto mb-2" />
                    <div className="text-sm font-medium">Company</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setUserType('government')}
                    className={`p-3 rounded-lg border transition-all ${
                      userType === 'government' 
                        ? 'border-green-400/50 bg-green-500/10 text-green-400' 
                        : 'border-gray-600 bg-white/5 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <Globe className="h-5 w-5 mx-auto mb-2" />
                    <div className="text-sm font-medium">Government</div>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-300 mb-3 block">
                  Features you're interested in:
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {FEATURES.map((feature) => (
                    <div key={feature.id} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={`feature-${feature.id}`}
                        checked={selectedFeatures.includes(feature.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFeatures([...selectedFeatures, feature.id])
                          } else {
                            removeFeature(feature.id)
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-white/10 text-cyan-500 focus:ring-cyan-500 focus:ring-2"
                      />
                      <label 
                        htmlFor={`feature-${feature.id}`}
                        className="text-gray-300 text-sm cursor-pointer flex-1"
                      >
                        {feature.title}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedFeatures.length > 0 && (
                <div className="bg-black/20 p-4 rounded-lg">
                  <h4 className="text-white font-medium text-sm mb-2">Selected Features:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedFeatures.map(featureId => {
                      const feature = FEATURES.find(f => f.id === featureId)
                      return (
                        <Badge 
                          key={featureId} 
                          variant="outline" 
                          className="text-cyan-400 border-cyan-400/30 flex items-center gap-1"
                        >
                          {feature.title}
                          <button 
                            type="button"
                            onClick={() => removeFeature(featureId)}
                            className="ml-1 hover:text-white"
                          >
                            ×
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {error && (
                <Alert className="bg-red-500/10 border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 h-12 text-lg"
                disabled={isLoading || !email || selectedFeatures.length === 0}
              >
                {isLoading ? (
                  <>
                    <Clock className="h-5 w-5 mr-2 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  <>
                    <Bell className="h-5 w-5 mr-2" />
                    Notify Me When Ready
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-cyan-400/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-cyan-400" />
                <span className="text-cyan-400 font-medium text-sm">Early Access Benefits</span>
              </div>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Beta access to features before public release</li>
                <li>• Exclusive feedback and input opportunities</li>
                <li>• Priority support during early access period</li>
                <li>• Special launch discounts and promotions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* Back Button */}
        <div className="text-center mt-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
