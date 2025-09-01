import React from 'react';
import PageWrapper from '../components/PageWrapper';
import { motion } from 'framer-motion';
import { CreditCard, DollarSign, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const Payment = () => {
  return (
    <PageWrapper
      title="Payment"
      subtitle="Secure payment processing"
      showBreadcrumbs={true}
      containerSize="max-w-7xl"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
          {/* Existing Payment content goes here */}
          <div className="text-center py-12">
            <CreditCard className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Payment</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Secure payment processing</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default Payment;
