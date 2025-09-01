import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, Users, Globe, Award, TrendingUp, Shield, 
  Zap, Heart, Target, Code, Briefcase, Star,
  CheckCircle, ArrowRight, Building
} from 'lucide-react';

const AboutPage = () => {
  const stats = [
    { value: "250K+", label: "Active Job Seekers", icon: Users },
    { value: "15K+", label: "Partner Companies", icon: Building },
    { value: "87%", label: "Placement Success Rate", icon: TrendingUp },
    { value: "4.9/5", label: "User Satisfaction", icon: Star }
  ];

  const timeline = [
    { year: "2023", event: "Founded in Johannesburg", description: "Started with a vision to democratize job search" },
    { year: "2024", event: "AI Platform Launch", description: "Deployed advanced ML models for job matching" },
    { year: "2025", event: "Pan-African Expansion", description: "Operating in 12 African countries" }
  ];

  const team = [
    { role: "Engineering", count: 45, focus: "Building cutting-edge AI solutions" },
    { role: "Data Science", count: 28, focus: "Training ethical ML models" },
    { role: "Customer Success", count: 32, focus: "Ensuring every user succeeds" },
    { role: "Partnerships", count: 18, focus: "Connecting with top employers" }
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
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            className="text-center mb-16"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-6">
              About AI Job Chommie
            </h1>
            
            <p className="text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              We're not just another job platform. We're your AI-powered career partner, 
              transforming how Africa connects talent with opportunity in 2025.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-black/30 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50"
              >
                <stat.icon className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* What We Do Section */}
      <motion.section 
        className="py-16 px-4 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12">What We Do</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-xl p-8"
            >
              <Brain className="h-12 w-12 text-cyan-400 mb-4" />
              <h3 className="text-2xl font-semibold text-white mb-4">AI-Powered Matching</h3>
              <p className="text-gray-300 mb-4">
                Our proprietary AI analyzes 200+ data points to match you with perfect opportunities, 
                going beyond keywords to understand context, potential, and cultural fit.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>Semantic understanding of skills</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>Personality-culture alignment</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>Career trajectory prediction</span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-xl p-8"
            >
              <Zap className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-2xl font-semibold text-white mb-4">Career Acceleration</h3>
              <p className="text-gray-300 mb-4">
                We don't just find you a job—we accelerate your entire career with AI-driven insights, 
                skill development recommendations, and strategic guidance.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>Personalized upskilling paths</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>Salary negotiation AI assistant</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>Industry trend predictions</span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-xl p-8"
            >
              <Shield className="h-12 w-12 text-cyan-400 mb-4" />
              <h3 className="text-2xl font-semibold text-white mb-4">Ethical & Inclusive</h3>
              <p className="text-gray-300 mb-4">
                Built with fairness at its core, our AI actively eliminates bias and creates 
                equal opportunities for all, regardless of background.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>Bias-free screening algorithms</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>Anonymous application options</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>Diversity-first matching</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Our Journey */}
      <motion.section 
        className="py-16 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12">Our Journey</h2>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-cyan-400 to-purple-400 hidden md:block"></div>
            
            <div className="space-y-8">
              {timeline.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className={`flex flex-col md:flex-row items-center gap-8 ${
                    index % 2 === 0 ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                      <span className="text-cyan-400 font-bold text-xl">{item.year}</span>
                      <h3 className="text-xl font-semibold text-white mt-2 mb-2">{item.event}</h3>
                      <p className="text-gray-400">{item.description}</p>
                    </div>
                  </div>
                  
                  <div className="w-4 h-4 bg-cyan-400 rounded-full border-4 border-gray-900 relative z-10"></div>
                  
                  <div className="flex-1 hidden md:block"></div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Our Team */}
      <motion.section 
        className="py-16 px-4 bg-gradient-to-r from-cyan-900/30 to-purple-900/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-4">Our Team</h2>
          <p className="text-xl text-center text-gray-400 mb-12">
            123 passionate individuals from 28 countries, united by one mission
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((dept, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-black/30 rounded-xl p-6 text-center"
              >
                <Code className="h-10 w-10 text-cyan-400 mx-auto mb-3" />
                <h3 className="text-xl font-semibold text-white mb-2">{dept.role}</h3>
                <p className="text-3xl font-bold text-cyan-400 mb-2">{dept.count}</p>
                <p className="text-sm text-gray-400">{dept.focus}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-lg text-gray-300 mb-6">
              We're always looking for exceptional talent to join our mission.
            </p>
            <motion.a
              href="/careers"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-xl transition-all duration-300"
            >
              Join Our Team
              <ArrowRight className="h-5 w-5" />
            </motion.a>
          </div>
        </div>
      </motion.section>

      {/* Why Choose Us */}
      <motion.section 
        className="py-16 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12">Why Choose AI Job Chommie?</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="flex gap-4">
                <Target className="h-8 w-8 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Precision Matching</h3>
                  <p className="text-gray-400">
                    Our AI doesn't just match keywords—it understands context, growth potential, 
                    and cultural alignment to find your perfect fit.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Globe className="h-8 w-8 text-purple-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">African-First</h3>
                  <p className="text-gray-400">
                    Built in Africa, for Africa. We understand the unique dynamics of African 
                    job markets and tailor our solutions accordingly.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Heart className="h-8 w-8 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Human-Centric AI</h3>
                  <p className="text-gray-400">
                    Technology serves people, not the other way around. Every feature is 
                    designed to enhance human potential, not replace it.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="flex gap-4">
                <Briefcase className="h-8 w-8 text-purple-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">End-to-End Support</h3>
                  <p className="text-gray-400">
                    From CV optimization to interview prep to salary negotiation—we're with 
                    you at every step of your career journey.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Award className="h-8 w-8 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Proven Results</h3>
                  <p className="text-gray-400">
                    87% placement rate, 3x faster hiring, 40% average salary increase—our 
                    numbers speak for themselves.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Zap className="h-8 w-8 text-purple-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Always Evolving</h3>
                  <p className="text-gray-400">
                    Our AI learns from every interaction, constantly improving to serve 
                    you better. The platform you use tomorrow will be smarter than today.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
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
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Career?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join 250,000+ professionals who are already experiencing the future of job search.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              href="/signup"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-300"
            >
              Get Started Free
            </motion.a>
            <motion.a
              href="/demo"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-800/50 text-white px-8 py-4 rounded-xl font-semibold text-lg border border-gray-700 hover:border-cyan-500 transition-all duration-300"
            >
              Watch Demo
            </motion.a>
          </div>
        </div>
      </motion.section>
    </div>
  );
};

export default AboutPage;
