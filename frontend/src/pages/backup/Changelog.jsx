import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Calendar,
  Star,
  Zap,
  Bug,
  Shield,
  Sparkles,
  ArrowUp,
  Plus,
  Wrench,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Bell
} from 'lucide-react'

const UPDATES = [
  {
    id: 1,
    version: '2.1.0',
    title: 'Advanced AI Matching & Predictive Analytics',
    date: '2025-01-20',
    type: 'major',
    status: 'released',
    description: 'Major upgrade to our AI engine with advanced matching algorithms and predictive success analytics.',
    changes: [
      {
        type: 'feature',
        title: 'AI-Powered Success Predictions',
        description: 'Get probability scores and timeline predictions for your job applications'
      },
      {
        type: 'feature', 
        title: 'Advanced Job Matching',
        description: 'Improved matching algorithm considers company culture, career growth, and personality fit'
      },
      {
        type: 'feature',
        title: 'Predictive Analytics Dashboard',
        description: 'New dashboard showing success trends, optimization opportunities, and AI insights'
      },
      {
        type: 'improvement',
        title: 'Enhanced Company Intelligence',
        description: 'More detailed company research with culture analysis and hiring patterns'
      },
      {
        type: 'improvement',
        title: 'Faster Application Processing',
        description: 'Reduced application processing time by 40% with optimized AI workflows'
      }
    ],
    metrics: {
      improvements: 5,
      newFeatures: 3,
      bugFixes: 0,
      affectedUsers: 'All users'
    }
  },
  {
    id: 2,
    version: '2.0.5',
    title: 'CV Builder Enhancements & Bug Fixes',
    date: '2025-01-15',
    type: 'minor',
    status: 'released',
    description: 'Improved CV builder with new templates and important stability fixes.',
    changes: [
      {
        type: 'feature',
        title: 'Executive CV Templates',
        description: 'New professional templates designed for senior and executive positions'
      },
      {
        type: 'improvement',
        title: 'ATS Optimization Score',
        description: 'Real-time ATS compatibility scoring while you build your CV'
      },
      {
        type: 'bug',
        title: 'CV Export Issues',
        description: 'Fixed PDF export problems with special characters and formatting'
      },
      {
        type: 'bug',
        title: 'Template Loading',
        description: 'Resolved slow loading times for CV templates on mobile devices'
      }
    ],
    metrics: {
      improvements: 1,
      newFeatures: 1,
      bugFixes: 2,
      affectedUsers: 'CV Builder users'
    }
  },
  {
    id: 3,
    version: '2.0.0',
    title: 'Complete Platform Redesign & AI Integration',
    date: '2025-01-10',
    type: 'major',
    status: 'released',
    description: 'Complete overhaul of the platform with new AI capabilities and modern interface.',
    changes: [
      {
        type: 'feature',
        title: 'AI Writing Assistant',
        description: 'Generate personalized cover letters and optimize CVs with AI'
      },
      {
        type: 'feature',
        title: 'Company Intelligence System',
        description: 'Research companies with AI-powered insights and culture analysis'
      },
      {
        type: 'feature',
        title: 'Skills Assessment Quiz',
        description: 'Identify your top skills with our comprehensive assessment tool'
      },
      {
        type: 'feature',
        title: 'Application Analytics',
        description: 'Track your application performance with detailed analytics'
      },
      {
        type: 'improvement',
        title: 'Modern UI/UX Design',
        description: 'Complete interface redesign for better user experience'
      },
      {
        type: 'improvement',
        title: 'Mobile Optimization',
        description: 'Fully responsive design optimized for mobile devices'
      }
    ],
    metrics: {
      improvements: 2,
      newFeatures: 4,
      bugFixes: 0,
      affectedUsers: 'All users'
    }
  },
  {
    id: 4,
    version: '1.9.2',
    title: 'Security Updates & Performance Improvements',
    date: '2025-01-05',
    type: 'patch',
    status: 'released',
    description: 'Important security updates and performance optimizations.',
    changes: [
      {
        type: 'security',
        title: 'Enhanced Data Protection',
        description: 'Improved encryption for user data and application materials'
      },
      {
        type: 'security',
        title: 'Authentication Improvements',
        description: 'Strengthened user authentication and session management'
      },
      {
        type: 'improvement',
        title: 'Database Optimization',
        description: 'Faster page load times and improved search performance'
      },
      {
        type: 'bug',
        title: 'Notification Issues',
        description: 'Fixed email notification delivery problems'
      }
    ],
    metrics: {
      improvements: 1,
      newFeatures: 0,
      bugFixes: 1,
      affectedUsers: 'All users'
    }
  },
  {
    id: 5,
    version: '1.9.0',
    title: 'Job Alerts & Newsletter System',
    date: '2024-12-20',
    type: 'minor',
    status: 'released',
    description: 'New job alerts system and market insights newsletter.',
    changes: [
      {
        type: 'feature',
        title: 'Weekly Job Alerts',
        description: 'Receive personalized job recommendations delivered to your inbox'
      },
      {
        type: 'feature',
        title: 'Market Insights Newsletter',
        description: 'Stay updated with SA job market trends and salary insights'
      },
      {
        type: 'improvement',
        title: 'Enhanced Job Filtering',
        description: 'More precise filters for location, salary, and job type'
      }
    ],
    metrics: {
      improvements: 1,
      newFeatures: 2,
      bugFixes: 0,
      affectedUsers: 'Pro & Executive users'
    }
  }
]

