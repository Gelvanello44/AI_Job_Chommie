import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Settings,
  Clock,
  Mail,
  Bell,
  CheckCircle,
  AlertTriangle,
  Wrench,
  Calendar,
  Timer,
  Zap,
  Shield,
  Database,
  Server,
  Smartphone,
  RefreshCw,
  ExternalLink,
  ArrowRight
} from 'lucide-react'

const MAINTENANCE_TYPES = {
  SCHEDULED: 'scheduled',
  EMERGENCY: 'emergency',
  UPDATE: 'update',
  SECURITY: 'security'
}

const MAINTENANCE_STATUS = {
  UPCOMING: 'upcoming',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DELAYED: 'delayed'
}

const MAINTENANCE_INFO = {
  type: MAINTENANCE_TYPES.UPDATE,
  status: MAINTENANCE_STATUS.IN_PROGRESS,
  title: 'Platform Upgrade & Performance Improvements',
  description: 'We\'re upgrading our servers and deploying new features to improve your experience.',
  startTime: '2025-01-26 02:00 SAST',
  estimatedEndTime: '2025-01-26 06:00 SAST',
  actualStartTime: '2025-01-26 02:00 SAST',
  currentTime: new Date().toISOString(),
  progress: 65,
  affectedServices: [
    { name: 'Job Search', status: 'offline', icon: <Database className="h-4 w-4" /> },
    { name: 'CV Builder', status: 'limited', icon: <Server className="h-4 w-4" /> },
    { name: 'Applications', status: 'offline', icon: <Wrench className="h-4 w-4" /> },
    { name: 'Mobile App', status: 'limited', icon: <Smartphone className="h-4 w-4" /> },
    { name: 'User Authentication', status: 'online', icon: <Shield className="h-4 w-4" /> }
  ],
  updates: [
    {
      time: '02:00 SAST',
      message: 'Maintenance window started - Beginning server upgrades',
      type: 'info'
    },
    {
      time: '02:30 SAST', 
      message: 'Database optimization in progress - Job search temporarily unavailable',
      type: 'warning'
    },
    {
      time: '03:15 SAST',
      message: 'New AI matching algorithms deployed successfully',
      type: 'success'
    },
    {
      time: '04:00 SAST',
      message: 'CV Builder performance improvements completed',
      type: 'success'
    },
    {
      time: '04:45 SAST',
      message: 'Currently upgrading application tracking system - 65% complete',
      type: 'info'
    }
  ],
  improvements: [
    '40% faster job search results',
    'Enhanced AI matching accuracy',
    'Improved mobile app performance',
    'New CV templates and optimization tools',
    'Better security and data protection'
  ]
}

function ServiceStatus({ service }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'text-green-400 border-green-400/30'
      case 'limited': return 'text-yellow-400 border-yellow-400/30'
      case 'offline': return 'text-red-400 border-red-400/30'
      default: return 'text-gray-400 border-gray-400/30'
    }
  }
  
  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'Operational'
      case 'limited': return 'Limited'
      case 'offline': return 'Offline'
      default: return 'Unknown'
    }
  }
  
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-cyan-400">{service.icon}</div>
        <span className="text-white font-medium">{service.name}</span>
      </div>
      <Badge variant="outline" className={`${getStatusColor(service.status)} text-xs`}>
        {getStatusText(service.status)}
      </Badge>
    </div>
  )
}

function UpdateItem({ update }) {
  const getTypeColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-400'
      case 'warning': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-gray-300'
    }
  }
  
  const getTypeIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'error': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }
  
  return (
    <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
      <div className={`${getTypeColor(update.type)} mt-0.5`}>
        {getTypeIcon(update.type)}
      </div>
      <div className="flex-1">
        <div className="text-gray-400 text-xs mb-1">{update.time}</div>
        <div className="text-white text-sm">{update.message}</div>
      </div>
    </div>
  )
}

