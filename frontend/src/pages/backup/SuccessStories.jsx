import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Star, 
  Quote, 
  MapPin, 
  Briefcase, 
  Clock, 
  TrendingUp,
  Award,
  Heart,
  CheckCircle,
  Users,
  DollarSign,
  Calendar,
  Target,
  Zap,
  Trophy,
  MessageSquare
} from 'lucide-react'

const SUCCESS_STORIES = [
  {
    id: 1,
    name: 'Thandiwe Mthembu',
    age: 28,
    location: 'Johannesburg, Gauteng',
    previousRole: 'Junior Developer',
    newRole: 'Senior React Developer',
    company: 'TechCorp Africa',
    salaryIncrease: 45,
    timeToHire: '18 days',
    industry: 'Technology',
    photo: null, // Would be actual photo URLs in production
    story: "I was stuck in a junior role for 3 years, applying manually to dozens of jobs with no luck. AI Job Chommie changed everything. The AI optimized my CV, highlighting skills I didn't even know were valuable. Within 3 weeks, I had multiple interviews and landed a senior role with a 45% salary increase!",
    keyFactors: ['AI-optimized CV', 'Targeted applications', 'Skills assessment guidance'],
    testimonial: "AI Job Chommie didn't just find me a job - it found me a career. The platform helped me realize my true worth and connected me with employers who valued my potential.",
    featured: true,
    applicationCount: 12,
    interviewCount: 5,
    offerCount: 3
  },
  {
    id: 2,
    name: 'Pieter van der Merwe',
    age: 34,
    location: 'Cape Town, Western Cape',
    previousRole: 'Unemployed (6 months)',
    newRole: 'Project Manager',
    company: 'Green Energy Solutions',
    salaryIncrease: null,
    newSalary: 'R520,000',
    timeToHire: '26 days',
    industry: 'Renewable Energy',
    photo: null,
    story: "After being retrenched, I was devastated and lost. Traditional job boards weren't working. AI Job Chommie's company intelligence feature helped me understand what employers really wanted. The predictive analytics showed me which opportunities I had the best chances with.",
    keyFactors: ['Company research insights', 'Strategic application timing', 'Confidence boost'],
    testimonial: "Being unemployed for 6 months destroyed my confidence. AI Job Chommie rebuilt it by showing me data-driven proof that I was valuable to employers.",
    featured: true,
    applicationCount: 22,
    interviewCount: 8,
    offerCount: 2
  },
  {
    id: 3,
    name: 'Nomsa Dlamini',
    age: 25,
    location: 'Durban, KwaZulu-Natal',
    previousRole: 'Recent Graduate',
    newRole: 'Marketing Analyst',
    company: 'Coastal Marketing Agency',
    salaryIncrease: null,
    newSalary: 'R280,000',
    timeToHire: '32 days',
    industry: 'Marketing',
    photo: null,
    story: "As a fresh graduate with no experience, I felt hopeless. Every application seemed to disappear into a black hole. AI Job Chommie's skills assessment revealed transferable skills from my university projects and part-time work that I'd never considered valuable.",
    keyFactors: ['Skills identification', 'Entry-level targeting', 'Application tracking'],
    testimonial: "I went from zero responses to multiple offers. The platform taught me how to present my potential, not just my experience.",
    featured: false,
    applicationCount: 34,
    interviewCount: 12,
    offerCount: 4
  },
  {
    id: 4,
    name: 'Mohamed Rasheed',
    age: 41,
    location: 'Port Elizabeth, Eastern Cape',
    previousRole: 'Operations Supervisor',
    newRole: 'Operations Director',
    company: 'Automotive Manufacturing',
    salaryIncrease: 38,
    timeToHire: '43 days',
    industry: 'Manufacturing',
    photo: null,
    story: "I'd been in middle management for 8 years, applying for senior roles but never getting past the first interview. The AI cover letter generator crafted messages that perfectly matched each company's values and needs. The difference was immediately noticeable.",
    keyFactors: ['Executive positioning', 'Company culture matching', 'Leadership experience highlighting'],
    testimonial: "Finally, a platform that understood the nuances of senior-level applications. My success rate jumped from 5% to over 60%.",
    featured: false,
    applicationCount: 16,
    interviewCount: 11,
    offerCount: 2
  },
  {
    id: 5,
    name: 'Sarah Johnson',
    age: 29,
    location: 'Bloemfontein, Free State',
    previousRole: 'Teacher',
    newRole: 'Learning & Development Manager',
    company: 'Corporate Training Institute',
    salaryIncrease: 52,
    timeToHire: '29 days',
    industry: 'Education/Training',
    photo: null,
    story: "I wanted to transition from teaching to corporate training but didn't know how to translate my classroom skills. AI Job Chommie's advanced matching showed me roles I'd never considered and helped me reframe my experience for the corporate world.",
    keyFactors: ['Career transition support', 'Skill translation', 'Industry insights'],
    testimonial: "The platform opened doors I didn't even know existed. It's like having a career counselor who never sleeps.",
    featured: true,
    applicationCount: 19,
    interviewCount: 7,
    offerCount: 3
  }
]

