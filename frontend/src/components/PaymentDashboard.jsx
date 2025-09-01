import React, { useState, useEffect } from 'react'
import { CreditCard, Calendar, Check, X, Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { apiGet, apiDelete } from '@/lib/apiClient'
import { useAuth } from '@/context/AuthContext'

export default function PaymentDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [transactions, setTransactions] = useState([])
  const [activeTab, setActiveTab] = useState('subscriptions')
  
  useEffect(() => {
    loadPaymentData()
  }, [])
  
  const loadPaymentData = async () => {
    try {
      setLoading(true)
      const [providersData, subsData, transData] = await Promise.all([
        apiGet('/payment/providers'),
        apiGet('/payment/subscriptions'),
        apiGet('/payment/transactions', { limit: 10 })
      ])
      
      setProviders(providersData.providers || [])
      setSubscriptions(subsData.data || [])
      setTransactions(transData.data?.transactions || [])
    } catch (error) {
      console.error('Error loading payment data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const cancelSubscription = async (subscriptionId, provider) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return
    
    try {
      await apiDelete(`/payment/subscription/${subscriptionId}`, { provider })
      await loadPaymentData()
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      alert('Failed to cancel subscription. Please try again.')
    }
  }
  
  const getProviderIcon = (provider) => {
    const icons = {
      paystack: '',
      yoco: ''
    }
    return icons[provider?.toLowerCase()] || ''
  }
  
  const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-400',
      success: 'text-green-400',
      cancelled: 'text-red-400',
      failed: 'text-red-400',
      paused: 'text-yellow-400',
      pending: 'text-yellow-400'
    }
    return colors[status?.toLowerCase()] || 'text-gray-400'
  }
  
  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header with available providers */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-cyan-400" />
            Payment Providers
          </h2>
          <button 
            onClick={loadPaymentData}
            className="text-gray-400 hover:text-white p-1"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          {providers.map(provider => (
            <div key={provider.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getProviderIcon(provider.id)}</span>
                  <div className="font-medium text-white">{provider.name}</div>
                </div>
                {provider.id === DEFAULT_PAYMENT_PROVIDER && (
                  <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">Default</span>
                )}
              </div>
              <div className="text-sm text-gray-400">
                <div>Currencies: {provider.supportedCurrencies?.join(', ')}</div>
                <div>Countries: {provider.supportedCountries?.join(', ')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-2 px-1 font-medium transition-colors ${
            activeTab === 'subscriptions' 
              ? 'text-cyan-400 border-b-2 border-cyan-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-2 px-1 font-medium transition-colors ${
            activeTab === 'transactions' 
              ? 'text-cyan-400 border-b-2 border-cyan-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Transaction History
        </button>
      </div>
      
      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {subscriptions.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
              <div className="text-gray-400">No active subscriptions</div>
              <Link 
                to="/pricing" 
                className="inline-block mt-4 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                View Plans
              </Link>
            </div>
          ) : (
            subscriptions.map(sub => (
              <div key={sub.id} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{getProviderIcon(sub.provider)}</span>
                      <h3 className="font-semibold text-white">{sub.planCode}</h3>
                      <span className={`text-sm ${getStatusColor(sub.status)}`}>
                        {sub.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>Subscription ID: {sub.subscriptionCode}</div>
                      <div>Provider: {sub.provider}</div>
                      {sub.nextPaymentDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Next payment: {new Date(sub.nextPaymentDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {sub.status === 'ACTIVE' && (
                    <button
                      onClick={() => cancelSubscription(sub.subscriptionCode, sub.provider?.toLowerCase())}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
              <div className="text-gray-400">No transactions yet</div>
            </div>
          ) : (
            <>
              {transactions.map(tx => (
                <div key={tx.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getProviderIcon(tx.provider)}</span>
                      <div>
                        <div className="text-white font-medium">
                          {tx.currency} {(tx.amount / 100).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                      {tx.status === 'SUCCESS' && <Check className="h-4 w-4 text-green-400" />}
                      {tx.status === 'FAILED' && <X className="h-4 w-4 text-red-400" />}
                    </div>
                  </div>
                  
                  {tx.reference && (
                    <div className="mt-2 text-xs text-gray-500">
                      Ref: {tx.reference}
                    </div>
                  )}
                </div>
              ))}
              
              <div className="text-center pt-4">
                <button 
                  onClick={() => {/* Load more transactions */}}
                  className="text-cyan-400 hover:underline text-sm"
                >
                  Load more transactions
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Import DEFAULT_PAYMENT_PROVIDER if needed
import { DEFAULT_PAYMENT_PROVIDER } from '@/lib/config'
import { Link } from 'react-router-dom'