const UPCOMING_FEATURES = [
  {
    title: 'Interview Scheduler',
    description: 'Calendar integration for seamless interview scheduling',
    eta: 'February 2025',
    status: 'development'
  },
  {
    title: 'Referral Program',
    description: 'Earn rewards for referring friends to AI Job Chommie',
    eta: 'March 2025',
    status: 'planning'
  },
  {
    title: 'Mobile App',
    description: 'Native mobile apps for iOS and Android',
    eta: 'Q2 2025',
    status: 'planning'
  },
  {
    title: 'API Integration',
    description: 'Connect with external job boards and ATS systems',
    eta: 'Q3 2025',
    status: 'research'
  }
]

function ChangeIcon({ type }) {
  const iconProps = { className: "h-4 w-4" }
  
  switch (type) {
    case 'feature':
      return <Plus {...iconProps} className="h-4 w-4 text-green-400" />
    case 'improvement':
      return <ArrowUp {...iconProps} className="h-4 w-4 text-blue-400" />
    case 'bug':
      return <Bug {...iconProps} className="h-4 w-4 text-red-400" />
    case 'security':
      return <Shield {...iconProps} className="h-4 w-4 text-purple-400" />
    default:
      return <Sparkles {...iconProps} className="h-4 w-4 text-cyan-400" />
  }
}

