import React from 'react';
import PageWrapper from '../../components/PageWrapper';
import { motion } from 'framer-motion';
import { Lock, Shield, User, Key, Mail } from 'lucide-react';

const ForgotPassword = () => {
  return (
    <PageWrapper
      title="Reset Password"
      subtitle="Recover access to your account"
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
          {/* Existing ForgotPassword content goes here */}
          <div className="text-center py-12">
            <Shield className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Reset Password</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Recover access to your account</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default ForgotPassword;
