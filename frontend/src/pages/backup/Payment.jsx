import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { YOCO_PUBLIC_KEY, PAYSTACK_PUBLIC_KEY, PLAN_PRICES_ZAR, BUSINESS_INFO, DEFAULT_PAYMENT_PROVIDER } from '@/lib/config'
import { initYocoInline, initPaystackInline, initiatePayment } from '@/lib/payments'
import BankTransferDetails from '@/components/BankTransferDetails'
import { Check, Loader2 } from 'lucide-react'
import { PLAN_FEATURES } from '@/lib/planFeatures'
import QuotaBanner from '@/components/QuotaBanner'

export default function Payment() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const plan = params.get('plan') || 'pro'
  const variant = params.get('variant') || (DEFAULT_PAYMENT_PROVIDER === 'yoco' ? 'yoco' : 'paystack') // or 'bank'

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const amountZar = PLAN_PRICES_ZAR[plan] ?? 0
  const planDetails = PLAN_FEATURES[plan]

  const features = useMemo(() => {
    return Object.entries(planDetails.features).filter(([k,v]) => v?.enabled).map(([k]) => k)
  }, [planDetails])

  const payWithYoco = async () => {
    setError('')
    setIsProcessing(true)
    const reference = `AJC-${plan}-${Date.now()}`
    try {
      await initYocoInline({
        key: YOCO_PUBLIC_KEY,
        email: 'customer@example.com', // replace with authenticated user's email when available
        amountCents: amountZar * 100, // ZAR cents
        reference,
        metadata: { plan },
        onSuccess: (payment) => {
          setIsProcessing(false)
          navigate(`/payment?status=success&plan=${plan}&payment_id=${payment.id}`)
        },
        onCancel: () => {
          setIsProcessing(false)
          navigate(`/payment?status=cancelled&plan=${plan}`)
        },
        onError: (e) => {
          setIsProcessing(false)
          setError(e?.message || 'Payment failed. Please try again or use bank transfer.')
        }
      })
    } catch (e) {
      setIsProcessing(false)
      setError(e?.message || 'Payment failed. Please try again or use bank transfer.')
    }
  }

  const payWithPaystack = async () => {
    setError('')
    setIsProcessing(true)
    const reference = `AJC-${plan}-${Date.now()}`
    try {
      await initPaystackInline({
        key: PAYSTACK_PUBLIC_KEY,
        email: 'customer@example.com', // replace with authenticated user's email when available
        amountKobo: amountZar * 100, // ZAR cents
        reference,
        metadata: { plan },
        onSuccess: () => {
          setIsProcessing(false)
          navigate(`/payment?status=success&plan=${plan}`)
        },
        onCancel: () => {
          setIsProcessing(false)
          navigate(`/payment?status=cancelled&plan=${plan}`)
        },
        onError: (e) => {
          setIsProcessing(false)
          setError(e?.message || 'Payment failed. Please try again or use bank transfer.')
        }
      })
    } catch (e) {
      setIsProcessing(false)
      setError(e?.message || 'Payment failed. Please try again or use bank transfer.')
    }
  }

  const status = params.get('status') // success | cancelled | failed

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Checkout</h1>

        {/* Status banners */}
        {status === 'success' && (
          <div className="mb-4 rounded-lg p-4 bg-green-500/10 border border-green-500/30 text-green-200">Payment successful. Your subscription will activate shortly.</div>
        )}
        {status === 'cancelled' && (
          <div className="mb-4 rounded-lg p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200">Payment cancelled.</div>
        )}
        {status === 'failed' && (
          <div className="mb-4 rounded-lg p-4 bg-red-500/10 border border-red-500/30 text-red-200">Payment failed.</div>
        )}

        {/* Quota context */}
        <QuotaBanner />

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-gray-400 text-sm">Selected plan</div>
            <div className="text-2xl text-white font-semibold">{planDetails.name}</div>
            <div className="text-3xl text-cyan-400 font-bold mt-2">R{amountZar}<span className="text-sm text-gray-400">/mo</span></div>
            <ul className="mt-4 text-gray-300 text-sm space-y-2">
              {features.slice(0,6).map(f => (
                <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> {f.replace(/([A-Z])/g,' $1').replace(/^./, s=>s.toUpperCase())}</li>
              ))}
            </ul>
            <div className="mt-6 text-xs text-gray-400 space-y-1">
              <div>Registered name: {BUSINESS_INFO.registeredName}</div>
              <div>Taxpayer registration number: {BUSINESS_INFO.taxpayerRegistrationNumber}</div>
              <div>Taxpayer reference number: {BUSINESS_INFO.taxpayerReferenceNumber}</div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Yoco Payment Option */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white font-semibold">Yoco {DEFAULT_PAYMENT_PROVIDER === 'yoco' && <span className="text-xs text-cyan-400">(Recommended)</span>}</div>
                <button onClick={()=>navigate(`/payment?plan=${plan}&variant=yoco`)} className={`text-xs px-2 py-1 rounded ${variant==='yoco'?'bg-cyan-500 text-white':'bg-white/10 text-gray-300'}`}>Select</button>
              </div>
              {variant==='yoco' ? (
                <div>
                  <button
                    onClick={payWithYoco}
                    disabled={!YOCO_PUBLIC_KEY || isProcessing}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-800 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />} Pay with Yoco
                  </button>
                  {!YOCO_PUBLIC_KEY && (
                    <div className="mt-2 text-xs text-yellow-300">Yoco key not configured. Set VITE_YOCO_PUBLIC_KEY to enable.</div>
                  )}
                  {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Switch to Yoco for secure South African payment processing.</div>
              )}
            </div>

            {/* Paystack Payment Option */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white font-semibold">Paystack</div>
                <button onClick={()=>navigate(`/payment?plan=${plan}&variant=paystack`)} className={`text-xs px-2 py-1 rounded ${variant==='paystack'?'bg-cyan-500 text-white':'bg-white/10 text-gray-300'}`}>Select</button>
              </div>
              {variant==='paystack' ? (
                <div>
                  <button
                    onClick={payWithPaystack}
                    disabled={!PAYSTACK_PUBLIC_KEY || isProcessing}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-800 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />} Pay with Paystack
                  </button>
                  {!PAYSTACK_PUBLIC_KEY && (
                    <div className="mt-2 text-xs text-yellow-300">Paystack key not configured. Set VITE_PAYSTACK_PUBLIC_KEY to enable.</div>
                  )}
                  {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Switch to Paystack to pay online instantly.</div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white font-semibold">Bank Transfer (Capitec Business)</div>
                <button onClick={()=>navigate(`/payment?plan=${plan}&variant=bank`)} className={`text-xs px-2 py-1 rounded ${variant==='bank'?'bg-cyan-500 text-white':'bg-white/10 text-gray-300'}`}>Select</button>
              </div>
              {variant==='bank' ? (
                <BankTransferDetails amountZar={amountZar} plan={planDetails.name} />
              ) : (
                <div className="text-gray-400 text-sm">Switch to view bank transfer details.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

