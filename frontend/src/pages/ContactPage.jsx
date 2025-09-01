import React from 'react';
import PageWrapper from '../components/PageWrapper';
import { motion } from 'framer-motion';
import { Globe, Home, Target, Award, Mail } from 'lucide-react';

const ContactPage = () => {
  return (
    <PageWrapper
      title="Contact Us"
      subtitle="Get in touch with our team"
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
          {/* Existing ContactPage content goes here */}
          <div className="text-center py-12">
            <Globe className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Contact Us</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Get in touch with our team</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default ContactPage;
