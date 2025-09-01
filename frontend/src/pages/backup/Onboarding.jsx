import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { 
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  User,
  Briefcase,
  MapPin,
  DollarSign,
  Bell,
  Zap,
  Target,
  Star,
  Trophy,
  Rocket,
  Heart,
  Sparkles,
  ArrowRight,
  Play,
  Clock,
  Award,
  TrendingUp
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to AI Job Chommie!',
    description: 'Your AI-powered career transformation starts here',
    component: 'WelcomeStep'
  },
  {
    id: 'profile',
    title: 'Tell us about yourself',
    description: 'Build your professional profile',
    component: 'ProfileStep'
  },
  {
    id: 'skills',
    title: 'What are your superpowers?',
    description: 'Identify your key skills and strengths',
    component: 'SkillsStep'
  },
  {
    id: 'preferences',
    title: 'What\'s your dream job?',
    description: 'Set your job search preferences',
    component: 'PreferencesStep'
  },
  {
    id: 'notifications',
    title: 'Stay in the loop',
    description: 'Configure your notification preferences',
    component: 'NotificationsStep'
  },
  {
    id: 'complete',
    title: 'You\'re all set!',
    description: 'Let\'s find your perfect opportunity',
    component: 'CompleteStep'
  }
]

function WelcomeStep({ onNext, userData, setUserData }) {
  return (
    <div className="text-center space-y-8">
      <div className="space-y-4">
        <div className="w-24 h-24 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center mx-auto">
          <Rocket className="h-12 w-12 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">
          Welcome to the Future of Job Searching!
        </h2>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          You're about to experience job searching like never before. Our AI will learn about you, 
          understand your goals, and connect you with opportunities that truly match your potential.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6 my-8">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center">
            <Zap className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">AI-Powered Matching</h3>
            <p className="text-gray-300 text-sm">
              Our AI analyzes thousands of factors to find your perfect job matches
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center">
            <Target className="h-8 w-8 text-green-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Automated Applications</h3>
            <p className="text-gray-300 text-sm">
              Apply to multiple jobs with personalized materials, all automated
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center">
            <TrendingUp className="h-8 w-8 text-purple-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Success Analytics</h3>
            <p className="text-gray-300 text-sm">
              Track your progress and optimize your success rate with AI insights
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 p-6 rounded-xl border border-cyan-400/20">
        <div className="flex items-center justify-center gap-4 text-cyan-400 mb-4">
          <Trophy className="h-6 w-6" />
          <span className="font-semibold">Quick Stats</span>
          <Trophy className="h-6 w-6" />
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">87%</div>
            <div className="text-gray-300 text-sm">Success Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">23</div>
            <div className="text-gray-300 text-sm">Days to Hire</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">34%</div>
            <div className="text-gray-300 text-sm">Salary Boost</div>
          </div>
        </div>
      </div>
      
      <div className="pt-4">
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
          onClick={onNext}
        >
          Let's Get Started <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function ProfileStep({ onNext, onBack, userData, setUserData }) {
  const [profile, setProfile] = useState({
    fullName: userData.fullName || '',
    email: userData.email || '',
    phone: userData.phone || '',
    location: userData.location || '',
    headline: userData.headline || '',
    summary: userData.summary || '',
    experience: userData.experience || 'entry'
  })
  
  const handleNext = () => {
    setUserData(prev => ({ ...prev, ...profile }))
    onNext()
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <User className="h-12 w-12 text-cyan-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Build Your Professional Profile</h2>
        <p className="text-gray-300">
          Help us understand who you are so we can find the perfect opportunities for you
        </p>
      </div>
      
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Full Name *
              </label>
              <Input
                value={profile.fullName}
                onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Email *
              </label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Phone Number
              </label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+27 123 456 7890"
              />
            </div>
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Location *
              </label>
              <select
                value={profile.location}
                onChange={(e) => setProfile(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
              >
                <option value="">Select your location</option>
                <option value="Western Cape">Western Cape</option>
                <option value="Gauteng">Gauteng</option>
                <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                <option value="Eastern Cape">Eastern Cape</option>
                <option value="Free State">Free State</option>
                <option value="Limpopo">Limpopo</option>
                <option value="Mpumalanga">Mpumalanga</option>
                <option value="North West">North West</option>
                <option value="Northern Cape">Northern Cape</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Experience Level *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['entry', 'junior', 'mid', 'senior'].map(level => (
                <label key={level} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="radio"
                    value={level}
                    checked={profile.experience === level}
                    onChange={(e) => setProfile(prev => ({ ...prev, experience: e.target.value }))}
                    className="text-cyan-500"
                  />
                  <span className="text-white text-sm capitalize">{level} Level</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Professional Headline
            </label>
            <Input
              value={profile.headline}
              onChange={(e) => setProfile(prev => ({ ...prev, headline: e.target.value }))}
              placeholder="e.g., Software Developer | React & Node.js Specialist"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Professional Summary
            </label>
            <Textarea
              value={profile.summary}
              onChange={(e) => setProfile(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Brief description of your background, skills, and career goals..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          disabled={!profile.fullName || !profile.email || !profile.location || !profile.experience}
          className="bg-cyan-500 hover:bg-cyan-600"
        >
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function SkillsStep({ onNext, onBack, userData, setUserData }) {
  const [skills, setSkills] = useState(userData.skills || [])
  const [skillInput, setSkillInput] = useState('')
  
  const popularSkills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'Java', 'C#', 'SQL', 'MongoDB',
    'Project Management', 'Agile', 'Scrum', 'Leadership', 'Communication',
    'Data Analysis', 'Excel', 'PowerBI', 'Tableau', 'Adobe Creative Suite',
    'Marketing', 'Social Media', 'SEO', 'Content Writing', 'Sales'
  ]
  
  const addSkill = (skill) => {
    if (skill && !skills.includes(skill)) {
      setSkills(prev => [...prev, skill])
    }
    setSkillInput('')
  }
  
  const removeSkill = (skillToRemove) => {
    setSkills(prev => prev.filter(skill => skill !== skillToRemove))
  }
  
  const handleNext = () => {
    setUserData(prev => ({ ...prev, skills }))
    onNext()
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <Star className="h-12 w-12 text-yellow-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">What Are Your Superpowers?</h2>
        <p className="text-gray-300">
          Add your skills and expertise. Don't worry about being perfect - you can always update these later!
        </p>
      </div>
      
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6 space-y-6">
          <div>
            <label className="text-white text-sm font-medium block mb-3">
              Add Your Skills
            </label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Type a skill and press Enter..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSkill(skillInput)
                  }
                }}
              />
              <Button 
                onClick={() => addSkill(skillInput)}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                Add
              </Button>
            </div>
          </div>
          
          {skills.length > 0 && (
            <div>
              <label className="text-white text-sm font-medium block mb-3">
                Your Skills ({skills.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {skills.map(skill => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="text-cyan-400 border-cyan-400 cursor-pointer hover:bg-cyan-400/10"
                    onClick={() => removeSkill(skill)}
                  >
                    {skill} ×
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <label className="text-white text-sm font-medium block mb-3">
              Popular Skills (Click to Add)
            </label>
            <div className="flex flex-wrap gap-2">
              {popularSkills
                .filter(skill => !skills.includes(skill))
                .map(skill => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => addSkill(skill)}
                  >
                    + {skill}
                  </Badge>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="bg-cyan-500 hover:bg-cyan-600"
        >
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function PreferencesStep({ onNext, onBack, userData, setUserData }) {
  const [preferences, setPreferences] = useState({
    roles: userData.roles || [],
    salaryMin: userData.salaryMin || '',
    salaryMax: userData.salaryMax || '',
    jobTypes: userData.jobTypes || [],
    workStyle: userData.workStyle || 'hybrid',
    autoApply: userData.autoApply ?? true
  })
  
  const [roleInput, setRoleInput] = useState('')
  
  const popularRoles = [
    'Software Developer', 'Project Manager', 'Data Analyst', 'Marketing Specialist',
    'Sales Representative', 'Business Analyst', 'UX Designer', 'DevOps Engineer',
    'Product Manager', 'HR Specialist', 'Financial Analyst', 'Operations Manager'
  ]
  
  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship']
  
  const addRole = (role) => {
    if (role && !preferences.roles.includes(role)) {
      setPreferences(prev => ({
        ...prev,
        roles: [...prev.roles, role]
      }))
    }
    setRoleInput('')
  }
  
  const removeRole = (roleToRemove) => {
    setPreferences(prev => ({
      ...prev,
      roles: prev.roles.filter(role => role !== roleToRemove)
    }))
  }
  
  const toggleJobType = (type) => {
    setPreferences(prev => ({
      ...prev,
      jobTypes: prev.jobTypes.includes(type)
        ? prev.jobTypes.filter(t => t !== type)
        : [...prev.jobTypes, type]
    }))
  }
  
  const handleNext = () => {
    setUserData(prev => ({ ...prev, ...preferences }))
    onNext()
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <Target className="h-12 w-12 text-green-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">What's Your Dream Job?</h2>
        <p className="text-gray-300">
          Tell us what you're looking for so our AI can find the perfect matches
        </p>
      </div>
      
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6 space-y-6">
          <div>
            <label className="text-white text-sm font-medium block mb-3">
              Job Roles You're Interested In
            </label>
            <div className="flex gap-2 mb-3">
              <Input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                placeholder="e.g., Software Developer"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addRole(roleInput)
                  }
                }}
              />
              <Button onClick={() => addRole(roleInput)}>Add</Button>
            </div>
            
            {preferences.roles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {preferences.roles.map(role => (
                  <Badge
                    key={role}
                    variant="outline"
                    className="text-green-400 border-green-400 cursor-pointer"
                    onClick={() => removeRole(role)}
                  >
                    {role} ×
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex flex-wrap gap-2">
              {popularRoles
                .filter(role => !preferences.roles.includes(role))
                .map(role => (
                  <Badge
                    key={role}
                    variant="outline"
                    className="cursor-pointer hover:bg-white/10"
                    onClick={() => addRole(role)}
                  >
                    + {role}
                  </Badge>
                ))}
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Minimum Salary (ZAR)
              </label>
              <Input
                type="number"
                value={preferences.salaryMin}
                onChange={(e) => setPreferences(prev => ({ ...prev, salaryMin: e.target.value }))}
                placeholder="250000"
              />
            </div>
            <div>
              <label className="text-white text-sm font-medium block mb-2">
                Maximum Salary (ZAR)
              </label>
              <Input
                type="number"
                value={preferences.salaryMax}
                onChange={(e) => setPreferences(prev => ({ ...prev, salaryMax: e.target.value }))}
                placeholder="500000"
              />
            </div>
          </div>
          
          <div>
            <label className="text-white text-sm font-medium block mb-3">
              Job Types
            </label>
            <div className="flex flex-wrap gap-2">
              {jobTypes.map(type => (
                <label
                  key={type}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    preferences.jobTypes.includes(type)
                      ? 'bg-blue-500/20 border-blue-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={preferences.jobTypes.includes(type)}
                    onChange={() => toggleJobType(type)}
                    className="text-cyan-500"
                  />
                  <span className="text-white text-sm">{type}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-white text-sm font-medium block mb-3">
              Work Style Preference
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['remote', 'hybrid', 'office'].map(style => (
                <label
                  key={style}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    preferences.workStyle === style
                      ? 'bg-purple-500/20 border-purple-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    value={style}
                    checked={preferences.workStyle === style}
                    onChange={(e) => setPreferences(prev => ({ ...prev, workStyle: e.target.value }))}
                    className="text-cyan-500"
                  />
                  <span className="text-white text-sm capitalize">{style}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-400/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Enable Auto-Apply</h4>
                <p className="text-gray-300 text-sm">
                  Let our AI automatically apply to matching jobs for you
                </p>
              </div>
              <Switch
                checked={preferences.autoApply}
                onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, autoApply: checked }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="bg-cyan-500 hover:bg-cyan-600"
        >
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function NotificationsStep({ onNext, onBack, userData, setUserData }) {
  const [notifications, setNotifications] = useState({
    jobAlerts: userData.jobAlerts ?? true,
    applicationUpdates: userData.applicationUpdates ?? true,
    weeklyNewsletter: userData.weeklyNewsletter ?? true,
    marketInsights: userData.marketInsights ?? false,
    emailFrequency: userData.emailFrequency || 'daily'
  })
  
  const handleNext = () => {
    setUserData(prev => ({ ...prev, ...notifications }))
    onNext()
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <Bell className="h-12 w-12 text-purple-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Stay in the Loop</h2>
        <p className="text-gray-300">
          Choose how and when you want to hear from us. You can change these anytime.
        </p>
      </div>
      
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <h4 className="text-white font-medium">Job Alerts</h4>
                <p className="text-gray-300 text-sm">Get notified when new matching jobs are posted</p>
              </div>
              <Switch
                checked={notifications.jobAlerts}
                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, jobAlerts: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <h4 className="text-white font-medium">Application Updates</h4>
                <p className="text-gray-300 text-sm">Status updates on your job applications</p>
              </div>
              <Switch
                checked={notifications.applicationUpdates}
                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, applicationUpdates: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <h4 className="text-white font-medium">Weekly Newsletter</h4>
                <p className="text-gray-300 text-sm">Job market insights and career tips</p>
              </div>
              <Switch
                checked={notifications.weeklyNewsletter}
                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, weeklyNewsletter: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <h4 className="text-white font-medium">Market Insights</h4>
                <p className="text-gray-300 text-sm">Salary trends and industry updates</p>
              </div>
              <Switch
                checked={notifications.marketInsights}
                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, marketInsights: checked }))}
              />
            </div>
          </div>
          
          <div>
            <label className="text-white text-sm font-medium block mb-3">
              Email Frequency
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['daily', 'weekly', 'monthly'].map(frequency => (
                <label
                  key={frequency}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    notifications.emailFrequency === frequency
                      ? 'bg-cyan-500/20 border-cyan-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    value={frequency}
                    checked={notifications.emailFrequency === frequency}
                    onChange={(e) => setNotifications(prev => ({ ...prev, emailFrequency: e.target.value }))}
                    className="text-cyan-500"
                  />
                  <span className="text-white text-sm capitalize">{frequency}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="bg-cyan-500 hover:bg-cyan-600"
        >
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function CompleteStep({ userData }) {
  const navigate = useNavigate()
  
  const handleGetStarted = () => {
    // In a real app, you'd save the userData to your backend here
    console.log('Onboarding complete:', userData)
    navigate('/dashboard')
  }
  
  return (
    <div className="text-center space-y-8">
      <div className="space-y-4">
        <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-12 w-12 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">You're All Set, {userData.fullName?.split(' ')[0] || 'there'}!</h2>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Your AI-powered job search journey begins now. We're already analyzing opportunities that match your profile.
        </p>
      </div>
      
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 p-8 rounded-xl border border-cyan-400/20">
        <h3 className="text-xl font-bold text-white mb-6">What happens next?</h3>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div>
              <h4 className="text-white font-medium mb-1">AI Analysis</h4>
              <p className="text-gray-300 text-sm">
                Our AI is analyzing your profile and finding matching opportunities
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <div>
              <h4 className="text-white font-medium mb-1">Job Matches</h4>
              <p className="text-gray-300 text-sm">
                We'll present you with personalized job recommendations
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">3</span>
            </div>
            <div>
              <h4 className="text-white font-medium mb-1">Auto Apply</h4>
              <p className="text-gray-300 text-sm">
                {userData.autoApply 
                  ? "We'll automatically apply to matching jobs for you"
                  : "Review and apply to jobs that interest you"
                }
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          onClick={handleGetStarted}
        >
          <Play className="h-5 w-5 mr-2" />
          Go to Dashboard
        </Button>
        <p className="text-gray-400 text-sm">
          You can always update your preferences in Settings
        </p>
      </div>
    </div>
  )
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0)
  const [userData, setUserData] = useState({})
  
  const step = ONBOARDING_STEPS[currentStep]
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100
  
  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  const renderStep = () => {
    const props = {
      onNext: nextStep,
      onBack: prevStep,
      userData,
      setUserData
    }
    
    switch (step.component) {
      case 'WelcomeStep':
        return <WelcomeStep {...props} />
      case 'ProfileStep':
        return <ProfileStep {...props} />
      case 'SkillsStep':
        return <SkillsStep {...props} />
      case 'PreferencesStep':
        return <PreferencesStep {...props} />
      case 'NotificationsStep':
        return <NotificationsStep {...props} />
      case 'CompleteStep':
        return <CompleteStep {...props} />
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-400">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </div>
            <div className="text-sm text-gray-400">
              {Math.round(progress)}% complete
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Step Content */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {step.title}
            </h1>
            <p className="text-gray-300">{step.description}</p>
          </div>
          
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
