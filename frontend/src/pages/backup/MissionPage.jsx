import React from 'react';
import { motion } from 'framer-motion';
import { Target, Heart, Globe, Users, Sparkles, TrendingUp, Shield, Zap } from 'lucide-react';

const MissionPage = () => {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const values = [
    {
      icon: Heart,
      title: "Human-Centered AI",
      description: "We believe technology should amplify human potential, not replace it. Every algorithm we deploy is designed to empower job seekers and create meaningful connections."
    },
    {
      icon: Globe,
      title: "Inclusive Opportunity",
      description: "Breaking down barriers across South Africa and beyond. We're committed to making quality employment accessible to everyone, regardless of background or location."
    },
    {
      icon: Shield,
      title: "Ethical Innovation",
      description: "Your data, your trust, our responsibility. We pioneer AI solutions that respect privacy, eliminate bias, and promote fair hiring practices."
    },
    {
      icon: Zap,
      title: "Continuous Evolution",
      description: "In 2025's rapidly changing job market, we stay ahead. Our AI learns and adapts daily, ensuring you always have cutting-edge tools for career success."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-cyan-900/20 pt-20">
      {/* Hero Section */}
      <motion.section 
        className="relative py-20 px-4 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-cyan-400/10 rounded-full"
              initial={{
                x: Math.random() * 100 + '%',
                y: Math.random() * 100 + '%',
              }}
              animate={{
                y: [null, '-100%'],
              }}
              transition={{
                duration: Math.random() * 20 + 20,
                repeat: Infinity,
                delay: Math.random() * 10,
                ease: 'linear'
              }}
            />
          ))}
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div {...fadeIn} className="text-center mb-16">
            <div className="inline-flex items-center justify-center mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="relative"
              >
                <Target className="h-20 w-20 text-cyan-400" />
                <Sparkles className="h-12 w-12 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </motion.div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-6">
              Our Mission
            </h1>
            
            <p className="text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              To revolutionize South Africa's employment landscape by making AI-powered career advancement 
              accessible, ethical, and transformative for every job seeker in 2025 and beyond.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Vision Statement */}
      <motion.section 
        className="py-16 px-4 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl font-bold text-cyan-400 mb-6">The Vision That Drives Us</h2>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Picture a South Africa where every graduate finds their perfect role within weeks, not years. 
                Where experienced professionals pivot careers seamlessly. Where hidden talents are discovered 
                and nurtured by AI that truly understands human potential.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                This isn't just a dream—it's what we're building every single day. By 2025, we've already 
                helped thousands transform their careers. But we're just getting started.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed">
                Our vision extends beyond job matching. We're creating an ecosystem where AI becomes your 
                personal career advocate, negotiating salaries, identifying skill gaps, and even predicting 
                industry shifts before they happen.
              </p>
            </motion.div>
            
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl p-8 backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <Users className="h-8 w-8 text-cyan-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">500,000+ Lives Impacted</h3>
                      <p className="text-gray-400">Our goal by end of 2025: Transform half a million careers across Southern Africa</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <TrendingUp className="h-8 w-8 text-purple-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">85% Success Rate</h3>
                      <p className="text-gray-400">Job seekers using our AI find suitable employment 3x faster than traditional methods</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <Globe className="h-8 w-8 text-cyan-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Pan-African Expansion</h3>
                      <p className="text-gray-400">Launching in Kenya, Nigeria, and Egypt by Q3 2025</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Core Values */}
      <motion.section 
        className="py-16 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-4">Our Core Values</h2>
            <p className="text-xl text-gray-400">The principles that guide every line of code we write</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-cyan-500/50 transition-all duration-300 hover:transform hover:scale-105"
              >
                <value.icon className="h-12 w-12 text-cyan-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">{value.title}</h3>
                <p className="text-gray-400 leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Impact Statement */}
      <motion.section 
        className="py-16 px-4 bg-gradient-to-r from-cyan-900/30 to-purple-900/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <motion.h2 
            className="text-4xl font-bold text-white mb-8"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
          >
            Making Real Impact in 2025
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-black/30 rounded-xl p-6"
            >
              <div className="text-5xl font-bold text-cyan-400 mb-2">73%</div>
              <p className="text-gray-300">Reduction in time-to-hire for partner companies</p>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-black/30 rounded-xl p-6"
            >
              <div className="text-5xl font-bold text-purple-400 mb-2">R2.3M</div>
              <p className="text-gray-300">Average salary increase for users after AI-optimized applications</p>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-black/30 rounded-xl p-6"
            >
              <div className="text-5xl font-bold text-cyan-400 mb-2">24/7</div>
              <p className="text-gray-300">AI support ensuring no opportunity is ever missed</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <p className="text-lg text-gray-300 leading-relaxed italic">
              "Every morning, we wake up knowing that somewhere in South Africa, a young graduate is landing 
              their dream job, a single parent is finding flexible work that changes their family's future, 
              or a seasoned professional is discovering a career path they never knew existed—all because 
              of the AI we've built. That's not just our mission; it's our privilege."
            </p>
            <p className="text-cyan-400 mt-4 font-semibold">
              — The AI Job Chommie Team, 2025
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Call to Action */}
      <motion.section 
        className="py-20 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Join Our Mission</h2>
          <p className="text-xl text-gray-300 mb-8">
            Whether you're a job seeker, employer, or innovator, there's a place for you in our mission 
            to transform careers through ethical AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              href="/signup"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-300"
            >
              Start Your Journey
            </motion.a>
            <motion.a
              href="/contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-800/50 text-white px-8 py-4 rounded-xl font-semibold text-lg border border-gray-700 hover:border-cyan-500 transition-all duration-300"
            >
              Partner With Us
            </motion.a>
          </div>
        </div>
      </motion.section>
    </div>
  );
};

export default MissionPage;