export default function Maintenance() {
  const [email, setEmail] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    
    return () => clearInterval(interval)
  }, [])
  
  const handleNotifyMe = async (e) => {
    e.preventDefault()
    if (!email) return
    
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setIsSubscribed(true)
    } catch (error) {
      setError('Failed to subscribe to updates. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const getStatusColor = (status) => {
    switch (status) {
      case MAINTENANCE_STATUS.UPCOMING: return 'from-blue-500 to-cyan-500'
      case MAINTENANCE_STATUS.IN_PROGRESS: return 'from-yellow-500 to-orange-500'
      case MAINTENANCE_STATUS.COMPLETED: return 'from-green-500 to-emerald-500'
      case MAINTENANCE_STATUS.DELAYED: return 'from-red-500 to-pink-500'
      default: return 'from-gray-500 to-gray-600'
    }
  }
  
  const getStatusText = (status) => {
    switch (status) {
      case MAINTENANCE_STATUS.UPCOMING: return 'Scheduled'
      case MAINTENANCE_STATUS.IN_PROGRESS: return 'In Progress'
      case MAINTENANCE_STATUS.COMPLETED: return 'Completed'
      case MAINTENANCE_STATUS.DELAYED: return 'Delayed'
      default: return 'Unknown'
    }
  }
  
  const getTypeIcon = (type) => {
    switch (type) {
      case MAINTENANCE_TYPES.SCHEDULED: return <Calendar className="h-8 w-8" />
      case MAINTENANCE_TYPES.EMERGENCY: return <AlertTriangle className="h-8 w-8" />
      case MAINTENANCE_TYPES.UPDATE: return <Zap className="h-8 w-8" />
      case MAINTENANCE_TYPES.SECURITY: return <Shield className="h-8 w-8" />
      default: return <Settings className="h-8 w-8" />
    }
  }
  
  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleString('en-ZA', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }
  
  const getEstimatedTimeRemaining = () => {
    const now = new Date()
    const endTime = new Date(MAINTENANCE_INFO.estimatedEndTime)
    const diffMs = endTime - now
    
    if (diffMs <= 0) return 'Completing final steps...'
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `~${hours}h ${minutes}m remaining`
    } else {
      return `~${minutes}m remaining`
    }
  }
  
  if (isSubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">You're Subscribed!</CardTitle>
            <CardDescription className="text-gray-300">
              We'll notify you when maintenance is complete
            </CardDescription>
          </CardHeader>
          
          <CardContent className="text-center space-y-6">
            <div className="space-y-2">
              <p className="text-gray-300">Updates will be sent to:</p>
              <p className="text-cyan-400 font-medium">{email}</p>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-cyan-400/20">
              <p className="text-gray-300 text-sm">
                You'll receive a notification as soon as AI Job Chommie is back online with all the new improvements!
              </p>
            </div>
            
            <Button 
              onClick={() => setIsSubscribed(false)}
              variant="outline"
              className="w-full text-cyan-400 border-cyan-400/30"
            >
              View Maintenance Status
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Main Status Card */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardHeader className="text-center">
            <div className={`w-20 h-20 bg-gradient-to-r ${getStatusColor(MAINTENANCE_INFO.status)} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {getTypeIcon(MAINTENANCE_INFO.type)}
            </div>
            
            <div className="space-y-2 mb-4">
              <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
                {getStatusText(MAINTENANCE_INFO.status)}
              </Badge>
            </div>
            
            <CardTitle className="text-3xl text-white mb-2">
              {MAINTENANCE_INFO.title}
            </CardTitle>
            <CardDescription className="text-xl text-gray-300 max-w-2xl mx-auto">
              {MAINTENANCE_INFO.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8">
            {/* Progress */}
            {MAINTENANCE_INFO.status === MAINTENANCE_STATUS.IN_PROGRESS && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Overall Progress</span>
                  <span>{MAINTENANCE_INFO.progress}%</span>
                </div>
                <Progress 
                  value={MAINTENANCE_INFO.progress} 
                  className="h-3 bg-gray-700"
                />
                <div className="text-center">
                  <div className="text-cyan-400 font-medium">{getEstimatedTimeRemaining()}</div>
                  <div className="text-gray-400 text-sm">
                    Expected completion: {formatTime(MAINTENANCE_INFO.estimatedEndTime)}
                  </div>
                </div>
              </div>
            )}
            
            {/* Timeline */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  Maintenance Window
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Started:</span>
                    <span className="text-white">{formatTime(MAINTENANCE_INFO.startTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expected End:</span>
                    <span className="text-white">{formatTime(MAINTENANCE_INFO.estimatedEndTime)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-cyan-400" />
                  Expected Improvements
                </h3>
                <ul className="space-y-1 text-sm">
                  {MAINTENANCE_INFO.improvements.slice(0, 3).map((improvement, index) => (
                    <li key={index} className="text-gray-300 flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Service Status */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-cyan-400" />
                Service Status
              </CardTitle>
              <CardDescription className="text-gray-300">
                Current availability of platform features
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {MAINTENANCE_INFO.affectedServices.map((service, index) => (
                <ServiceStatus key={index} service={service} />
              ))}
              
              <div className="mt-6 p-3 bg-blue-500/10 rounded-lg border border-blue-400/20">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-400 font-medium text-sm">Status Updates</span>
                </div>
                <p className="text-gray-300 text-sm">
                  Service status is updated every 15 minutes during maintenance
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Live Updates */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-cyan-400" />
                    Live Updates
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Real-time maintenance progress
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-green-400 border-green-400/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                  Live
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3 max-h-64 overflow-y-auto">
              {MAINTENANCE_INFO.updates.map((update, index) => (
                <UpdateItem key={index} update={update} />
              ))}
            </CardContent>
          </Card>
        </div>
        
        {/* Notification Signup */}
        <Card className="mt-6 bg-white/5 border-white/10">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white mb-2">
              Get Notified When We're Back
            </CardTitle>
            <CardDescription className="text-gray-300">
              We'll send you an email as soon as maintenance is complete
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleNotifyMe} className="max-w-md mx-auto space-y-4">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400 h-12"
                required
              />
              
              {error && (
                <Alert className="bg-red-500/10 border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 h-12"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
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
            
            <div className="mt-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                  onClick={() => window.open('https://status.aijobchommie.co.za', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Status Page
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                  onClick={() => window.open('https://twitter.com/aijobchommie', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Twitter Updates
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Alternative Resources */}
        <Card className="mt-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-400/20">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-white mb-4 text-center">
              Meanwhile, check out these resources:
            </h3>
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              <div>
                <h4 className="text-cyan-400 font-medium mb-2">Job Search Tips</h4>
                <p className="text-gray-300 text-sm">Browse our career advice while you wait</p>
              </div>
              <div>
                <h4 className="text-cyan-400 font-medium mb-2">CV Templates</h4>
                <p className="text-gray-300 text-sm">Download professional CV templates</p>
              </div>
              <div>
                <h4 className="text-cyan-400 font-medium mb-2">Market Insights</h4>
                <p className="text-gray-300 text-sm">View SA job market trends and salaries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
