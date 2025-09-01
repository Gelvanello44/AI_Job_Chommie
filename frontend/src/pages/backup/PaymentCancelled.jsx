import React from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { XCircle, ArrowLeft, CreditCard, Banknote, Home, Phone, ArrowRight } from 'lucide-react'
import { PLAN_FEATURES } from '@/lib/planFeatures'
import { PLAN_PRICES_ZAR } from '@/lib/config'

export default function PaymentCancelled() {
  const [searchParams] = useSearchParams()
  
  const plan = searchParams.get('plan') || 'pro'
  const planDetails = PLAN_FEATURES[plan]
  const planPrice = PLAN_PRICES_ZAR[plan]

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4">
        {/* Cancelled Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/20 border border-yellow-500/30 rounded-full mb-6">
            <XCircle className="h-10 w-10 text-yellow-400" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Payment Cancelled</h1>
          <p className="text-xl text-gray-300 mb-2">You cancelled the payment process</p>
          <p className="text-gray-400">No charges were made to your account</p>
        </div>

        {/* Plan Summary */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-white mb-2">{planDetails.name}</h2>
            <p className="text-3xl text-cyan-400 font-bold">R{planPrice}<span className="text-lg text-gray-400">/month</span></p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-white font-medium mb-3">What you were getting:</h3>
              <ul className="space-y-2">
                {Object.entries(planDetails.features)
                  .filter(([key, feature]) => feature.enabled)
                  .slice(0, 4)
                  .map(([key, feature]) => (
                    <li key={key} className="flex items-center gap-2 text-gray-300 text-sm">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </li>
                  ))
                }
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-medium mb-3">Why choose {planDetails.name}?</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• Advanced AI job matching</li>
                <li>• Unlimited applications</li>
                <li>• Priority support</li>
                <li>• CV optimization tools</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Options */}
        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-bold text-white text-center">What would you like to do?</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Retry Payment */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Try Payment Again</h3>
                  <p className="text-gray-400 text-sm">Complete your subscription with card payment</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Link
                  to={`/payment?plan=${plan}&variant=yoco`}
                  className="block w-full bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg font-medium text-center transition-colors"
                >
                  Pay with Yoco
                </Link>
                <Link
                  to={`/payment?plan=${plan}&variant=paystack`}
                  className="block w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg font-medium text-center transition-colors"
                >
                  Pay with Paystack
                </Link>
              </div>
            </div>

            {/* Bank Transfer */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Banknote className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Bank Transfer</h3>
                  <p className="text-gray-400 text-sm">Pay directly from your bank account</p>
                </div>
              </div>
              
              <Link
                to={`/payment?plan=${plan}&variant=bank`}
                className="block w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium text-center transition-colors mb-3"
              >
                Get Bank Details
              </Link>
              
              <p className="text-gray-400 text-xs">
                Manual verification required. Activation within 24 hours.
              </p>
            </div>
          </div>
        </div>

        {/* Alternative Actions */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Not ready to subscribe yet?</h2>
          <p className="text-gray-300 mb-6">
            That's okay! You can still explore our platform with the free plan or get in touch to learn more.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              View All Plans
            </Link>
            
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Continue with Free Plan
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Support */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="text-center">
            <h3 className="text-white font-semibold mb-2">Need Help?</h3>
            <p className="text-gray-400 text-sm mb-4">
              If you have questions about our plans or need assistance, we're here to help.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@aijobchommie.com"
                className="inline-flex items-center justify-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <span>support@aijobchommie.com</span>
              </a>
              
              <a
                href="tel:+27111234567"
                className="inline-flex items-center justify-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>+27 11 123 4567</span>
              </a>
            </div>
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
