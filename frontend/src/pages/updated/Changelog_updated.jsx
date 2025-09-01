import React from 'react';
import PageWrapper from '../../components/PageWrapper';
import { motion } from 'framer-motion';
import { Book, HelpCircle, Code, FileText, Globe } from 'lucide-react';

const Changelog = () => {
  return (
    <PageWrapper
      title="Platform Updates"
      subtitle="Latest features and improvements"
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
          {/* Existing Changelog content goes here */}
          <div className="text-center py-12">
            <Book className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Platform Updates</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Latest features and improvements</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default Changelog;
