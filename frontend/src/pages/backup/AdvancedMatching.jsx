import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Zap,
  Search,
  Filter,
  Star,
  MapPin,
  DollarSign,
  Clock,
  Users,
  Award,
  TrendingUp,
  CheckCircle,
  XCircle,
  Brain,
  Target,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  BookmarkPlus,
  Settings,
  RefreshCw,
  AlertCircle,
  Info,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Bookmark
} from 'lucide-react'
import aiService from '@/services/aiService'

export default function AdvancedMatching() {
  const [matches, setMatches] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [userProfile, setUserProfile] = useState({
    skills: ['React', 'JavaScript', 'Node.js', 'Python', 'AWS'],
    experience: '3+ years',
    location: 'Cape Town, South Africa',
    salaryRange: 'R400k - R600k',
    jobTypes: ['Full-time', 'Remote'],
    preferences: {
      remote: true,
      companySizePreference: 'startup',
      industryPreferences: ['Technology', 'SaaS'],
      cultureValues: ['Innovation', 'Work-life balance']
    }
  })
  const [filters, setFilters] = useState({
    minMatchScore: 70,
    onlyRemote: false,
    salaryRange: 'any',
    experienceLevel: 'any'
  })
  
  useEffect(() => {
    generateMatches()
  }, [])
  
  const generateMatches = async () => {
    setIsLoading(true)
    try {
      const matchingData = await aiService.performAdvancedMatching({
        userProfile,
        preferences: userProfile.preferences,
        filters,
        includeExplanations: true
      })
      
      setMatches(matchingData.matches.sort((a, b) => b.overallScore - a.overallScore))
    } catch (error) {
      console.error('Error generating matches:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const getScoreColor = (score) => {
    if (score >= 85) return 'text-green-400'
    if (score >= 70) return 'text-blue-400'
    if (score >= 55) return 'text-yellow-400'
    return 'text-red-400'
  }
  
  const getScoreBg = (score) => {
    if (score >= 85) return 'bg-green-500/10 border-green-500/20'
    if (score >= 70) return 'bg-blue-500/10 border-blue-500/20'
    if (score >= 55) return 'bg-yellow-500/10 border-yellow-500/20'
    return 'bg-red-500/10 border-red-500/20'
  }
  
  const MatchOverview = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400 mb-1">
              {matches.length}
            </div>
            <div className="text-sm text-gray-300">Total Matches</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {matches.filter(m => m.overallScore >= 85).length}
            </div>
            <div className="text-sm text-gray-300">Excellent Matches</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {matches.filter(m => m.overallScore >= 70).length}
            </div>
            <div className="text-sm text-gray-300">Good Matches</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              {Math.round(matches.reduce((sum, m) => sum + m.overallScore, 0) / matches.length) || 0}%
            </div>
            <div className="text-sm text-gray-300">Avg Match Score</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold text-lg">AI-Matched Opportunities</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generateMatches} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Matches
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>
      
      <div className="space-y-4">
        {matches.map((match) => (
          <Card 
            key={match.id} 
            className={`border cursor-pointer hover:bg-white/5 transition-colors ${getScoreBg(match.overallScore)}`}
            onClick={() => setSelectedMatch(match)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-semibold text-lg">{match.jobTitle}</h3>
                    <Badge variant="secondary">{match.company}</Badge>
                    {match.isRemote && <Badge className="bg-green-500/20 text-green-400">Remote</Badge>}
                    {match.isUrgent && <Badge className="bg-red-500/20 text-red-400">Urgent</Badge>}
                  </div>
                  
                  <div className="flex items-center gap-6 mb-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-300">
                      <MapPin className="h-4 w-4" />
                      {match.location}
                    </div>
                    <div className="flex items-center gap-1 text-gray-300">
                      <DollarSign className="h-4 w-4" />
                      {match.salary}
                    </div>
                    <div className="flex items-center gap-1 text-gray-300">
                      <Clock className="h-4 w-4" />
                      {match.postedDate}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">Skills Match:</span>
                        <div className={`font-bold ${getScoreColor(match.skillsMatch)}`}>
                          {match.skillsMatch}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">Experience:</span>
                        <div className={`font-bold ${getScoreColor(match.experienceMatch)}`}>
                          {match.experienceMatch}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">Culture:</span>
                        <div className={`font-bold ${getScoreColor(match.cultureMatch)}`}>
                          {match.cultureMatch}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Progress value={match.overallScore} className="flex-1 h-2" />
                      <div className={`font-bold text-lg ${getScoreColor(match.overallScore)}`}>
                        {match.overallScore}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {match.matchingSkills.slice(0, 5).map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-green-400 border-green-500/30">
                        {skill}
                      </Badge>
                    ))}
                    {match.matchingSkills.length > 5 && (
                      <Badge variant="outline" className="text-gray-400">
                        +{match.matchingSkills.length - 5} more
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-gray-300 text-sm line-clamp-2 mb-3">
                    {match.description}
                  </p>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      {match.aiExplanation?.topReason && (
                        <>
                          <Zap className="h-4 w-4 text-cyan-400" />
                          <span className="text-cyan-400 font-medium">AI Insight: </span>
                          <span className="text-gray-300">{match.aiExplanation.topReason}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2 ml-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Bookmark className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-500">
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
  
  const MatchDetails = () => {
    if (!selectedMatch) {
      return (
        <div className="text-center py-12">
          <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">Select a Match</h3>
          <p className="text-gray-300">Choose a job match to see detailed AI analysis</p>
        </div>
      )
    }
    
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-xl">{selectedMatch.jobTitle}</CardTitle>
                <CardDescription className="text-gray-300">
                  {selectedMatch.company} • {selectedMatch.location}
                </CardDescription>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(selectedMatch.overallScore)}`}>
                  {selectedMatch.overallScore}%
                </div>
                <div className="text-gray-400 text-sm">Match Score</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Match Analysis
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Skills Alignment</span>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedMatch.skillsMatch} className="w-20 h-2" />
                      <span className={`font-bold ${getScoreColor(selectedMatch.skillsMatch)}`}>
                        {selectedMatch.skillsMatch}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Experience Match</span>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedMatch.experienceMatch} className="w-20 h-2" />
                      <span className={`font-bold ${getScoreColor(selectedMatch.experienceMatch)}`}>
                        {selectedMatch.experienceMatch}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Culture Fit</span>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedMatch.cultureMatch} className="w-20 h-2" />
                      <span className={`font-bold ${getScoreColor(selectedMatch.cultureMatch)}`}>
                        {selectedMatch.cultureMatch}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Salary Alignment</span>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedMatch.salaryMatch} className="w-20 h-2" />
                      <span className={`font-bold ${getScoreColor(selectedMatch.salaryMatch)}`}>
                        {selectedMatch.salaryMatch}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Skills Analysis
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Matching Skills ({selectedMatch.matchingSkills.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedMatch.matchingSkills.map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-green-400 border-green-500/30 text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {selectedMatch.missingSkills?.length > 0 && (
                    <div>
                      <div className="text-yellow-400 text-sm font-medium mb-2 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Skills to Develop ({selectedMatch.missingSkills.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedMatch.missingSkills.map((skill, index) => (
                          <Badge key={index} variant="outline" className="text-yellow-400 border-yellow-500/30 text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {selectedMatch.aiExplanation && (
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                AI Explanation & Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-blue-400 font-medium text-sm mb-2">Why This is a Good Match</div>
                  <p className="text-gray-300 text-sm">{selectedMatch.aiExplanation.explanation}</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-green-400 font-medium text-sm mb-2 flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      Strengths
                    </div>
                    <ul className="space-y-1">
                      {selectedMatch.aiExplanation.strengths.map((strength, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <div className="text-yellow-400 font-medium text-sm mb-2 flex items-center gap-1">
                      <Info className="h-4 w-4" />
                      Considerations
                    </div>
                    <ul className="space-y-1">
                      {selectedMatch.aiExplanation.considerations.map((consideration, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          {consideration}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <div className="text-cyan-400 font-medium text-sm mb-2">AI Recommendation</div>
                  <p className="text-gray-300 text-sm">{selectedMatch.aiExplanation.recommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => setSelectedMatch(null)}>
            Back to Matches
          </Button>
          <Button variant="outline">
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Save Match
          </Button>
          <Button className="bg-gradient-to-r from-green-500 to-green-600">
            <ExternalLink className="h-4 w-4 mr-2" />
            Apply Now
          </Button>
        </div>
      </div>
    )
  }
  
  const ProfileSettings = () => (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Matching Preferences
          </CardTitle>
          <CardDescription className="text-gray-300">
            Customize your job matching criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label className="text-white font-medium mb-3 block">Skills & Experience</Label>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm">Primary Skills</Label>
                  <Textarea 
                    value={userProfile.skills.join(', ')}
                    onChange={(e) => setUserProfile(prev => ({
                      ...prev,
                      skills: e.target.value.split(', ').filter(s => s.trim())
                    }))}
                    placeholder="React, JavaScript, Node.js..."
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300 text-sm">Experience Level</Label>
                  <Input 
                    value={userProfile.experience}
                    onChange={(e) => setUserProfile(prev => ({ ...prev, experience: e.target.value }))}
                    placeholder="3+ years"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <Label className="text-white font-medium mb-3 block">Location & Salary</Label>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm">Preferred Location</Label>
                  <Input 
                    value={userProfile.location}
                    onChange={(e) => setUserProfile(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Cape Town, South Africa"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300 text-sm">Salary Range</Label>
                  <Input 
                    value={userProfile.salaryRange}
                    onChange={(e) => setUserProfile(prev => ({ ...prev, salaryRange: e.target.value }))}
                    placeholder="R400k - R600k"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <Label className="text-white font-medium mb-3 block">Work Preferences</Label>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-gray-300">Remote Work</span>
                <Switch 
                  checked={userProfile.preferences.remote}
                  onCheckedChange={(checked) => setUserProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, remote: checked }
                  }))}
                />
              </div>
              
              <div className="p-3 bg-white/5 rounded-lg">
                <span className="text-gray-300 text-sm block mb-1">Company Size</span>
                <select 
                  value={userProfile.preferences.companySizePreference}
                  onChange={(e) => setUserProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, companySizePreference: e.target.value }
                  }))}
                  className="w-full bg-transparent text-white text-sm"
                >
                  <option value="startup">Startup (1-50)</option>
                  <option value="medium">Medium (51-500)</option>
                  <option value="large">Large (500+)</option>
                  <option value="any">Any Size</option>
                </select>
              </div>
              
              <div className="p-3 bg-white/5 rounded-lg">
                <span className="text-gray-300 text-sm block mb-1">Industry Focus</span>
                <select 
                  multiple
                  value={userProfile.preferences.industryPreferences}
                  className="w-full bg-transparent text-white text-sm"
                >
                  <option value="technology">Technology</option>
                  <option value="saas">SaaS</option>
                  <option value="fintech">FinTech</option>
                  <option value="ecommerce">E-commerce</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-4">
            <Button variant="outline">Reset to Default</Button>
            <Button onClick={generateMatches} className="bg-gradient-to-r from-cyan-500 to-blue-500">
              Update Matches
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
  
  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Advanced Matching</h1>
            <p className="text-xl text-gray-300">
              AI-powered job matching with detailed explanations
            </p>
          </div>
          
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Brain className="h-16 w-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
              <h3 className="text-white font-semibold mb-2">AI Analyzing Matches</h3>
              <p className="text-gray-300">Finding your perfect job opportunities...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Advanced Matching</h1>
          <p className="text-xl text-gray-300">
            AI-powered job matching with detailed explanations
          </p>
        </div>
        
        <Tabs defaultValue="matches" className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="bg-white/10">
              <TabsTrigger value="matches" className="data-[state=active]:bg-white/20">
                AI Matches
              </TabsTrigger>
              <TabsTrigger value="details" className="data-[state=active]:bg-white/20">
                Match Analysis
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-white/20">
                Profile Settings
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="matches">
            <MatchOverview />
          </TabsContent>
          
          <TabsContent value="details">
            <MatchDetails />
          </TabsContent>
          
          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
