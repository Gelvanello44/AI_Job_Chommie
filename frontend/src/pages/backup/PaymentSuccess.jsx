import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Check, CheckCircle, ArrowRight, Home, CreditCard, Calendar, Clock } from 'lucide-react'
import { PLAN_FEATURES } from '@/lib/planFeatures'
import { PLAN_PRICES_ZAR } from '@/lib/config'

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  
  const plan = searchParams.get('plan') || 'pro'
  const paymentId = searchParams.get('payment_id')
  const reference = searchParams.get('reference')
  
  const planDetails = PLAN_FEATURES[plan]
  const planPrice = PLAN_PRICES_ZAR[plan]

  useEffect(() => {
    // Simulate loading state for better UX
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Processing your payment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full mb-6">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Payment Successful!</h1>
          <p className="text-xl text-gray-300 mb-2">Welcome to {planDetails.name}</p>
          <p className="text-gray-400">Your subscription is now active and ready to use</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Payment Details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="h-6 w-6 text-green-400" />
              <h2 className="text-xl font-semibold text-white">Payment Details</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-400">Plan</span>
                <span className="text-white font-medium">{planDetails.name}</span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-400">Amount Paid</span>
                <span className="text-white font-medium">R{planPrice}</span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-400">Payment Method</span>
                <span className="text-white font-medium">Yoco</span>
              </div>
              
              {reference && (
                <div className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-gray-400">Reference</span>
                  <span className="text-white font-medium text-sm">{reference}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-400">Status</span>
                <span className="inline-flex items-center gap-2 text-green-400 font-medium">
                  <Check className="h-4 w-4" />
                  Confirmed
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="h-6 w-6 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Subscription Details</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-400">Billing Cycle</span>
                <span className="text-white font-medium">Monthly</span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-400">Next Billing Date</span>
                <span className="text-white font-medium">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-400">Auto-renewal</span>
                <span className="text-white font-medium">Enabled</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-cyan-400 mb-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Activation Notice</span>
              </div>
              <p className="text-sm text-gray-300">
                Your subscription features will be available within the next 5 minutes. 
                You'll receive a confirmation email shortly.
              </p>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">What's Next?</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Complete Your Profile</h3>
                  <p className="text-gray-400 text-sm">Add your skills, experience, and job preferences for better matching</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Upload Your CV</h3>
                  <p className="text-gray-400 text-sm">Let our AI analyze and optimize your CV for better job matches</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Set Up Job Alerts</h3>
                  <p className="text-gray-400 text-sm">Get notified about relevant job opportunities as they become available</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white font-bold text-sm">4</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Start Applying</h3>
                  <p className="text-gray-400 text-sm">Use one-click applications and AI-powered cover letters</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Go to Dashboard
            <ArrowRight className="h-5 w-5" />
          </Link>
          
          <Link
            to="/subscription"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Manage Subscription
          </Link>
          
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border border-white/20 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            <Home className="h-5 w-5" />
            Back to Home
          </Link>
        </div>

        {/* Receipt Notice */}
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">
            A payment receipt and welcome email will be sent to your registered email address.
          </p>
        </div>
      </div>
    </div>
  )
}
