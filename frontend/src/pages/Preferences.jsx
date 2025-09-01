import React from 'react';
import PageWrapper from '../components/PageWrapper';
import { motion } from 'framer-motion';
import { User, Settings, Bell, Shield, Edit3 } from 'lucide-react';

const Preferences = () => {
  return (
    <PageWrapper
      title="Preferences"
      subtitle="Tailor the platform to your needs"
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
          {/* Existing Preferences content goes here */}
          <div className="text-center py-12">
            <User className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Preferences</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Tailor the platform to your needs</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default Preferences;