const STATS = {
  totalUsers: 12847,
  successfulPlacements: 8932,
  averageSalaryIncrease: 34,
  averageTimeToHire: 28,
  satisfactionRate: 94
}

const TESTIMONIALS = [
  {
    name: 'David Sibeko',
    role: 'Software Engineer',
    company: 'Digital Innovation Hub',
    rating: 5,
    text: "The AI actually understood what I was looking for better than I did. It suggested roles I hadn't considered that turned out to be perfect fits.",
    location: 'Pretoria'
  },
  {
    name: 'Linda Nkomo',
    role: 'HR Manager',
    company: 'People Solutions SA',
    rating: 5,
    text: "Three interviews in my first week! The application materials were so well-crafted that employers were impressed before they even met me.",
    location: 'Johannesburg'
  },
  {
    name: 'Riaan Botha',
    role: 'Financial Analyst',
    company: 'Investment Partners',
    rating: 5,
    text: "I was skeptical about AI job searching, but the results speak for themselves. 60% response rate compared to 8% with manual applications.",
    location: 'Cape Town'
  },
  {
    name: 'Precious Makua',
    role: 'UX Designer',
    company: 'Creative Digital',
    rating: 5,
    text: "The platform's insights into company culture helped me find not just a job, but a workplace where I truly belong.",
    location: 'Johannesburg'
  }
]

