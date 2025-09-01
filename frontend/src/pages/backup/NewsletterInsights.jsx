import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Bell, Archive, TrendingUp, MapPin, Users, Briefcase, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNewsletterPreferencesQuery, useUpdateNewsletterPreferencesMutation } from '@/hooks/useNewsletter'
import { useJobMarketInsightsQuery } from '@/hooks/useJobMarketInsights'

function EmailPreferences() {
  const { data: preferences, isLoading } = useNewsletterPreferencesQuery()
  const { mutate: updatePreferences, isPending } = useUpdateNewsletterPreferencesMutation()
  const form = useForm({ 
    values: preferences || { 
      monthlyNewsletter: true, 
      weeklyAlerts: false,
      jobMatchNotifications: true,
      marketTrends: true,
      salaryInsights: false,
      companyNews: true
    }
  })

  const handleToggle = (field, value) => {
    const newPrefs = { ...form.getValues(), [field]: value }
    form.setValue(field, value)
    updatePreferences(newPrefs)
  }

  if (isLoading) {
    return <div className="text-gray-300">Loading preferences...</div>
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription className="text-gray-300">
            Choose what job market insights you'd like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">Monthly Newsletter</div>
              <div className="text-gray-400 text-sm">Comprehensive market overview and trends</div>
            </div>
            <Switch 
              checked={form.watch('monthlyNewsletter')}
              onCheckedChange={(checked) => handleToggle('monthlyNewsletter', checked)}
              disabled={isPending}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">Job Match Alerts</div>
              <div className="text-gray-400 text-sm">When new jobs match your preferences</div>
            </div>
            <Switch 
              checked={form.watch('jobMatchNotifications')}
              onCheckedChange={(checked) => handleToggle('jobMatchNotifications', checked)}
              disabled={isPending}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">Market Trend Updates</div>
              <div className="text-gray-400 text-sm">Industry trends and skill demands in SA</div>
            </div>
            <Switch 
              checked={form.watch('marketTrends')}
              onCheckedChange={(checked) => handleToggle('marketTrends', checked)}
              disabled={isPending}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">Company News</div>
              <div className="text-gray-400 text-sm">Updates from companies you're interested in</div>
            </div>
            <Switch 
              checked={form.watch('companyNews')}
              onCheckedChange={(checked) => handleToggle('companyNews', checked)}
              disabled={isPending}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">Salary Insights</div>
              <div className="text-gray-400 text-sm">Pay benchmarks for your roles and location</div>
              <Badge variant="outline" className="text-xs mt-1">Pro Feature</Badge>
            </div>
            <Switch 
              checked={form.watch('salaryInsights')}
              onCheckedChange={(checked) => handleToggle('salaryInsights', checked)}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function NewsletterArchive() {
  const { data: archives, isLoading } = useJobMarketInsightsQuery()
  
  const newsletters = [
    {
      id: 1,
      title: "South African Job Market - January 2025",
      date: "2025-01-15",
      description: "Tech sector growth continues, remote work policies evolving",
      topics: ["Technology", "Remote Work", "Skills Gap"],
      readTime: "5 min read"
    },
    {
      id: 2,
      title: "Year-End Employment Trends 2024",
      date: "2024-12-15", 
      description: "Annual review of hiring patterns across major SA industries",
      topics: ["Annual Review", "Hiring Trends", "Industry Analysis"],
      readTime: "8 min read"
    },
    {
      id: 3,
      title: "Healthcare & Finance Sector Update",
      date: "2024-11-15",
      description: "Growing demand for healthcare workers and fintech specialists",
      topics: ["Healthcare", "Finance", "Skills Demand"],
      readTime: "6 min read"
    }
  ]

  return (
    <div className="space-y-6">
      {newsletters.map((newsletter) => (
        <Card key={newsletter.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-white text-lg">{newsletter.title}</CardTitle>
                <CardDescription className="text-gray-300 mt-2">
                  {newsletter.description}
                </CardDescription>
              </div>
              <div className="text-gray-400 text-sm">
                {new Date(newsletter.date).toLocaleDateString('en-ZA', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                {newsletter.topics.map((topic) => (
                  <Badge key={topic} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
              <div className="text-gray-400 text-sm">
                {newsletter.readTime}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm">
              Read Newsletter
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MarketInsightsCard() {
  const currentInsights = {
    topGrowingRoles: [
      { role: "Software Developer", growth: "+15%", demand: "Very High" },
      { role: "Data Analyst", growth: "+12%", demand: "High" },
      { role: "Digital Marketing Specialist", growth: "+8%", demand: "High" }
    ],
    topProvinces: [
      { province: "Gauteng", share: "35%", change: "+2%" },
      { province: "Western Cape", share: "28%", change: "+1%" },
      { province: "KwaZulu-Natal", share: "15%", change: "0%" }
    ],
    industryTrends: [
      { industry: "Technology", trend: "Growing", indicator: "up" },
      { industry: "Healthcare", trend: "Stable", indicator: "neutral" },
      { industry: "Manufacturing", trend: "Recovering", indicator: "up" }
    ],
    remoteWorkData: {
      percentage: "42%",
      change: "+5%",
      trend: "Increasing adoption of hybrid models"
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            Fastest Growing Roles
          </CardTitle>
          <CardDescription className="text-gray-300">
            In South Africa this month
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentInsights.topGrowingRoles.map((role, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="text-white">{role.role}</div>
              <div className="flex items-center gap-2">
                <Badge variant={role.demand === 'Very High' ? 'default' : 'secondary'} className="text-xs">
                  {role.demand}
                </Badge>
                <span className="text-cyan-400 font-medium">{role.growth}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-cyan-400" />
            Top Job Markets
          </CardTitle>
          <CardDescription className="text-gray-300">
            By province employment share
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentInsights.topProvinces.map((province, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="text-white">{province.province}</div>
              <div className="flex items-center gap-2">
                <span className="text-gray-300">{province.share}</span>
                <span className="text-cyan-400 font-medium">{province.change}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-cyan-400" />
            Industry Outlook
          </CardTitle>
          <CardDescription className="text-gray-300">
            Current sector performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentInsights.industryTrends.map((industry, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="text-white">{industry.industry}</div>
              <div className="flex items-center gap-2">
                <span className="text-gray-300">{industry.trend}</span>
                {industry.indicator === 'up' && <TrendingUp className="h-4 w-4 text-green-400" />}
                {industry.indicator === 'neutral' && <div className="h-4 w-4 rounded-full bg-yellow-400"></div>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            Remote Work Trends
          </CardTitle>
          <CardDescription className="text-gray-300">
            Work arrangement preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold text-cyan-400 mb-2">
              {currentInsights.remoteWorkData.percentage}
            </div>
            <div className="text-white mb-2">
              of jobs offer remote options
            </div>
            <div className="text-cyan-400 text-sm mb-2">
              {currentInsights.remoteWorkData.change} from last month
            </div>
            <div className="text-gray-300 text-sm">
              {currentInsights.remoteWorkData.trend}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewsletterInsights() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Job Market Insights</h1>
          <p className="text-xl text-gray-300">
            Stay informed with South Africa-focused employment trends and market data
          </p>
        </div>
        
        <Tabs defaultValue="current" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
            <TabsTrigger value="current" className="data-[state=active]:bg-cyan-500">
              Current Insights
            </TabsTrigger>
            <TabsTrigger value="archive" className="data-[state=active]:bg-cyan-500">
              Newsletter Archive
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-cyan-500">
              Email Preferences
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="current" className="space-y-6">
            <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Latest Market Update - January 2025
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Key trends and opportunities in the South African job market
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">12.5K</div>
                    <div className="text-gray-300 text-sm">New jobs posted</div>
                    <div className="text-green-400 text-xs">+8% vs last month</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">15%</div>
                    <div className="text-gray-300 text-sm">Tech sector growth</div>
                    <div className="text-green-400 text-xs">Highest in 2 years</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">R32K</div>
                    <div className="text-gray-300 text-sm">Median salary</div>
                    <div className="text-gray-400 text-xs">Entry-level positions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <MarketInsightsCard />
          </TabsContent>
          
          <TabsContent value="archive" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Newsletter Archive</h2>
                <p className="text-gray-300">Browse past market insights and trend reports</p>
              </div>
              <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                15 newsletters available
              </Badge>
            </div>
            
            <NewsletterArchive />
          </TabsContent>
          
          <TabsContent value="preferences" className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Email Preferences</h2>
              <p className="text-gray-300">Customize what job market information you receive</p>
            </div>
            
            <EmailPreferences />
            
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">You're subscribed!</span>
                </div>
                <p className="text-gray-300 text-sm">
                  Your preferences are automatically saved. You can unsubscribe at any time 
                  using the link in any email we send you.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
