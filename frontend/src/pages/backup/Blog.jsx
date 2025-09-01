import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  Calendar, 
  User, 
  Clock, 
  TrendingUp,
  BookOpen,
  Lightbulb,
  Target,
  Star,
  ArrowRight,
  Filter,
  ChevronRight,
  Award,
  Users,
  BarChart3,
  FileText,
  Globe,
  Briefcase,
  MessageCircle,
  Eye,
  Heart,
  Share2
} from 'lucide-react'
import { Link } from 'react-router-dom'

const BLOG_CATEGORIES = [
  { id: 'all', name: 'All Posts', icon: <Globe className="h-4 w-4" /> },
  { id: 'job-search', name: 'Job Search Tips', icon: <Target className="h-4 w-4" /> },
  { id: 'cv-writing', name: 'CV Writing', icon: <FileText className="h-4 w-4" /> },
  { id: 'interviews', name: 'Interview Tips', icon: <Users className="h-4 w-4" /> },
  { id: 'career-advice', name: 'Career Advice', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'market-insights', name: 'Market Insights', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'ai-tools', name: 'AI & Technology', icon: <Lightbulb className="h-4 w-4" /> }
]

const BLOG_POSTS = [
  {
    id: 1,
    title: '10 AI-Powered Job Search Strategies That Actually Work in 2025',
    slug: 'ai-job-search-strategies-2025',
    excerpt: 'Discover how artificial intelligence is revolutionizing job hunting and learn practical strategies to leverage AI tools for landing your dream job faster.',
    content: `The job market has fundamentally changed. While traditional methods still have their place, AI-powered tools are giving job seekers unprecedented advantages. Here's how to use them effectively...`,
    author: 'Sarah Mitchell',
    authorRole: 'Career Strategist',
    publishedAt: '2025-01-15',
    readTime: '8 min read',
    category: 'job-search',
    tags: ['AI', 'Job Search', 'Strategy', 'Technology'],
    featured: true,
    views: 2847,
    likes: 156,
    comments: 23,
    image: '/blog/ai-job-search.jpg' // Would be actual image URLs
  },
  {
    id: 2,
    title: 'The South African Job Market: 2025 Salary Report',
    slug: 'sa-salary-report-2025',
    excerpt: 'Comprehensive analysis of salary trends across major South African cities and industries. Essential reading for salary negotiations and career planning.',
    content: `Our comprehensive analysis of over 10,000 salary data points reveals significant shifts in the South African job market...`,
    author: 'Dr. James Nkomo',
    authorRole: 'Labour Market Economist',
    publishedAt: '2025-01-12',
    readTime: '12 min read',
    category: 'market-insights',
    tags: ['Salary', 'South Africa', 'Market Analysis', 'Trends'],
    featured: true,
    views: 4231,
    likes: 298,
    comments: 67,
    image: '/blog/salary-report.jpg'
  },
  {
    id: 3,
    title: 'How to Write an ATS-Friendly CV That Gets Past the Robots',
    slug: 'ats-friendly-cv-guide',
    excerpt: 'Master the art of writing CVs that pass through Applicant Tracking Systems while still appealing to human recruiters.',
    content: `Over 90% of large companies use Applicant Tracking Systems (ATS) to filter applications. Here's how to optimize your CV...`,
    author: 'Linda van der Berg',
    authorRole: 'HR Director & Recruitment Expert',
    publishedAt: '2025-01-10',
    readTime: '6 min read',
    category: 'cv-writing',
    tags: ['CV', 'ATS', 'Resume Writing', 'Recruitment'],
    featured: false,
    views: 1923,
    likes: 134,
    comments: 45,
    image: '/blog/ats-cv.jpg'
  },
  {
    id: 4,
    title: 'Remote Work Revolution: Best Practices for SA Job Seekers',
    slug: 'remote-work-sa-job-seekers',
    excerpt: 'Navigate the remote work landscape in South Africa with practical tips for finding, applying to, and succeeding in remote positions.',
    content: `Remote work opportunities in South Africa have increased by 340% since 2020. Here's your complete guide to capitalizing on this trend...`,
    author: 'Michael Stevens',
    authorRole: 'Remote Work Consultant',
    publishedAt: '2025-01-08',
    readTime: '10 min read',
    category: 'career-advice',
    tags: ['Remote Work', 'Career Development', 'Work-Life Balance'],
    featured: false,
    views: 1567,
    likes: 89,
    comments: 31,
    image: '/blog/remote-work.jpg'
  },
  {
    id: 5,
    title: 'Master the Virtual Interview: A Complete Guide',
    slug: 'virtual-interview-guide',
    excerpt: 'Excel in virtual interviews with expert tips on technology setup, body language, and making a lasting impression through the screen.',
    content: `Virtual interviews are here to stay. Our research shows that 67% of final interviews in South Africa now happen online...`,
    author: 'Priya Sharma',
    authorRole: 'Interview Coach',
    publishedAt: '2025-01-05',
    readTime: '9 min read',
    category: 'interviews',
    tags: ['Interviews', 'Virtual Meetings', 'Communication Skills'],
    featured: false,
    views: 2156,
    likes: 187,
    comments: 52,
    image: '/blog/virtual-interview.jpg'
  },
  {
    id: 6,
    title: 'Career Transitions: How to Successfully Change Industries',
    slug: 'career-transition-guide',
    excerpt: 'Step-by-step guide to successfully transitioning between industries, including how to transfer skills and overcome experience gaps.',
    content: `Changing industries can be daunting, but with the right strategy, it's entirely achievable. Here's how to make the transition...`,
    author: 'Thandiwe Mabaso',
    authorRole: 'Career Transition Specialist',
    publishedAt: '2025-01-03',
    readTime: '11 min read',
    category: 'career-advice',
    tags: ['Career Change', 'Skills Transfer', 'Professional Development'],
    featured: false,
    views: 1845,
    likes: 142,
    comments: 38,
    image: '/blog/career-transition.jpg'
  }
]

