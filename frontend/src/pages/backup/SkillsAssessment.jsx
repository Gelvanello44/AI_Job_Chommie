import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, Share2, RotateCcw, Download, Trophy, Target, Zap, TrendingUp, Lightbulb, BarChart3, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useSkillsAssessmentMutation, useAssessmentResultsQuery, useAssessmentHistoryQuery, useAssessmentInsights } from '@/hooks/useSkillsAssessment'

const SKILL_AREAS = [
  { id: 'communication', label: 'Communication & Interpersonal Skills', icon: '' },
  { id: 'technical', label: 'Technical & Digital Skills', icon: '' },
  { id: 'leadership', label: 'Leadership & Management', icon: '' },
  { id: 'problem-solving', label: 'Problem Solving & Critical Thinking', icon: '' },
  { id: 'creativity', label: 'Creativity & Innovation', icon: '' },
  { id: 'adaptability', label: 'Adaptability & Resilience', icon: '' },
  { id: 'organization', label: 'Organization & Time Management', icon: '' },
  { id: 'analytical', label: 'Analytical & Research Skills', icon: '' }
]

const QUESTIONS = [
  {
    id: 'q1',
    text: 'Which situation energizes you most?',
    options: [
      { text: 'Leading a team meeting to solve a complex problem', skills: ['leadership', 'problem-solving'] },
      { text: 'Creating a presentation to communicate ideas clearly', skills: ['communication', 'creativity'] },
      { text: 'Analyzing data to find patterns and insights', skills: ['analytical', 'technical'] },
      { text: 'Organizing a project timeline with multiple deadlines', skills: ['organization', 'leadership'] }
    ]
  },
  {
    id: 'q2',
    text: 'When facing a new challenge, your first instinct is to:',
    options: [
      { text: 'Research similar problems and analyze best practices', skills: ['analytical', 'problem-solving'] },
      { text: 'Brainstorm creative solutions with others', skills: ['creativity', 'communication'] },
      { text: 'Break it down into manageable tasks', skills: ['organization', 'problem-solving'] },
      { text: 'Adapt quickly and try different approaches', skills: ['adaptability', 'problem-solving'] }
    ]
  },
  {
    id: 'q3',
    text: 'In a team setting, you typically:',
    options: [
      { text: "Take charge and coordinate everyone's efforts", skills: ['leadership', 'organization'] },
      { text: 'Ensure everyone understands the goals and feels heard', skills: ['communication', 'leadership'] },
      { text: 'Focus on the technical aspects and quality', skills: ['technical', 'analytical'] },
      { text: 'Generate new ideas and creative solutions', skills: ['creativity', 'communication'] }
    ]
  },
  {
    id: 'q4',
    text: 'Your ideal work environment would emphasize:',
    options: [
      { text: 'Cutting-edge technology and innovation', skills: ['technical', 'creativity'] },
      { text: 'Clear structure and efficient processes', skills: ['organization', 'analytical'] },
      { text: 'Collaborative teamwork and open communication', skills: ['communication', 'adaptability'] },
      { text: 'Autonomy to solve problems independently', skills: ['problem-solving', 'adaptability'] }
    ]
  },
  {
    id: 'q5',
    text: 'When learning something new, you prefer to:',
    options: [
      { text: 'Dive in and experiment hands-on', skills: ['adaptability', 'technical'] },
      { text: 'Study the theory and understand the principles', skills: ['analytical', 'organization'] },
      { text: 'Discuss it with others and share insights', skills: ['communication', 'leadership'] },
      { text: 'Find creative applications and improvements', skills: ['creativity', 'problem-solving'] }
    ]
  }
]

