import React from 'react';
import PageWrapper from '../../components/PageWrapper';
import { motion } from 'framer-motion';
import { Globe, Home, Target, Award, Mail } from 'lucide-react';

const HomePage = () => {
  return (
    <PageWrapper
      title="Welcome to AI Job Chommie"
      subtitle="Your intelligent career companion"
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
          {/* Existing HomePage content goes here */}
          <div className="text-center py-12">
            <Globe className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to AI Job Chommie</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Your intelligent career companion</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default HomePage;
