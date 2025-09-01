import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  FileText, 
  Download, 
  Tag, 
  TrendingUp,
  Calendar,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InvoiceViewer from '../../components/InvoiceViewer';
import PaymentMethodManager from '../../components/PaymentMethodManager';
import CouponInput from '../../components/CouponInput';
import { useAuth } from "../../context/AuthContext";
import { toast } from 'sonner';

const Billing = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [billingData, setBillingData] = useState({
    currentPlan: 'pro',
    nextBillingDate: '2024-02-01',
    amount: 49.99,
    paymentMethod: '**** 4242',
    usage: {
      applications: { used: 245, limit: 500 },
      aiCredits: { used: 1250, limit: 2000 },
      storage: { used: 2.5, limit: 10 }
    }
  });
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
    fetchInvoices();
  }, []);

  const fetchBillingData = async () => {
    try {
      const response = await fetch('/api/billing/overview', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setBillingData(data);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/billing/invoices', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: 0,
      features: ['10 Applications/month', '100 AI Credits', '1 GB Storage'],
      color: 'from-gray-600 to-gray-700'
    },
    {
      name: 'Pro',
      price: 49.99,
      features: ['500 Applications/month', '2000 AI Credits', '10 GB Storage', 'Priority Support'],
      color: 'from-cyan-500 to-blue-600',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 199.99,
      features: ['Unlimited Applications', 'Unlimited AI Credits', '100 GB Storage', '24/7 Support', 'Custom Integrations'],
      color: 'from-purple-500 to-pink-600'
    }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'methods', label: 'Payment Methods', icon: CreditCard },
    { id: 'plans', label: 'Plans', icon: Zap }
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0a0e27' }}>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'pulse 8s ease-in-out infinite'
          }}
        />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 0, 110, 0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'pulse 8s ease-in-out infinite 4s'
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Billing & Subscription</h1>
          <p className="text-gray-400">Manage your subscription, payment methods, and billing history</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                style={{
                  boxShadow: activeTab === tab.id ? '0 0 30px rgba(0, 212, 255, 0.3)' : 'none'
                }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Current Plan Card */}
              <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Current Plan</h3>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium">
                        {billingData.currentPlan.toUpperCase()}
                      </span>
                      <span className="text-gray-400">
                        ${billingData.amount}/month
                      </span>
                    </div>
                  </div>
                  <button className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
                    Change Plan
                  </button>
                </div>

                {/* Usage Meters */}
                <div className="space-y-4">
                  {Object.entries(billingData.usage).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-white">
                          {value.used} / {value.limit} {key === 'storage' ? 'GB' : ''}
                        </span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(value.used / value.limit) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, #00d4ff ${(value.used / value.limit) * 100}%, #ff006e 100%)`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Next Billing */}
                <div className="mt-6 p-4 rounded-lg bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="text-sm text-gray-400">Next billing date</p>
                      <p className="text-white font-medium">{billingData.nextBillingDate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Amount</p>
                    <p className="text-xl font-bold text-white">${billingData.amount}</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left flex items-center gap-3 transition-all group">
                      <Download className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span className="text-white">Download Invoice</span>
                    </button>
                    <button className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left flex items-center gap-3 transition-all group">
                      <CreditCard className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform" />
                      <span className="text-white">Update Payment</span>
                    </button>
                    <button className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left flex items-center gap-3 transition-all group">
                      <Tag className="h-5 w-5 text-pink-400 group-hover:scale-110 transition-transform" />
                      <span className="text-white">Apply Coupon</span>
                    </button>
                  </div>
                </div>

                {/* Coupon Input */}
                <CouponInput onApply={(code) => toast.success(`Coupon ${code} applied!`)} />
              </div>
            </motion.div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <InvoiceViewer invoices={invoices} />
            </motion.div>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 'methods' && (
            <motion.div
              key="methods"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PaymentMethodManager />
            </motion.div>
          )}

          {/* Plans Tab */}
          {activeTab === 'plans' && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border ${
                    plan.popular ? 'border-cyan-500/50' : 'border-white/10'
                  }`}
                  style={{
                    boxShadow: plan.popular ? '0 0 40px rgba(0, 212, 255, 0.2)' : 'none'
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-medium">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <div className="text-4xl font-bold text-white">
                      ${plan.price}
                      <span className="text-lg text-gray-400">/month</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-gray-300">
                        <CheckCircle className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 rounded-lg font-medium transition-all ${
                      plan.popular
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                    style={{
                      boxShadow: plan.popular ? '0 10px 30px rgba(0, 212, 255, 0.3)' : 'none'
                    }}
                  >
                    {billingData.currentPlan.toLowerCase() === plan.name.toLowerCase() 
                      ? 'Current Plan' 
                      : 'Switch to ' + plan.name}
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default Billing;