function QuizComponent({ onComplete }) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const { mutate: submitAssessment, isPending } = useSkillsAssessmentMutation()

  const handleAnswer = (questionId, selectedOption) => {
    const newAnswers = { ...answers, [questionId]: selectedOption }
    setAnswers(newAnswers)
    
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      // Calculate results
      const skillScores = {}
      SKILL_AREAS.forEach(skill => { skillScores[skill.id] = 0 })
      
      Object.values(newAnswers).forEach(answer => {
        answer.skills.forEach(skillId => {
          skillScores[skillId] += 1
        })
      })
      
      const topSkills = Object.entries(skillScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([skillId]) => SKILL_AREAS.find(s => s.id === skillId))
      
      submitAssessment({ answers: newAnswers, topSkills, skillScores }, {
        onSuccess: (results) => onComplete(results)
      })
    }
  }

  const question = QUESTIONS[currentQuestion]
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Progress value={(currentQuestion + 1) / QUESTIONS.length * 100} className="h-2" />
        <div className="flex justify-between text-sm text-gray-400 mt-2">
          <span>Question {currentQuestion + 1} of {QUESTIONS.length}</span>
          <span>{Math.round((currentQuestion + 1) / QUESTIONS.length * 100)}% Complete</span>
        </div>
      </div>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-xl">{question.text}</CardTitle>
          <CardDescription className="text-gray-300">
            Choose the option that best describes you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(question.id, option)}
              disabled={isPending}
              className="w-full p-4 text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
            >
              {option.text}
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function InsightsPanel({ results }) {
  const { data: insights, isLoading } = useAssessmentInsights()
  
  if (isLoading || !insights) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Detailed Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-300">Loading insights...</div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Strength Analysis */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Strength Analysis
          </CardTitle>
          <CardDescription className="text-gray-300">
            How your strengths apply to career growth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {insights.strengths.map((strength, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                  {strength.skill}
                </Badge>
              </div>
              <p className="text-gray-300 text-sm">{strength.description}</p>
              <div>
                <h4 className="text-white font-medium text-sm mb-2">Career Applications:</h4>
                <div className="flex flex-wrap gap-2">
                  {strength.careerApplications.map((app, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {app}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* Development Areas */}
      {insights.development.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Development Opportunities
            </CardTitle>
            <CardDescription className="text-gray-300">
              Areas where you can grow and improve
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.development.map((dev, index) => (
              <div key={index} className="space-y-2">
                <div className="text-white font-medium capitalize">
                  {dev.skill.replace('-', ' ')}
                </div>
                <div className="space-y-1">
                  {dev.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <div className="w-1 h-1 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Trends & Patterns */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Assessment Trends
          </CardTitle>
          <CardDescription className="text-gray-300">
            Your skill development patterns over time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-white font-medium">Consistent Strengths</div>
              <div className="space-y-1">
                {insights.trends.consistency.consistentStrengths.map((skill, i) => (
                  <Badge key={i} variant="outline" className="text-cyan-400 border-cyan-400 mr-2">
                    {skill.replace('-', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-white font-medium">Emerging Areas</div>
              <div className="space-y-1">
                {insights.trends.consistency.emergingStrengths.map((skill, i) => (
                  <Badge key={i} variant="secondary" className="mr-2">
                    {skill.replace('-', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-white/10">
            <div className="text-white font-medium mb-2">Overall Trend</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-medium">
                {insights.trends.improvement.percentageIncrease}% improvement
              </span>
              <span className="text-gray-300">in key areas</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ResultsDashboard({ results, onRetake, onShare }) {
  const { topSkills, skillScores, completedAt, nextRetakeDate } = results
  const [showInsights, setShowInsights] = useState(false)
  
  const generateShareableUrl = (skill) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/skill-badge/${skill.id}`
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Trophy className="h-8 w-8 text-cyan-400" />
          <h2 className="text-3xl font-bold text-white">Your Top 3 Strengths</h2>
        </div>
        <p className="text-gray-300">Assessment completed on {new Date(completedAt).toLocaleDateString('en-ZA')}</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        {topSkills.map((skill, index) => (
          <Card key={skill.id} className="bg-white/5 border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
              #{index + 1}
            </div>
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">{skill.icon}</div>
              <CardTitle className="text-white text-lg">{skill.label}</CardTitle>
              <div className="flex justify-center mt-4">
                <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                  {skillScores[skill.id]} / {QUESTIONS.length} matches
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onShare(generateShareableUrl(skill))}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Badge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(`data:image/svg+xml,${encodeURIComponent(generateBadgeSVG(skill, index + 1))}`, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            All Skill Areas
          </CardTitle>
          <CardDescription className="text-gray-300">
            Your results across all assessed areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {SKILL_AREAS.map(skill => (
              <div key={skill.id} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white flex items-center gap-2">
                    <span>{skill.icon}</span>
                    {skill.label}
                  </span>
                  <span className="text-gray-300">{skillScores[skill.id]} / {QUESTIONS.length}</span>
                </div>
                <Progress 
                  value={(skillScores[skill.id] / QUESTIONS.length) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-center gap-4">
        <Button
          onClick={onRetake}
          variant="outline"
          disabled={nextRetakeDate && new Date() < new Date(nextRetakeDate)}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {nextRetakeDate && new Date() < new Date(nextRetakeDate) 
            ? `Retake available ${new Date(nextRetakeDate).toLocaleDateString('en-ZA')}`
            : 'Retake Assessment'
          }
        </Button>
        <Button
          onClick={() => setShowInsights(!showInsights)}
          variant={showInsights ? 'default' : 'outline'}
        >
          <Brain className="h-4 w-4 mr-2" />
          {showInsights ? 'Hide Insights' : 'View Detailed Insights'}
        </Button>
      </div>
      
      {showInsights && (
        <InsightsPanel results={results} />
      )}
      
      {nextRetakeDate && new Date() < new Date(nextRetakeDate) && (
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-400">
              <Zap className="h-5 w-5" />
              <span className="font-medium">Recommendation:</span>
            </div>
            <p className="text-gray-300 mt-2">
              For the most accurate results, we recommend waiting at least 30 days between assessments. 
              This allows time for skill development and prevents assessment fatigue.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function generateBadgeSVG(skill, rank) {
  return `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#22d3ee;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#0891b2;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="300" height="200" fill="url(#grad1)" rx="10" ry="10"/>
    <text x="150" y="40" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">AI Job Chommie</text>
    <text x="150" y="70" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24">${skill.icon}</text>
    <text x="150" y="100" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">Top ${rank} Strength</text>
    <text x="150" y="130" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12">${skill.label}</text>
    <text x="150" y="170" text-anchor="middle" fill="#e5f9fc" font-family="Arial, sans-serif" font-size="10">Verified Skills Assessment</text>
  </svg>`
}

export default function SkillsAssessment() {
  const [showResults, setShowResults] = useState(false)
  const [currentResults, setCurrentResults] = useState(null)
  const { data: historicalResults } = useAssessmentResultsQuery()
  
  const handleQuizComplete = (results) => {
    setCurrentResults(results)
    setShowResults(true)
  }
  
  const handleRetake = () => {
    setShowResults(false)
    setCurrentResults(null)
  }
  
  const handleShare = (url) => {
    if (navigator.share) {
      navigator.share({
        title: 'My Skills Assessment Result',
        url: url
      })
    } else {
      navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  // Show historical results if available and no current assessment
  const resultsToShow = currentResults || (historicalResults?.length > 0 ? historicalResults[0] : null)
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Skills Assessment</h1>
          <p className="text-xl text-gray-300">
            Discover your top 3 professional strengths and get shareable skill badges
          </p>
        </div>
        
        {!showResults && !resultsToShow ? (
          <div className="space-y-8">
            <Card className="bg-white/5 border-white/10 max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-white text-2xl">Ready to discover your strengths?</CardTitle>
                <CardDescription className="text-gray-300">
                  This quick 5-question assessment identifies your top professional skills and provides 
                  shareable badges for your LinkedIn profile and CV.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-gray-300">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-cyan-400" />
                    <span>Takes just 2-3 minutes to complete</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-cyan-400" />
                    <span>Identifies your top 3 professional strengths</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-cyan-400" />
                    <span>Provides shareable badges and downloadable certificates</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-cyan-400" />
                    <span>Can be retaken every 30 days to track growth</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-6" 
                  size="lg"
                  onClick={() => setShowResults(false)}
                >
                  Start Assessment
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : showResults || resultsToShow ? (
          <ResultsDashboard 
            results={resultsToShow} 
            onRetake={handleRetake}
            onShare={handleShare}
          />
        ) : (
          <QuizComponent onComplete={handleQuizComplete} />
        )}
      </div>
    </div>
  )
}
