import React, { useState } from 'react';
import { Tag, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const CouponInput = ({ onApply, currentDiscount = null }) => {
  const [couponCode, setCouponCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(currentDiscount);
  const [error, setError] = useState('');

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock validation logic
      const validCoupons = {
        'SAVE20': { discount: 20, type: 'percentage', description: '20% off' },
        'LAUNCH50': { discount: 50, type: 'percentage', description: '50% off - Launch Special' },
        'FRIEND10': { discount: 10, type: 'fixed', description: '$10 off' },
        'NEWUSER': { discount: 15, type: 'percentage', description: '15% off for new users' }
      };

      const coupon = validCoupons[couponCode.toUpperCase()];
      
      if (coupon) {
        setAppliedCoupon({
          code: couponCode.toUpperCase(),
          ...coupon
        });
        setCouponCode('');
        toast.success(`Coupon applied! ${coupon.description}`);
        
        if (onApply) {
          onApply(couponCode.toUpperCase(), coupon);
        }
      } else {
        setError('Invalid or expired coupon code');
      }
    } catch (error) {
      setError('Failed to validate coupon. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    toast.info('Coupon removed');
    if (onApply) {
      onApply(null, null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600">
            <Tag className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white">Have a coupon?</h3>
        </div>

        <AnimatePresence mode="wait">
          {!appliedCoupon ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      validateCoupon();
                    }
                  }}
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50 transition-all uppercase"
                  disabled={isValidating}
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={validateCoupon}
                  disabled={isValidating}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg transition-all disabled:opacity-50"
                  style={{ boxShadow: '0 5px 15px rgba(0, 212, 255, 0.3)' }}
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </motion.button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm"
                >
                  <XCircle className="h-4 w-4" />
                  {error}
                </motion.div>
              )}

              {/* Sample Coupons for Demo */}
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-2">Try these codes:</p>
                <div className="flex flex-wrap gap-2">
                  {['SAVE20', 'LAUNCH50', 'NEWUSER'].map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        setCouponCode(code);
                        setError('');
                      }}
                      className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-gray-400 hover:text-white transition-all"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="applied"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-white font-medium">{appliedCoupon.code}</p>
                    <p className="text-sm text-gray-400">{appliedCoupon.description}</p>
                  </div>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Discount Applied:</span>
                <span className="text-xl font-bold text-green-400">
                  {appliedCoupon.type === 'percentage' 
                    ? `-${appliedCoupon.discount}%`
                    : `-$${appliedCoupon.discount}`
                  }
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Promo Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20"
      >
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
            <Tag className="h-3 w-3 text-white" />
          </div>
          <div>
            <h4 className="text-white font-medium text-sm">Limited Time Offer!</h4>
            <p className="text-xs text-gray-400 mt-1">
              Use code LAUNCH50 for 50% off your first month. Offer ends soon!
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CouponInput;