function VersionCard({ update }) {
  const getTypeColor = (type) => {
    switch (type) {
      case 'major': return 'from-green-500 to-emerald-500'
      case 'minor': return 'from-blue-500 to-cyan-500'
      case 'patch': return 'from-purple-500 to-pink-500'
      default: return 'from-gray-500 to-gray-600'
    }
  }
  
  const getTypeLabel = (type) => {
    switch (type) {
      case 'major': return 'Major Release'
      case 'minor': return 'Minor Update'
      case 'patch': return 'Patch'
      default: return 'Update'
    }
  }
  
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-gradient-to-r ${getTypeColor(update.type)} rounded-lg flex items-center justify-center`}>
              <span className="text-white font-bold">{update.version.split('.')[1]}</span>
            </div>
            <div>
              <CardTitle className="text-white text-xl">{update.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`text-xs`}>
                  {getTypeLabel(update.type)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  v{update.version}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-gray-300 text-sm flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(update.date).toLocaleDateString('en-ZA', {
                year: 'numeric',
                month: 'long', 
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
        <CardDescription className="text-gray-300 mt-3">
          {update.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-black/20 rounded-lg">
            <div className="text-center">
              <div className="text-green-400 font-bold text-lg">{update.metrics.newFeatures}</div>
              <div className="text-gray-400 text-xs">New Features</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-bold text-lg">{update.metrics.improvements}</div>
              <div className="text-gray-400 text-xs">Improvements</div>
            </div>
            <div className="text-center">
              <div className="text-red-400 font-bold text-lg">{update.metrics.bugFixes}</div>
              <div className="text-gray-400 text-xs">Bug Fixes</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-bold text-xs">{update.metrics.affectedUsers}</div>
              <div className="text-gray-400 text-xs">Affected Users</div>
            </div>
          </div>
          
          <div className="space-y-3">
            {update.changes.map((change, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <ChangeIcon type={change.type} />
                <div className="flex-1">
                  <div className="text-white font-medium text-sm">{change.title}</div>
                  <div className="text-gray-300 text-sm">{change.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function UpcomingCard({ feature }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'development': return 'text-green-400 border-green-400/30'
      case 'planning': return 'text-blue-400 border-blue-400/30'
      case 'research': return 'text-purple-400 border-purple-400/30'
      default: return 'text-gray-400 border-gray-400/30'
    }
  }
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'development': return <Wrench className="h-4 w-4" />
      case 'planning': return <Clock className="h-4 w-4" />
      case 'research': return <TrendingUp className="h-4 w-4" />
      default: return <Star className="h-4 w-4" />
    }
  }
  
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
            <p className="text-gray-300 text-sm">{feature.description}</p>
          </div>
          <Badge variant="outline" className={`${getStatusColor(feature.status)} flex items-center gap-1`}>
            {getStatusIcon(feature.status)}
            {feature.status}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-cyan-400 text-sm font-medium">
            ETA: {feature.eta}
          </div>
          <Button variant="ghost" size="sm" className="text-gray-400">
            <Bell className="h-4 w-4 mr-1" />
            Notify Me
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Changelog() {
  const [filterType, setFilterType] = useState('all')
  
  const filteredUpdates = UPDATES.filter(update => 
    filterType === 'all' || update.type === filterType
  )
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Platform <span className="text-cyan-400">Updates</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Stay informed about new features, improvements, and fixes. We're constantly evolving to serve you better.
          </p>
        </div>
        
        <Tabs defaultValue="releases" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-white/10">
              <TabsTrigger value="releases" className="data-[state=active]:bg-white/20">
                <CheckCircle className="h-4 w-4 mr-2" />
                Released Updates
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="data-[state=active]:bg-white/20">
                <Clock className="h-4 w-4 mr-2" />
                Coming Soon
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="releases">
            <div className="space-y-8">
              {/* Filter */}
              <div className="flex justify-center">
                <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
                  {['all', 'major', 'minor', 'patch'].map(type => (
                    <Button
                      key={type}
                      variant={filterType === type ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setFilterType(type)}
                      className="capitalize"
                    >
                      {type === 'all' ? 'All Updates' : `${type} Releases`}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Updates */}
              <div className="space-y-8">
                {filteredUpdates.map(update => (
                  <VersionCard key={update.id} update={update} />
                ))}
              </div>
              
              {/* Stats */}
              <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-400/20">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-6 text-center">Platform Growth</h3>
                  <div className="grid md:grid-cols-4 gap-6 text-center">
                    <div>
                      <div className="text-3xl font-bold text-green-400">47</div>
                      <div className="text-gray-300 text-sm">New Features Added</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-blue-400">23</div>
                      <div className="text-gray-300 text-sm">Major Improvements</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-purple-400">89</div>
                      <div className="text-gray-300 text-sm">Bugs Fixed</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-cyan-400">99.9%</div>
                      <div className="text-gray-300 text-sm">Uptime</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="upcoming">
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4">What's Next</h2>
                <p className="text-xl text-gray-300">
                  Exciting features currently in development
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {UPCOMING_FEATURES.map((feature, index) => (
                  <UpcomingCard key={index} feature={feature} />
                ))}
              </div>
              
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-4">Have a Feature Request?</h3>
                  <p className="text-gray-300 mb-6">
                    We'd love to hear your ideas! Your feedback helps shape the future of AI Job Chommie.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button className="bg-gradient-to-r from-cyan-500 to-purple-500">
                      Submit Feature Request
                    </Button>
                    <Button variant="outline">
                      Join Beta Program
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