const FEATURED_RESOURCES = [
  {
    title: 'CV Templates Library',
    description: 'Download professional CV templates optimized for South African companies',
    icon: <FileText className="h-6 w-6" />,
    link: '/cv-builder',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    title: 'Interview Preparation Kit',
    description: 'Common interview questions and expert answers for SA job market',
    icon: <Users className="h-6 w-6" />,
    link: '/resources/interview-kit',
    color: 'from-green-500 to-emerald-500'
  },
  {
    title: 'Salary Benchmark Tool',
    description: 'Compare salaries across industries and locations in South Africa',
    icon: <BarChart3 className="h-6 w-6" />,
    link: '/resources/salary-benchmark',
    color: 'from-purple-500 to-pink-500'
  },
  {
    title: 'Job Search Checklist',
    description: 'Step-by-step checklist to organize and optimize your job search',
    icon: <Target className="h-6 w-6" />,
    link: '/resources/job-search-checklist',
    color: 'from-orange-500 to-red-500'
  }
]

function BlogCard({ post, featured = false }) {
  return (
    <Card className={`bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer ${featured ? 'lg:col-span-2' : ''}`}>
      <div className={`aspect-video bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-t-lg flex items-center justify-center ${featured ? 'lg:aspect-[2/1]' : ''}`}>
        <BookOpen className="h-12 w-12 text-gray-400" />
      </div>
      
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="text-xs">
            {BLOG_CATEGORIES.find(cat => cat.id === post.category)?.name || post.category}
          </Badge>
          {post.featured && (
            <Badge className="text-xs bg-yellow-500/20 text-yellow-400">Featured</Badge>
          )}
        </div>
        
        <h3 className={`text-white font-semibold mb-3 line-clamp-2 ${featured ? 'text-xl lg:text-2xl' : 'text-lg'}`}>
          {post.title}
        </h3>
        
        <p className="text-gray-300 text-sm mb-4 line-clamp-3">
          {post.excerpt}
        </p>
        
        <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {post.author}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(post.publishedAt).toLocaleDateString('en-ZA')}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readTime}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.views.toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {post.likes}
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {post.comments}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
            Read More <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ResourceCard({ resource }) {
  return (
    <Link to={resource.link}>
      <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-200 hover:border-white/20 cursor-pointer h-full">
        <CardContent className="p-6">
          <div className={`w-12 h-12 bg-gradient-to-r ${resource.color} rounded-lg flex items-center justify-center mb-4`}>
            {resource.icon}
          </div>
          <h3 className="text-white font-semibold mb-2">{resource.title}</h3>
          <p className="text-gray-300 text-sm mb-4">{resource.description}</p>
          <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 p-0">
            Access Resource <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function Blog() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('latest')
  
  const filteredPosts = BLOG_POSTS.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })
  
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (sortBy) {
      case 'latest':
        return new Date(b.publishedAt) - new Date(a.publishedAt)
      case 'popular':
        return b.views - a.views
      case 'trending':
        return b.likes - a.likes
      default:
        return 0
    }
  })
  
  const featuredPosts = sortedPosts.filter(post => post.featured)
  const regularPosts = sortedPosts.filter(post => !post.featured)
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Career <span className="text-cyan-400">Resources</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Expert insights, practical tips, and valuable resources to accelerate your career journey in South Africa
          </p>
        </div>
        
        <Tabs defaultValue="blog" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-white/10">
              <TabsTrigger value="blog" className="data-[state=active]:bg-white/20">
                <BookOpen className="h-4 w-4 mr-2" />
                Blog Posts
              </TabsTrigger>
              <TabsTrigger value="resources" className="data-[state=active]:bg-white/20">
                <Award className="h-4 w-4 mr-2" />
                Free Resources
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="blog">
            <div className="space-y-8">
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search articles..."
                    className="pl-10 bg-white/10 border-white/20"
                  />
                </div>
                
                <div className="flex items-center gap-4">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white text-sm"
                  >
                    <option value="latest">Latest First</option>
                    <option value="popular">Most Popular</option>
                    <option value="trending">Most Liked</option>
                  </select>
                </div>
              </div>
              
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 justify-center">
                {BLOG_CATEGORIES.map(category => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="flex items-center gap-2"
                  >
                    {category.icon}
                    {category.name}
                  </Button>
                ))}
              </div>
              
              {/* Featured Posts */}
              {featuredPosts.length > 0 && selectedCategory === 'all' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Star className="h-6 w-6 text-yellow-400" />
                    Featured Articles
                  </h2>
                  <div className="grid lg:grid-cols-3 gap-6">
                    {featuredPosts.map(post => (
                      <BlogCard key={post.id} post={post} featured />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Regular Posts */}
              <div className="space-y-6">
                {(selectedCategory !== 'all' || featuredPosts.length === 0) && (
                  <h2 className="text-2xl font-bold text-white">
                    {selectedCategory === 'all' ? 'Latest Articles' : `${BLOG_CATEGORIES.find(cat => cat.id === selectedCategory)?.name} Articles`}
                  </h2>
                )}
                
                {sortedPosts.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(selectedCategory === 'all' ? regularPosts : sortedPosts).map(post => (
                      <BlogCard key={post.id} post={post} />
                    ))}
                  </div>
                ) : (
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-12 text-center">
                      <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-white font-semibold mb-2">No articles found</h3>
                      <p className="text-gray-300">
                        Try adjusting your search terms or category filter
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Newsletter Signup */}
              <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-400/20">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold text-white mb-4">Stay Updated</h3>
                  <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                    Get the latest career insights, job market trends, and expert tips delivered to your inbox weekly.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                    <Input placeholder="Enter your email" className="bg-white/10 border-white/20" />
                    <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600">
                      Subscribe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="resources">
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4">Free Career Resources</h2>
                <p className="text-xl text-gray-300">
                  Professional tools and templates to boost your job search success
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {FEATURED_RESOURCES.map((resource, index) => (
                  <ResourceCard key={index} resource={resource} />
                ))}
              </div>
              
              {/* Additional Resources */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white">Additional Resources</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Industry Guides
                      </CardTitle>
                      <CardDescription className="text-gray-300">
                        Sector-specific job search strategies and insights
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li>• Technology & Software Development</li>
                        <li>• Finance & Banking</li>
                        <li>• Healthcare & Medical</li>
                        <li>• Marketing & Communications</li>
                        <li>• Education & Training</li>
                      </ul>
                      <Button variant="outline" size="sm" className="mt-4">
                        Explore Guides
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Location Insights
                      </CardTitle>
                      <CardDescription className="text-gray-300">
                        Job market analysis by South African cities
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li>• Cape Town Job Market</li>
                        <li>• Johannesburg Opportunities</li>
                        <li>• Durban Career Scene</li>
                        <li>• Port Elizabeth Guide</li>
                        <li>• Remote Work Options</li>
                      </ul>
                      <Button variant="outline" size="sm" className="mt-4">
                        View Insights
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
