import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  Wand2, 
  CheckCircle, 
  XCircle, 
  Download, 
  Copy, 
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Target,
  Clock
} from 'lucide-react'
import aiService from '@/services/aiService'

export default function AIWriting() {
  const [activeTab, setActiveTab] = useState('cover-letter')
  
  // Cover Letter State
  const [coverLetterData, setCoverLetterData] = useState({
    jobTitle: '',
    companyName: '',
    jobDescription: '',
    tone: 'professional'
  })
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState(null)
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  
  // CV Optimization State
  const [cvData, setCvData] = useState({
    currentCV: '',
    targetRole: '',
    jobDescription: ''
  })
  const [cvOptimization, setCvOptimization] = useState(null)
  const [isOptimizingCV, setIsOptimizingCV] = useState(false)
  const [acceptedSuggestions, setAcceptedSuggestions] = useState(new Set())
  
  const handleGenerateCoverLetter = async () => {
    if (!coverLetterData.jobTitle || !coverLetterData.companyName) {
      alert('Please fill in job title and company name')
      return
    }
    
    setIsGeneratingCover(true)
    try {
      const result = await aiService.generateCoverLetter({
        jobDescription: coverLetterData.jobDescription,
        jobTitle: coverLetterData.jobTitle,
        companyName: coverLetterData.companyName,
        userProfile: {
          name: 'John Doe', // Mock user profile
          skills: ['React', 'JavaScript', 'Node.js'],
          topSkills: ['JavaScript', 'Problem Solving'],
          interests: 'Creating impactful web applications'
        },
        companyInfo: {
          industry: 'Technology',
          values: ['Innovation', 'Collaboration']
        }
      })
      
      setGeneratedCoverLetter(result)
    } catch (error) {
      alert('Error generating cover letter: ' + error.message)
    } finally {
      setIsGeneratingCover(false)
    }
  }
  
  const handleOptimizeCV = async () => {
    if (!cvData.currentCV || !cvData.targetRole) {
      alert('Please provide your current CV and target role')
      return
    }
    
    setIsOptimizingCV(true)
    try {
      const result = await aiService.optimizeCV({
        currentCV: cvData.currentCV,
        jobDescription: cvData.jobDescription,
        targetRole: cvData.targetRole
      })
      
      setCvOptimization(result)
      setAcceptedSuggestions(new Set())
    } catch (error) {
      alert('Error optimizing CV: ' + error.message)
    } finally {
      setIsOptimizingCV(false)
    }
  }
  
  const handleAcceptSuggestion = (suggestionIndex) => {
    const newAccepted = new Set(acceptedSuggestions)
    newAccepted.add(suggestionIndex)
    setAcceptedSuggestions(newAccepted)
  }
  
  const handleRejectSuggestion = (suggestionIndex) => {
    const newAccepted = new Set(acceptedSuggestions)
    newAccepted.delete(suggestionIndex)
    setAcceptedSuggestions(newAccepted)
  }
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }
  
  const CoverLetterGenerator = () => (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Cover Letter Generator
          </CardTitle>
          <CardDescription className="text-gray-300">
            Generate personalized cover letters tailored to specific job applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-medium mb-2 block">Job Title *</label>
              <Input
                placeholder="e.g. Senior React Developer"
                value={coverLetterData.jobTitle}
                onChange={(e) => setCoverLetterData({...coverLetterData, jobTitle: e.target.value})}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <label className="text-white text-sm font-medium mb-2 block">Company Name *</label>
              <Input
                placeholder="e.g. TechCorp SA"
                value={coverLetterData.companyName}
                onChange={(e) => setCoverLetterData({...coverLetterData, companyName: e.target.value})}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Tone</label>
            <Select value={coverLetterData.tone} onValueChange={(value) => setCoverLetterData({...coverLetterData, tone: value})}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Job Description (Optional)</label>
            <Textarea
              placeholder="Paste the job description here to get a more tailored cover letter..."
              value={coverLetterData.jobDescription}
              onChange={(e) => setCoverLetterData({...coverLetterData, jobDescription: e.target.value})}
              className="bg-white/10 border-white/20 text-white min-h-[120px]"
            />
          </div>
          
          <Button 
            onClick={handleGenerateCoverLetter}
            disabled={isGeneratingCover}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
          >
            {isGeneratingCover ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating Cover Letter...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Cover Letter
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {generatedCoverLetter && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Generated Cover Letter</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="default" className="bg-green-600">
                  {generatedCoverLetter.matchScore}% Match
                </Badge>
                <Badge variant="secondary">
                  {generatedCoverLetter.suggestions[0]?.current || 'Professional'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedCoverLetter.content)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white/10 border border-white/20 rounded-lg p-4">
              <pre className="text-white text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {generatedCoverLetter.content}
              </pre>
            </div>
            
            <div className="mt-4">
              <h4 className="text-white font-medium mb-2">Customization Options:</h4>
              <div className="flex flex-wrap gap-2">
                {generatedCoverLetter.suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm">{suggestion.type}:</span>
                    <div className="flex gap-1">
                      {suggestion.alternatives.map((alt, altIndex) => (
                        <Button
                          key={altIndex}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            // Regenerate with different tone/length
                            setCoverLetterData({...coverLetterData, tone: alt})
                          }}
                        >
                          {alt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
  
  const CVOptimizer = () => (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            AI CV Optimizer
          </CardTitle>
          <CardDescription className="text-gray-300">
            Optimize your CV with AI-powered keyword suggestions and ATS compatibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Target Role *</label>
            <Input
              placeholder="e.g. Senior Frontend Developer"
              value={cvData.targetRole}
              onChange={(e) => setCvData({...cvData, targetRole: e.target.value})}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Current CV Content *</label>
            <Textarea
              placeholder="Paste your current CV content here..."
              value={cvData.currentCV}
              onChange={(e) => setCvData({...cvData, currentCV: e.target.value})}
              className="bg-white/10 border-white/20 text-white min-h-[200px]"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Job Description (Optional)</label>
            <Textarea
              placeholder="Paste the job description to get targeted optimization..."
              value={cvData.jobDescription}
              onChange={(e) => setCvData({...cvData, jobDescription: e.target.value})}
              className="bg-white/10 border-white/20 text-white min-h-[120px]"
            />
          </div>
          
          <Button 
            onClick={handleOptimizeCV}
            disabled={isOptimizingCV}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isOptimizingCV ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Optimizing CV...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Optimize CV
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {cvOptimization && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Optimization Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-black/20 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-400">{cvOptimization.overallScore}%</div>
                  <div className="text-sm text-gray-300">Overall Score</div>
                </div>
                <div className="text-center p-4 bg-black/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">{cvOptimization.atsCompatibility}%</div>
                  <div className="text-sm text-gray-300">ATS Compatible</div>
                </div>
                <div className="text-center p-4 bg-black/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">{cvOptimization.suggestions.length}</div>
                  <div className="text-sm text-gray-300">Suggestions</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    Strength Areas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {cvOptimization.strengthAreas.map((strength, index) => (
                      <Badge key={index} variant="default" className="bg-green-600">
                        {strength}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    Improvement Areas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {cvOptimization.improvementAreas.map((improvement, index) => (
                      <Badge key={index} variant="secondary" className="bg-yellow-600">
                        {improvement}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Keyword Suggestions */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                AI Keyword Suggestions
              </CardTitle>
              <CardDescription className="text-gray-300">
                Review and accept/reject AI-powered improvements to your CV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cvOptimization.suggestions.map((suggestion, index) => (
                  <Card key={index} className="bg-black/20 border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={suggestion.importance === 'high' ? 'destructive' : 'secondary'}>
                              {suggestion.importance} importance
                            </Badge>
                            <Badge variant="outline">
                              {suggestion.section}
                            </Badge>
                            <Badge variant="outline">
                              {suggestion.keyword}
                            </Badge>
                          </div>
                          
                          <p className="text-gray-300 text-sm mb-3">
                            {suggestion.suggestion}
                          </p>
                          
                          <div className="space-y-2">
                            <div>
                              <span className="text-red-400 text-xs">Original:</span>
                              <p className="text-gray-400 text-sm bg-red-500/10 p-2 rounded">
                                {suggestion.originalText}
                              </p>
                            </div>
                            <div>
                              <span className="text-green-400 text-xs">Suggested:</span>
                              <p className="text-gray-300 text-sm bg-green-500/10 p-2 rounded">
                                {suggestion.suggestedText}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {acceptedSuggestions.has(index) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectSuggestion(index)}
                              className="border-red-500 text-red-400"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcceptSuggestion(index)}
                              className="border-green-500 text-green-400"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-6 flex justify-center gap-4">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Optimized CV
                </Button>
                <Button className="bg-gradient-to-r from-green-500 to-green-600">
                  Apply {acceptedSuggestions.size} Suggestions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">AI Writing Services</h1>
          <p className="text-xl text-gray-300">
            Professional cover letters and CV optimization powered by AI
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="bg-white/10">
              <TabsTrigger value="cover-letter" className="data-[state=active]:bg-white/20">
                Cover Letter Generator
              </TabsTrigger>
              <TabsTrigger value="cv-optimizer" className="data-[state=active]:bg-white/20">
                CV Optimizer
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="cover-letter">
            <CoverLetterGenerator />
          </TabsContent>
          
          <TabsContent value="cv-optimizer">
            <CVOptimizer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
