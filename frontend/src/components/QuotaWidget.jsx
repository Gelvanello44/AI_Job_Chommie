import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useUserQuotaQuery, useQuotaAnalyticsQuery, usePlanFeatures, PLAN_TIERS } from '@/hooks/useQuotaManagement'
import { TrendingUp, Calendar, Zap, Crown, AlertTriangle, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export function QuotaUsageWidget() {
  const { data: quota, isLoading } = useUserQuotaQuery()
  const { data: analytics } = useQuotaAnalyticsQuery()
  const { plan } = usePlanFeatures()

  if (isLoading || !quota) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="text-gray-300">Loading quota...</div>
        </CardContent>
      </Card>
    )
  }

  const utilizationPercentage = (quota.quotaUsed / plan.monthlyQuota) * 100

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg">This Month's Usage</CardTitle>
          <Badge variant="outline" className="text-cyan-400 border-cyan-400">
            {plan.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">Auto Applications</span>
            <span className="text-white font-medium">
              {quota.quotaUsed} / {plan.monthlyQuota}
            </span>
          </div>
          <Progress 
            value={utilizationPercentage} 
            className="h-2"
            // Change color based on usage
            style={{
              '--progress-foreground': utilizationPercentage > 80 ? '#ef4444' : 
                                      utilizationPercentage > 60 ? '#f59e0b' : '#06b6d4'
            }}
          />
          <div className="text-xs text-gray-400 mt-1">
            {quota.quotaRemaining} applications remaining
          </div>
        </div>

        {analytics && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
            <div className="text-center">
              <div className="text-sm text-gray-400">Days Remaining</div>
              <div className="text-white font-semibold">{analytics.remainingDays}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400">Projected Usage</div>
              <div className="text-white font-semibold">{analytics.projectedMonthlyUsage}</div>
            </div>
          </div>
        )}

        {quota.quotaRemaining === 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Quota Exhausted</span>
            </div>
            <p className="text-gray-300 text-sm mt-1">
              You've used all your applications for this month. Upgrade for more opportunities!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function UpcomingApplicationsWidget() {
  const { data: quota } = useUserQuotaQuery()

  if (!quota?.upcomingApplications?.length) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-300">No scheduled applications</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Applications
        </CardTitle>
        <CardDescription className="text-gray-300">
          Auto applications scheduled to be sent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {quota.upcomingApplications.slice(0, 3).map((app, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
              <div>
                <div className="text-white font-medium">{app.jobTitle}</div>
                <div className="text-gray-400 text-sm">{app.companyName}</div>
              </div>
              <div className="text-cyan-400 text-sm">
                {new Date(app.scheduledFor).toLocaleDateString('en-ZA')}
              </div>
            </div>
          ))}
          {quota.upcomingApplications.length > 3 && (
            <div className="text-center">
              <span className="text-gray-400 text-sm">
                +{quota.upcomingApplications.length - 3} more scheduled
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function QuotaAnalyticsWidget() {
  const { data: analytics, isLoading } = useQuotaAnalyticsQuery()

  if (isLoading || !analytics) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="text-gray-300">Loading analytics...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Usage Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-black/20 rounded-lg">
            <div className="text-2xl font-bold text-cyan-400">{analytics.utilizationRate.toFixed(0)}%</div>
            <div className="text-sm text-gray-300">Utilization Rate</div>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg">
            <div className="text-2xl font-bold text-white">{analytics.averageDailyUsage.toFixed(1)}</div>
            <div className="text-sm text-gray-300">Daily Average</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Usage Pattern</span>
            <Badge variant={analytics.usagePattern.pattern === 'consistent' ? 'default' : 'secondary'}>
              {analytics.usagePattern.pattern}
            </Badge>
          </div>
          <div className="text-sm text-gray-400">
            {analytics.usagePattern.description}
          </div>
        </div>

        {analytics.recommendedUpgrade.recommended && (
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Crown className="h-4 w-4" />
              <span className="font-medium">Upgrade Recommended</span>
            </div>
            <p className="text-gray-300 text-sm mb-3">{analytics.recommendedUpgrade.reason}</p>
            <div className="space-y-1">
              {analytics.recommendedUpgrade.benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span className="text-gray-300">{benefit}</span>
                </div>
              ))}
            </div>
            <Link to="/payment">
              <Button size="sm" className="w-full mt-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                Upgrade to {PLAN_TIERS[analytics.recommendedUpgrade.plan.toUpperCase()]?.name}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CompactQuotaMeter() {
  const { data: quota, isLoading } = useUserQuotaQuery()
  const { plan } = usePlanFeatures()

  if (isLoading || !quota) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
        <div className="text-gray-300 text-sm">Loading...</div>
      </div>
    )
  }

  const utilizationPercentage = (quota.quotaUsed / plan.monthlyQuota) * 100

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-white font-medium text-sm">Monthly Quota</div>
        <Badge variant="outline" className="text-xs">
          {plan.id}
        </Badge>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">Applications</span>
          <span className="text-white text-sm">
            {quota.quotaUsed} / {plan.monthlyQuota}
          </span>
        </div>
        <Progress value={utilizationPercentage} className="h-1" />
        {quota.quotaRemaining <= 1 && quota.quotaRemaining > 0 && (
          <div className="flex items-center gap-1 text-yellow-400 text-xs">
            <Zap className="h-3 w-3" />
            <span>Running low on applications!</span>
          </div>
        )}
        {quota.quotaRemaining === 0 && (
          <div className="flex items-center gap-1 text-red-400 text-xs">
            <AlertTriangle className="h-3 w-3" />
            <span>Quota exhausted for this month</span>
          </div>
        )}
      </div>
    </div>
  )
}
