import React from 'react';
import PageWrapper from '../../components/PageWrapper';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Activity, PieChart, Users } from 'lucide-react';

const Admin = () => {
  return (
    <PageWrapper
      title="Admin Dashboard"
      subtitle="Platform administration and management"
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
          {/* Existing Admin content goes here */}
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Admin Dashboard</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Platform administration and management</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default Admin;