function SuccessStoryCard({ story, isDetailed = false }) {
  const [showFullStory, setShowFullStory] = useState(isDetailed)
  
  return (
    <Card className={`bg-white/5 border-white/10 ${story.featured ? 'border-cyan-400/30' : ''}`}>
      {story.featured && (
        <div className="bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 rounded-t-lg">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <Star className="h-4 w-4" />
            Featured Success Story
          </div>
        </div>
      )}
      
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-xl">{story.name}</CardTitle>
            <div className="flex items-center gap-4 text-gray-300 text-sm mt-2">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {story.location}
              </div>
              <div className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {story.industry}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {story.timeToHire}
              </div>
            </div>
          </div>
          <div className="text-right">
            {story.salaryIncrease && (
              <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                +{story.salaryIncrease}% salary
              </div>
            )}
            {story.newSalary && !story.salaryIncrease && (
              <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
                {story.newSalary}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="text-gray-300">
            From: {story.previousRole}
          </Badge>
          <span className="text-gray-400">→</span>
          <Badge variant="outline" className="text-cyan-400 border-cyan-400">
            To: {story.newRole} @ {story.company}
          </Badge>
        </div>
        
        <div className="bg-white/5 p-4 rounded-lg border-l-4 border-cyan-400">
          <Quote className="h-5 w-5 text-cyan-400 mb-2" />
          <p className="text-gray-300 italic">
            "{showFullStory ? story.story : story.story.substring(0, 200) + '...'}"
          </p>
          {!isDetailed && story.story.length > 200 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 p-0 h-auto text-cyan-400 hover:text-cyan-300"
              onClick={() => setShowFullStory(!showFullStory)}
            >
              {showFullStory ? 'Show less' : 'Read more'}
            </Button>
          )}
        </div>
        
        {showFullStory && (
          <div className="space-y-4">
            <div>
              <h4 className="text-white font-medium mb-2">Key Success Factors:</h4>
              <div className="flex flex-wrap gap-2">
                {story.keyFactors.map((factor, index) => (
                  <Badge key={index} variant="outline" className="text-green-400 border-green-400/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 p-4 bg-black/20 rounded-lg">
              <div className="text-center">
                <div className="text-cyan-400 font-bold text-lg">{story.applicationCount}</div>
                <div className="text-gray-400 text-xs">Applications</div>
              </div>
              <div className="text-center">
                <div className="text-blue-400 font-bold text-lg">{story.interviewCount}</div>
                <div className="text-gray-400 text-xs">Interviews</div>
              </div>
              <div className="text-center">
                <div className="text-green-400 font-bold text-lg">{story.offerCount}</div>
                <div className="text-gray-400 text-xs">Offers</div>
              </div>
            </div>
            
            <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/20">
              <div className="text-purple-400 font-medium text-sm mb-2">What {story.name.split(' ')[0]} says:</div>
              <p className="text-gray-300 italic">"{story.testimonial}"</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TestimonialCard({ testimonial }) {
  return (
    <Card className="bg-white/5 border-white/10 h-full">
      <CardContent className="p-6">
        <div className="flex items-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        
        <blockquote className="text-gray-300 mb-4 leading-relaxed">
          "{testimonial.text}"
        </blockquote>
        
        <div className="border-t border-white/10 pt-4">
          <div className="text-white font-medium">{testimonial.name}</div>
          <div className="text-cyan-400 text-sm">{testimonial.role}</div>
          <div className="text-gray-400 text-sm">{testimonial.company} • {testimonial.location}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SuccessStories() {
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  
  const industries = [...new Set(SUCCESS_STORIES.map(story => story.industry))]
  
  const filteredStories = SUCCESS_STORIES.filter(story => {
    if (selectedIndustry && story.industry !== selectedIndustry) return false
    if (featuredOnly && !story.featured) return false
    return true
  })
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Success <span className="text-cyan-400">Stories</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Real people, real results. Discover how AI Job Chommie has transformed careers across South Africa
          </p>
        </div>
        
        {/* Stats Section */}
        <div className="grid md:grid-cols-5 gap-4 mb-12">
          <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-400/20">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{STATS.totalUsers.toLocaleString()}</div>
              <div className="text-cyan-400 text-sm">Active Users</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-400/20">
            <CardContent className="p-6 text-center">
              <Trophy className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{STATS.successfulPlacements.toLocaleString()}</div>
              <div className="text-green-400 text-sm">Jobs Secured</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-400/20">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{STATS.averageSalaryIncrease}%</div>
              <div className="text-purple-400 text-sm">Avg Salary Boost</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-400/20">
            <CardContent className="p-6 text-center">
              <Clock className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{STATS.averageTimeToHire}</div>
              <div className="text-yellow-400 text-sm">Days to Hire</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-400/20">
            <CardContent className="p-6 text-center">
              <Heart className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{STATS.satisfactionRate}%</div>
              <div className="text-red-400 text-sm">Satisfaction Rate</div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="stories" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-white/10">
              <TabsTrigger value="stories" className="data-[state=active]:bg-white/20">
                <Award className="h-4 w-4 mr-2" />
                Success Stories
              </TabsTrigger>
              <TabsTrigger value="testimonials" className="data-[state=active]:bg-white/20">
                <MessageSquare className="h-4 w-4 mr-2" />
                Testimonials
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="stories">
            <div className="space-y-8">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 justify-center items-center">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={!selectedIndustry ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedIndustry('')}
                  >
                    All Industries
                  </Button>
                  {industries.map(industry => (
                    <Button
                      key={industry}
                      variant={selectedIndustry === industry ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedIndustry(industry)}
                    >
                      {industry}
                    </Button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={featuredOnly}
                    onChange={(e) => setFeaturedOnly(e.target.checked)}
                    className="text-cyan-500"
                  />
                  <label htmlFor="featured" className="text-gray-300 text-sm">
                    Featured stories only
                  </label>
                </div>
              </div>
              
              {/* Stories Grid */}
              <div className="grid lg:grid-cols-2 gap-8">
                {filteredStories.map(story => (
                  <SuccessStoryCard key={story.id} story={story} isDetailed />
                ))}
              </div>
              
              {filteredStories.length === 0 && (
                <div className="text-center py-12">
                  <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-2">No stories found</h3>
                  <p className="text-gray-300">Try adjusting your filters to see more success stories</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="testimonials">
            <div className="grid md:grid-cols-2 gap-6">
              {TESTIMONIALS.map((testimonial, index) => (
                <TestimonialCard key={index} testimonial={testimonial} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* CTA Section */}
        <div className="text-center mt-16 p-8 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl border border-cyan-400/20">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Write Your Success Story?</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of South Africans who have transformed their careers with AI Job Chommie. 
            Your success story could be next.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              Start Your Journey
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
            >
              View Pricing Plans
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
