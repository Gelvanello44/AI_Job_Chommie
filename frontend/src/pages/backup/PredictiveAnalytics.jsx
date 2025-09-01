import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp,
  Target,
  Clock,
  Brain,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Calendar,
  Users,
  Award,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'
import aiService from '@/services/aiService'
import { useApplicationsQuery } from '@/hooks/useApplications'

export default function PredictiveAnalytics() {
  const [predictions, setPredictions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPrediction, setSelectedPrediction] = useState(null)
  const { data: applications } = useApplicationsQuery()
  
  useEffect(() => {
    generatePredictions()
  }, [applications])
  
  const generatePredictions = async () => {
    setIsLoading(true)
    try {
      // Mock user profile for predictions
      const userProfile = {
        name: 'John Doe',
        skills: ['React', 'JavaScript', 'Node.js', 'Python', 'AWS'],
        experience: '3+ years',
        education: 'Computer Science Degree',
        applicationHistory: applications?.items || []
      }
      
      // Generate predictions for mock job opportunities
      const mockJobs = [
        {
          id: 'pred-1',
          title: 'Senior React Developer',
          company: 'TechCorp SA',
          description: 'Looking for a Senior React Developer with 3+ years experience...',
          requirements: ['React', 'JavaScript', 'Node.js', 'AWS'],
          companyInfo: { industry: 'Technology', size: '51-200', values: ['Innovation'] }
        },
        {
          id: 'pred-2',
          title: 'Full Stack Engineer',
          company: 'StartupCo',
          description: 'Join our dynamic team as a Full Stack Engineer...',
          requirements: ['JavaScript', 'Python', 'React', 'SQL'],
          companyInfo: { industry: 'Technology', size: '11-50', values: ['Agility'] }
        },
        {
          id: 'pred-3',
          title: 'Frontend Developer',
          company: 'Digital Agency',
          description: 'Create amazing user experiences with modern frontend technologies...',
          requirements: ['React', 'CSS', 'JavaScript', 'Design'],
          companyInfo: { industry: 'Digital Services', size: '21-100', values: ['Creativity'] }
        }
      ]
      
      const predictionPromises = mockJobs.map(async (job) => {
        const prediction = await aiService.predictApplicationSuccess({
          jobDescription: job.description,
          userProfile,
          applicationHistory: userProfile.applicationHistory,
          companyInfo: job.companyInfo
        })
        
        return {
          ...job,
          ...prediction,
          id: job.id
        }
      })
      
      const results = await Promise.all(predictionPromises)
      setPredictions(results.sort((a, b) => b.successProbability - a.successProbability))
      
    } catch (error) {
      console.error('Error generating predictions:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const getSuccessColor = (probability) => {
    if (probability >= 70) return 'text-green-400'
    if (probability >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }
  
  const getSuccessIcon = (probability) => {
    if (probability >= 70) return <ArrowUp className="h-4 w-4" />
    if (probability >= 50) return <Minus className="h-4 w-4" />
    return <ArrowDown className="h-4 w-4" />
  }
  
  const PredictionOverview = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400 mb-1">
              {predictions.length}
            </div>
            <div className="text-sm text-gray-300">Analyzed Opportunities</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {predictions.filter(p => p.successProbability >= 70).length}
            </div>
            <div className="text-sm text-gray-300">High Success Probability</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              {Math.round(predictions.reduce((sum, p) => sum + p.successProbability, 0) / predictions.length) || 0}%
            </div>
            <div className="text-sm text-gray-300">Average Success Rate</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-4">
        {predictions.map((prediction) => (
          <Card 
            key={prediction.id} 
            className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => setSelectedPrediction(prediction)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-semibold text-lg">{prediction.title}</h3>
                    <Badge variant="secondary">{prediction.company}</Badge>
                  </div>
                  
                  <div className="flex items-center gap-6 mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 ${getSuccessColor(prediction.successProbability)}`}>
                        {getSuccessIcon(prediction.successProbability)}
                        <span className="font-bold text-xl">{prediction.successProbability}%</span>
                      </div>
                      <span className="text-gray-400 text-sm">Success Probability</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300 text-sm">{prediction.timelinePrediction.estimatedResponse}</span>
                    </div>
                    
                    <Badge variant={prediction.confidenceLevel === 'high' ? 'default' : 'secondary'}>
                      {prediction.confidenceLevel} confidence
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {prediction.keyFactors.slice(0, 3).map((factor, index) => (
                      <div key={index} className="flex items-center gap-1">
                        {factor.impact === 'positive' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : factor.impact === 'negative' ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <Minus className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-gray-300 text-sm">{factor.factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="w-20">
                    <Progress value={prediction.successProbability} className="h-2" />
                  </div>
                  <Button variant="outline" size="sm">
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
  
  const PredictionDetails = () => {
    if (!selectedPrediction) {
      return (
        <div className="text-center py-12">
          <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">Select a Prediction</h3>
          <p className="text-gray-300">Choose an opportunity to see detailed AI analysis</p>
        </div>
      )
    }
    
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-xl">{selectedPrediction.title}</CardTitle>
                <CardDescription className="text-gray-300">
                  {selectedPrediction.company} • AI Success Analysis
                </CardDescription>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getSuccessColor(selectedPrediction.successProbability)}`}>
                  {selectedPrediction.successProbability}%
                </div>
                <div className="text-gray-400 text-sm">Success Probability</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Key Success Factors
                </h4>
                <div className="space-y-2">
                  {selectedPrediction.keyFactors.map((factor, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 bg-white/5 rounded-lg">
                      {factor.impact === 'positive' ? (
                        <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                      ) : factor.impact === 'negative' ? (
                        <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                      ) : (
                        <Minus className="h-5 w-5 text-gray-400 mt-0.5" />
                      )}
                      <div>
                        <div className="text-white font-medium text-sm">{factor.factor}</div>
                        <div className="text-gray-300 text-xs">{factor.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline Prediction
                </h4>
                <div className="space-y-3 p-4 bg-white/5 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Expected Response:</span>
                    <span className="text-white font-medium">{selectedPrediction.timelinePrediction.estimatedResponse}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Confidence:</span>
                    <Badge variant={selectedPrediction.timelinePrediction.confidence === 'high' ? 'default' : 'secondary'}>
                      {selectedPrediction.timelinePrediction.confidence}
                    </Badge>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-gray-400 text-xs mb-1">Factors considered:</div>
                    <div className="text-gray-300 text-sm">
                      {selectedPrediction.timelinePrediction.factors.join(' • ')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedPrediction.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <Zap className="h-5 w-5 text-cyan-400 mt-0.5" />
                  <div>
                    <div className="text-white font-medium text-sm">{rec}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => setSelectedPrediction(null)}>
            Back to Overview
          </Button>
          <Button className="bg-gradient-to-r from-green-500 to-green-600">
            Apply AI Optimizations
          </Button>
        </div>
      </div>
    )
  }
  
  const SuccessTrends = () => (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Success Rate Trends
          </CardTitle>
          <CardDescription className="text-gray-300">
            Your application success patterns over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-xl font-bold text-green-400">78%</div>
                <div className="text-xs text-gray-300">This Month</div>
              </div>
              <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-xl font-bold text-blue-400">65%</div>
                <div className="text-xs text-gray-300">Last Month</div>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="text-xl font-bold text-yellow-400">+13%</div>
                <div className="text-xs text-gray-300">Improvement</div>
              </div>
              <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="text-xl font-bold text-purple-400">5.2d</div>
                <div className="text-xs text-gray-300">Avg Response</div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/10">
              <h4 className="text-white font-medium mb-3">Success Factors Analysis</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Technical Skills Match</span>
                    <span className="text-green-400 font-medium">85%</span>
                  </div>
                  <Progress value={85} className="h-2 mb-3" />
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Experience Level Fit</span>
                    <span className="text-yellow-400 font-medium">72%</span>
                  </div>
                  <Progress value={72} className="h-2" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Company Culture Match</span>
                    <span className="text-blue-400 font-medium">68%</span>
                  </div>
                  <Progress value={68} className="h-2 mb-3" />
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Application Quality</span>
                    <span className="text-cyan-400 font-medium">91%</span>
                  </div>
                  <Progress value={91} className="h-2" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            Optimization Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <div className="text-yellow-400 font-medium text-sm">Improve Company Research</div>
                <div className="text-gray-300 text-sm">
                  Applications with company-specific insights have 23% higher success rates
                </div>
                <Button size="sm" variant="outline" className="mt-2">
                  Learn More
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Lightbulb className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <div className="text-blue-400 font-medium text-sm">Optimize Application Timing</div>
                <div className="text-gray-300 text-sm">
                  Tuesday-Thursday applications show 18% better response rates
                </div>
                <Button size="sm" variant="outline" className="mt-2">
                  Schedule Applications
                </Button>
              </div>
            </div>
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
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Predictive Analytics</h1>
            <p className="text-xl text-gray-300">
              AI-powered success predictions and timeline analysis
            </p>
          </div>
          
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Brain className="h-16 w-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
              <h3 className="text-white font-semibold mb-2">Analyzing Opportunities</h3>
              <p className="text-gray-300">Our AI is calculating success probabilities...</p>
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
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Predictive Analytics</h1>
          <p className="text-xl text-gray-300">
            AI-powered success predictions and timeline analysis
          </p>
        </div>
        
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="bg-white/10">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white/20">
                Success Predictions
              </TabsTrigger>
              <TabsTrigger value="details" className="data-[state=active]:bg-white/20">
                Detailed Analysis
              </TabsTrigger>
              <TabsTrigger value="trends" className="data-[state=active]:bg-white/20">
                Success Trends
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="overview">
            <PredictionOverview />
          </TabsContent>
          
          <TabsContent value="details">
            <PredictionDetails />
          </TabsContent>
          
          <TabsContent value="trends">
            <SuccessTrends />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
