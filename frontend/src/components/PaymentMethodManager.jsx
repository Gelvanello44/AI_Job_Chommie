import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Shield, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const PaymentMethodManager = () => {
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: '1',
      type: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2025,
      isDefault: true,
      brand: 'Visa'
    },
    {
      id: '2',
      type: 'mastercard',
      last4: '5555',
      expMonth: 6,
      expYear: 2024,
      isDefault: false,
      brand: 'Mastercard'
    }
  ]);

  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({
    number: '',
    expMonth: '',
    expYear: '',
    cvc: '',
    name: '',
    zip: ''
  });

  const cardBrandColors = {
    visa: 'from-blue-500 to-blue-600',
    mastercard: 'from-red-500 to-orange-500',
    amex: 'from-green-500 to-teal-500',
    discover: 'from-orange-500 to-yellow-500'
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const detectCardBrand = (number) => {
    const patterns = {
      visa: /^4/,
      mastercard: /^5[1-5]/,
      amex: /^3[47]/,
      discover: /^6(?:011|5)/
    };

    for (const [brand, pattern] of Object.entries(patterns)) {
      if (pattern.test(number.replace(/\s/g, ''))) {
        return brand;
      }
    }
    return 'visa';
  };

  const handleAddCard = async () => {
    try {
      // Validate card
      if (!newCard.number || !newCard.expMonth || !newCard.expYear || !newCard.cvc) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Simulate API call
      const brand = detectCardBrand(newCard.number);
      const last4 = newCard.number.replace(/\s/g, '').slice(-4);
      
      const newMethod = {
        id: Date.now().toString(),
        type: brand,
        last4,
        expMonth: parseInt(newCard.expMonth),
        expYear: parseInt(newCard.expYear),
        isDefault: paymentMethods.length === 0,
        brand: brand.charAt(0).toUpperCase() + brand.slice(1)
      };

      setPaymentMethods([...paymentMethods, newMethod]);
      setShowAddCard(false);
      setNewCard({ number: '', expMonth: '', expYear: '', cvc: '', name: '', zip: '' });
      toast.success('Payment method added successfully');
    } catch (error) {
      toast.error('Failed to add payment method');
    }
  };

  const removePaymentMethod = async (id) => {
    try {
      setPaymentMethods(paymentMethods.filter(method => method.id !== id));
      toast.success('Payment method removed');
    } catch (error) {
      toast.error('Failed to remove payment method');
    }
  };

  const setDefaultPaymentMethod = async (id) => {
    try {
      setPaymentMethods(paymentMethods.map(method => ({
        ...method,
        isDefault: method.id === id
      })));
      toast.success('Default payment method updated');
    } catch (error) {
      toast.error('Failed to update default payment method');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Payment Methods</h2>
          <p className="text-gray-400 mt-1">Manage your payment methods and billing information</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddCard(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:shadow-lg transition-all"
          style={{ boxShadow: '0 10px 30px rgba(0, 212, 255, 0.3)' }}
        >
          <Plus className="h-5 w-5" />
          Add Card
        </motion.button>
      </div>

      {/* Payment Methods List */}
      <div className="grid gap-4">
        <AnimatePresence>
          {paymentMethods.map((method, index) => (
            <motion.div
              key={method.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${cardBrandColors[method.type]} shadow-lg`}>
                    <CreditCard className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        {method.brand} •••• {method.last4}
                      </h3>
                      {method.isDefault && (
                        <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDefaultPaymentMethod(method.id)}
                      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-sm"
                    >
                      Set Default
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => removePaymentMethod(method.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {paymentMethods.length === 0 && (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No payment methods added yet</p>
            <button
              onClick={() => setShowAddCard(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              Add your first card
            </button>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-400 mt-0.5" />
          <div>
            <h4 className="text-white font-medium">Your payment information is secure</h4>
            <p className="text-sm text-gray-400 mt-1">
              We use industry-standard encryption and never store your full card details. All transactions are processed through secure payment gateways.
            </p>
          </div>
        </div>
      </div>

      {/* Add Card Modal */}
      <AnimatePresence>
        {showAddCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddCard(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-[#1a1f3a] to-[#131829] rounded-2xl p-8 max-w-md w-full border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-6">Add Payment Method</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={newCard.number}
                    onChange={(e) => setNewCard({ ...newCard, number: formatCardNumber(e.target.value) })}
                    maxLength={19}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={newCard.name}
                    onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Month
                    </label>
                    <input
                      type="text"
                      placeholder="MM"
                      value={newCard.expMonth}
                      onChange={(e) => setNewCard({ ...newCard, expMonth: e.target.value })}
                      maxLength={2}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Year
                    </label>
                    <input
                      type="text"
                      placeholder="YYYY"
                      value={newCard.expYear}
                      onChange={(e) => setNewCard({ ...newCard, expYear: e.target.value })}
                      maxLength={4}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      value={newCard.cvc}
                      onChange={(e) => setNewCard({ ...newCard, cvc: e.target.value })}
                      maxLength={4}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    placeholder="12345"
                    value={newCard.zip}
                    onChange={(e) => setNewCard({ ...newCard, zip: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowAddCard(false)}
                    className="flex-1 py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCard}
                    className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:shadow-lg transition-all"
                    style={{ boxShadow: '0 10px 30px rgba(0, 212, 255, 0.3)' }}
                  >
                    Add Card
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PaymentMethodManager;
