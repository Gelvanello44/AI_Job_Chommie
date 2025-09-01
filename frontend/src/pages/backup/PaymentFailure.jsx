import React from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { XCircle, AlertTriangle, RefreshCw, CreditCard, Phone, Mail, ArrowRight, Home } from 'lucide-react'
import { PLAN_FEATURES } from '@/lib/planFeatures'
import { PLAN_PRICES_ZAR } from '@/lib/config'

export default function PaymentFailure() {
  const [searchParams] = useSearchParams()
  
  const plan = searchParams.get('plan') || 'pro'
  const error = searchParams.get('error') || 'Payment was declined'
  const reference = searchParams.get('reference')
  
  const planDetails = PLAN_FEATURES[plan]
  const planPrice = PLAN_PRICES_ZAR[plan]

  const commonSolutions = [
    {
      icon: CreditCard,
      title: "Check your card details",
      description: "Ensure your card number, expiry date, and CVV are entered correctly"
    },
    {
      icon: AlertTriangle,
      title: "Verify sufficient funds",
      description: "Make sure you have enough available balance or credit limit"
    },
    {
      icon: Phone,
      title: "Contact your bank",
      description: "Your bank might have blocked the transaction for security reasons"
    },
    {
      icon: RefreshCw,
      title: "Try again later",
      description: "Sometimes temporary issues resolve themselves within a few minutes"
    }
  ]

  const supportOptions = [
    {
      method: "Email",
      contact: "support@aijobchommie.com",
      description: "Get help via email within 24 hours",
      icon: Mail
    },
    {
      method: "Phone",
      contact: "+27 11 123 4567",
      description: "Speak to our support team directly",
      icon: Phone
    }
  ]

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        {/* Failure Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 border border-red-500/30 rounded-full mb-6">
            <XCircle className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Payment Failed</h1>
          <p className="text-xl text-gray-300 mb-2">We couldn't process your payment</p>
          <p className="text-gray-400">Don't worry - this happens sometimes and is usually easy to fix</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Payment Details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="h-6 w-6 text-red-400" />
              <h2 className="text-xl font-semibold text-white">Payment Details</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-400">Plan</span>
                <span className="text-white font-medium">{planDetails.name}</span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-400">Amount</span>
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
                <span className="inline-flex items-center gap-2 text-red-400 font-medium">
                  <XCircle className="h-4 w-4" />
                  Failed
                </span>
              </div>
            </div>

            {/* Error Message */}
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Payment Issue</span>
              </div>
              <p className="text-sm text-gray-300">{error}</p>
            </div>
          </div>

          {/* Common Solutions */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Common Solutions</h2>
            
            <div className="space-y-4">
              {commonSolutions.map((solution, index) => {
                const IconComponent = solution.icon
                return (
                  <div key={index} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <IconComponent className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium mb-1">{solution.title}</h3>
                      <p className="text-gray-400 text-sm">{solution.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            to={`/payment?plan=${plan}&variant=yoco`}
            className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
            Try Payment Again
          </Link>
          
          <Link
            to={`/payment?plan=${plan}&variant=bank`}
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Use Bank Transfer Instead
          </Link>
          
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border border-white/20 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Back to Pricing
          </Link>
        </div>

        {/* Alternative Payment Methods */}
        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Alternative Payment Methods</h2>
          <p className="text-gray-300 mb-6">
            If you're having trouble with card payments, you can also pay via bank transfer to the following account:
          </p>
          
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-white font-semibold mb-3">Bank Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bank:</span>
                    <span className="text-white">Capitec Bank</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account Name:</span>
                    <span className="text-white">AI Job Chommie</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account Number:</span>
                    <span className="text-white">1234567890</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Branch Code:</span>
                    <span className="text-white">470010</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-white font-semibold mb-3">Payment Reference</h3>
                <div className="bg-white/10 rounded p-3 mb-3">
                  <code className="text-cyan-400 font-mono text-sm">
                    {`AJC-${plan.toUpperCase()}-${Date.now().toString().slice(-6)}`}
                  </code>
                </div>
                <p className="text-xs text-gray-400">
                  Use this reference when making the payment so we can activate your subscription automatically.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Support Options */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Need Help?</h2>
          <p className="text-gray-300 mb-6">
            If you're still having issues, our support team is here to help you get your subscription activated.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            {supportOptions.map((support, index) => {
              const IconComponent = support.icon
              return (
                <div key={index} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <IconComponent className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{support.method}</h3>
                    <p className="text-cyan-400 font-mono text-sm mb-2">{support.contact}</p>
                    <p className="text-gray-400 text-sm">{support.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-12">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Home className="h-5 w-5" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
