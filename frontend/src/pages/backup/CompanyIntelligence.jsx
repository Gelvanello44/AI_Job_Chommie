import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Search,
  Building2,
  TrendingUp,
  Users,
  MapPin,
  Globe,
  Calendar,
  Star,
  Bookmark,
  ExternalLink,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
  BookOpen,
  Award
} from 'lucide-react'
import aiService from '@/services/aiService'

export default function CompanyIntelligence() {
  const [searchTerm, setSearchTerm] = useState('')
  const [companyData, setCompanyData] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [savedBriefs, setSavedBriefs] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  
  const handleSearchCompany = async () => {
    if (!searchTerm.trim()) {
      alert('Please enter a company name')
      return
    }
    
    setIsSearching(true)
    try {
      const intelligence = await aiService.analyzeCompanyIntelligence(searchTerm)
      setCompanyData(intelligence)
    } catch (error) {
      alert('Error fetching company intelligence: ' + error.message)
    } finally {
      setIsSearching(false)
    }
  }
  
  const handleSaveBrief = () => {
    if (companyData) {
      const brief = {
        id: Date.now(),
        companyName: searchTerm,
        data: companyData,
        savedAt: new Date().toISOString()
      }
      setSavedBriefs([brief, ...savedBriefs.slice(0, 9)]) // Keep last 10
      alert('Company brief saved!')
    }
  }
  
  const CompanyOverview = () => (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-2xl flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                {companyData.basicInfo.name}
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-gray-300">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {companyData.basicInfo.headquarters}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {companyData.basicInfo.size}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Founded {companyData.basicInfo.founded}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveBrief}>
                <Bookmark className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-white font-semibold mb-3">Industry & Business</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Industry:</span>
                  <Badge variant="secondary">{companyData.basicInfo.industry}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Website:</span>
                  <a 
                    href={companyData.basicInfo.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline text-sm"
                  >
                    {companyData.basicInfo.website.replace('https://', '')}
                  </a>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-3">Culture & Rating</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Employee Rating:</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="text-white font-medium">{companyData.culture.rating}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Work Style:</span>
                  <Badge variant="outline">{companyData.culture.workStyle}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="h-5 w-5" />
              Company Values
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {companyData.culture.values.map((value, index) => (
                <Badge key={index} variant="default" className="bg-blue-600">
                  {value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="h-5 w-5" />
              Benefits & Perks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companyData.culture.benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 text-gray-300">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  {benefit}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
  
  const RecentNews = () => (
    <div className="space-y-4">
      {companyData.recentNews.map((news, index) => (
        <Card key={index} className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">{news.title}</h3>
                <p className="text-gray-300 text-sm mb-2">{news.summary}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(news.date).toLocaleDateString('en-ZA')}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {news.source}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
  
  const HiringTrends = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400 mb-1">
              {companyData.hiringTrends.averageHiringTime}
            </div>
            <div className="text-sm text-gray-300">Average Hiring Time</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {companyData.hiringTrends.responseRate}
            </div>
            <div className="text-sm text-gray-300">Response Rate</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              {companyData.hiringTrends.popularRoles.length}
            </div>
            <div className="text-sm text-gray-300">Popular Roles</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Common Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companyData.hiringTrends.commonRequirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2 text-gray-300">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                  {req}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Popular Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {companyData.hiringTrends.popularRoles.map((role, index) => (
                <Badge key={index} variant="outline" className="text-cyan-400 border-cyan-400">
                  {role}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
  
  const ApplicationInsights = () => (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI-Powered Application Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-400" />
              Best Time to Apply
            </h4>
            <p className="text-gray-300 text-sm">{companyData.insights.bestTimeToApply}</p>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-400" />
              Keyword Strategy
            </h4>
            <p className="text-gray-300 text-sm">{companyData.insights.keywordsTips}</p>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-400" />
              Culture Match Tips
            </h4>
            <p className="text-gray-300 text-sm">{companyData.insights.cultureMatchTips}</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Application Strategy Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2" />
              <div>
                <div className="text-green-400 font-medium text-sm">High Priority</div>
                <div className="text-gray-300 text-sm">
                  Emphasize alignment with company values: {companyData.culture.values.join(', ')}
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2" />
              <div>
                <div className="text-blue-400 font-medium text-sm">Medium Priority</div>
                <div className="text-gray-300 text-sm">
                  Highlight experience in {companyData.basicInfo.industry} industry
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2" />
              <div>
                <div className="text-yellow-400 font-medium text-sm">Consider</div>
                <div className="text-gray-300 text-sm">
                  Research recent news and mention relevant company initiatives
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
  
  const SavedBriefs = () => (
    <div className="space-y-4">
      {savedBriefs.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center">
            <Bookmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">No Saved Briefs</h3>
            <p className="text-gray-300 text-sm">
              Search for companies and save their intelligence briefs for quick access
            </p>
          </CardContent>
        </Card>
      ) : (
        savedBriefs.map((brief, index) => (
          <Card key={brief.id} className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">{brief.companyName}</h3>
                  <div className="flex items-center gap-4 mt-1 text-gray-400 text-sm">
                    <span>{brief.data.basicInfo.industry}</span>
                    <span>{brief.data.basicInfo.size}</span>
                    <span>Saved {new Date(brief.savedAt).toLocaleDateString('en-ZA')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{brief.data.culture.rating} </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm(brief.companyName)
                      setCompanyData(brief.data)
                      setActiveTab('overview')
                    }}
                  >
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Company Intelligence</h1>
          <p className="text-xl text-gray-300">
            Deep research and insights to optimize your job applications
          </p>
        </div>
        
        {/* Search Bar */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter company name (e.g. Google, Microsoft, Amazon)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchCompany()}
                  className="bg-white/10 border-white/20 text-white text-lg h-12"
                />
              </div>
              <Button 
                onClick={handleSearchCompany}
                disabled={isSearching}
                className="h-12 px-8 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                {isSearching ? (
                  <>
                    <Search className="h-5 w-5 mr-2 animate-spin" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Research Company
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {companyData ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex justify-center">
              <TabsList className="bg-white/10">
                <TabsTrigger value="overview" className="data-[state=active]:bg-white/20">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="news" className="data-[state=active]:bg-white/20">
                  Recent News
                </TabsTrigger>
                <TabsTrigger value="hiring" className="data-[state=active]:bg-white/20">
                  Hiring Trends
                </TabsTrigger>
                <TabsTrigger value="insights" className="data-[state=active]:bg-white/20">
                  Application Tips
                </TabsTrigger>
                <TabsTrigger value="saved" className="data-[state=active]:bg-white/20">
                  Saved Briefs
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="overview">
              <CompanyOverview />
            </TabsContent>
            
            <TabsContent value="news">
              <RecentNews />
            </TabsContent>
            
            <TabsContent value="hiring">
              <HiringTrends />
            </TabsContent>
            
            <TabsContent value="insights">
              <ApplicationInsights />
            </TabsContent>
            
            <TabsContent value="saved">
              <SavedBriefs />
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-12 text-center">
              <Search className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-white font-semibold text-xl mb-4">
                Discover Company Intelligence
              </h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Get deep insights into companies before you apply. Our AI analyzes company culture, 
                hiring trends, recent news, and provides personalized application strategies.
              </p>
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                  <div className="text-white font-medium">Hiring Trends</div>
                  <div className="text-gray-400 text-sm">Response rates, timelines, requirements</div>
                </div>
                <div className="text-center">
                  <Lightbulb className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                  <div className="text-white font-medium">Application Tips</div>
                  <div className="text-gray-400 text-sm">AI-powered optimization strategies</div>
                </div>
                <div className="text-center">
                  <BookOpen className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <div className="text-white font-medium">Company Intel</div>
                  <div className="text-gray-400 text-sm">Culture, values, recent news</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
