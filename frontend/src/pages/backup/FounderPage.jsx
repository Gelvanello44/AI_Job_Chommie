import React from 'react';
import { motion } from 'framer-motion';
import { User, Brain, Heart, Linkedin, Twitter, Mail, Quote, Star, Award, BookOpen, Coffee, Code } from 'lucide-react';

const FounderPage = () => {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const milestones = [
    {
      year: "2020",
      title: "The Spark",
      description: "Witnessed firsthand how talented South Africans struggled with outdated job search methods during the pandemic."
    },
    {
      year: "2022",
      title: "The Vision",
      description: "Left corporate consulting to build AI solutions that could democratize career opportunities."
    },
    {
      year: "2023",
      title: "The Launch",
      description: "AI Job Chommie went live, helping 1,000 job seekers in the first month alone."
    },
    {
      year: "2024",
      title: "The Growth",
      description: "Expanded across all South African provinces, partnered with major corporations."
    },
    {
      year: "2025",
      title: "The Future",
      description: "Leading Africa's AI employment revolution, with plans for continental expansion."
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
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Founder Image and Info */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="relative inline-block">
                {/* Placeholder for founder image - using icon for now */}
                <div className="w-80 h-80 mx-auto lg:mx-0 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-sm flex items-center justify-center border border-gray-700/50">
                  <User className="h-40 w-40 text-cyan-400/50" />
                </div>
                
                {/* Decorative elements */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-4 -right-4"
                >
                  <Brain className="h-12 w-12 text-purple-400/50" />
                </motion.div>
                
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-4 -left-4"
                >
                  <Heart className="h-12 w-12 text-cyan-400/50" />
                </motion.div>
              </div>

              {/* Social Links */}
              <div className="flex gap-4 mt-8 justify-center lg:justify-start">
                <motion.a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  className="bg-gray-800/50 p-3 rounded-full hover:bg-cyan-500/20 transition-colors"
                >
                  <Linkedin className="h-5 w-5 text-cyan-400" />
                </motion.a>
                <motion.a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  className="bg-gray-800/50 p-3 rounded-full hover:bg-cyan-500/20 transition-colors"
                >
                  <Twitter className="h-5 w-5 text-cyan-400" />
                </motion.a>
                <motion.a
                  href="mailto:founder@aijobchommie.com"
                  whileHover={{ scale: 1.1 }}
                  className="bg-gray-800/50 p-3 rounded-full hover:bg-cyan-500/20 transition-colors"
                >
                  <Mail className="h-5 w-5 text-cyan-400" />
                </motion.a>
              </div>
            </motion.div>

            {/* Founder Info */}
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-4">
                Meet the Visionary
              </h1>
              
              <h2 className="text-3xl font-semibold text-white mb-2">
                [Founder Name]
              </h2>
              
              <p className="text-xl text-cyan-400 mb-6">
                Founder & CEO, AI Job Chommie
              </p>

              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  "I've always believed that talent is universal, but opportunity isn't. Growing up in 
                  Soweto, I watched brilliant minds go unnoticed simply because they didn't have the 
                  right connections or couldn't navigate the complex job market."
                </p>
                
                <p>
                  "That's why I created AI Job Chommie—not just as a platform, but as a movement. 
                  We're not just matching resumes to job descriptions; we're recognizing potential, 
                  nurturing talent, and creating pathways that didn't exist before."
                </p>
                
                <p>
                  "In 2025, as we expand across Africa, my dream is becoming reality: A continent where 
                  every person has an AI advocate working tirelessly to unlock their career potential. 
                  This isn't just business—it's personal."
                </p>
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-black/30 rounded-lg p-4 backdrop-blur-sm">
                  <Award className="h-8 w-8 text-cyan-400 mb-2" />
                  <p className="text-sm text-gray-400">Forbes 30 Under 30</p>
                  <p className="text-white font-semibold">Africa 2024</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4 backdrop-blur-sm">
                  <BookOpen className="h-8 w-8 text-purple-400 mb-2" />
                  <p className="text-sm text-gray-400">MIT Sloan</p>
                  <p className="text-white font-semibold">MBA, AI Strategy</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Journey Timeline */}
      <motion.section 
        className="py-16 px-4 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12">The Journey to 2025</h2>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-cyan-400 to-purple-400"></div>
            
            {/* Timeline items */}
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`flex items-center ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`w-5/12 ${index % 2 === 0 ? 'text-right pr-8' : 'text-left pl-8'}`}>
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                      <span className="text-cyan-400 font-bold text-2xl">{milestone.year}</span>
                      <h3 className="text-xl font-semibold text-white mt-2 mb-3">{milestone.title}</h3>
                      <p className="text-gray-400">{milestone.description}</p>
                    </div>
                  </div>
                  
                  {/* Center dot */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-cyan-400 rounded-full border-4 border-gray-900"></div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Personal Touch Section */}
      <motion.section 
        className="py-16 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12">Beyond the Code</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <Coffee className="h-12 w-12 text-cyan-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Coffee Enthusiast</h3>
              <p className="text-gray-400">
                "My best ideas come during my 5am coffee ritual. There's something about Johannesburg 
                sunrises and Ethiopian beans that sparks innovation."
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <Code className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Still Coding</h3>
              <p className="text-gray-400">
                "I still write code every week. Staying hands-on keeps me connected to our product 
                and the challenges our engineering team faces."
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <Star className="h-12 w-12 text-cyan-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Ubuntu Philosophy</h3>
              <p className="text-gray-400">
                "I am because we are. This African philosophy drives everything we do—success 
                means lifting others as we rise."
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Quote Section */}
      <motion.section 
        className="py-16 px-4 bg-gradient-to-r from-cyan-900/30 to-purple-900/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <Quote className="h-12 w-12 text-cyan-400 mx-auto mb-6" />
          
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl text-gray-300 leading-relaxed italic mb-6"
          >
            "Every notification we send about a job match, every AI-optimized resume, every successful 
            placement—it's not just data. It's someone's dream coming true. It's a family's future 
            being secured. It's South Africa rising. That's what keeps me going."
          </motion.p>
          
          <p className="text-cyan-400 font-semibold text-lg">
            — Founder's Message, January 2025
          </p>
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
          <h2 className="text-4xl font-bold text-white mb-6">Let's Connect</h2>
          <p className="text-xl text-gray-300 mb-8">
            I personally read every message. Whether you have feedback, a partnership idea, or just 
            want to share your success story, I'd love to hear from you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              href="mailto:founder@aijobchommie.com"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-300 inline-flex items-center justify-center gap-2"
            >
              <Mail className="h-5 w-5" />
              Email Me Directly
            </motion.a>
            
            <motion.a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-800/50 text-white px-8 py-4 rounded-xl font-semibold text-lg border border-gray-700 hover:border-cyan-500 transition-all duration-300 inline-flex items-center justify-center gap-2"
            >
              <Linkedin className="h-5 w-5" />
              Connect on LinkedIn
            </motion.a>
          </div>

          <p className="text-gray-500 text-sm mt-8">
            Response time: Usually within 48 hours
          </p>
        </div>
      </motion.section>
    </div>
  );
};

export default FounderPage;
