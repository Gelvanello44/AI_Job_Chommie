import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Briefcase, Users, Target, TrendingUp, Zap, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing AI Job Chommie...');
  const [isExiting, setIsExiting] = useState(false);

  const loadingMessages = [
    'Initializing AI Job Chommie...',
    'Powering up AI engines...',
    'Analyzing job market trends...',
    'Optimizing your experience...',
    'Preparing personalized dashboard...',
    'Almost ready to transform your career...'
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            setIsExiting(true);
            setTimeout(onComplete, 800);
          }, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    const messageInterval = setInterval(() => {
      setLoadingText(prev => {
        const currentIndex = loadingMessages.indexOf(prev);
        if (currentIndex < loadingMessages.length - 1) {
          return loadingMessages[currentIndex + 1];
        }
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [onComplete]);

  const floatingIcons = [
    { Icon: Briefcase, delay: 0, x: -100, y: -50 },
    { Icon: Users, delay: 0.2, x: 100, y: -80 },
    { Icon: Target, delay: 0.4, x: -80, y: 80 },
    { Icon: TrendingUp, delay: 0.6, x: 120, y: 50 },
    { Icon: Zap, delay: 0.8, x: -120, y: 0 },
    { Icon: Globe, delay: 1, x: 0, y: -100 }
  ];

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-gray-900 via-purple-900 to-cyan-900 flex items-center justify-center overflow-hidden"
        >
          {/* Animated background particles */}
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-cyan-400/20 rounded-full"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                }}
                animate={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                }}
                transition={{
                  duration: Math.random() * 20 + 10,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'linear'
                }}
              />
            ))}
          </div>

          {/* Main content */}
          <div className="relative z-10 text-center px-4">
            {/* Logo and branding */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.2 
              }}
              className="mb-8"
            >
              <div className="relative inline-block">
                {/* Central Brain Icon */}
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity }
                  }}
                  className="relative"
                >
                  <Brain className="h-32 w-32 text-cyan-400 drop-shadow-2xl" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-20 w-20 text-purple-400 animate-pulse" />
                  </div>
                </motion.div>

                {/* Floating icons around the main logo */}
                {floatingIcons.map(({ Icon, delay, x, y }, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: [0.4, 0.8, 0.4],
                      scale: [0.8, 1, 0.8],
                      x: [0, x, 0],
                      y: [0, y, 0]
                    }}
                    transition={{
                      duration: 4,
                      delay,
                      repeat: Infinity,
                      repeatType: 'reverse'
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <Icon className="h-6 w-6 text-cyan-300/60" />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-4"
            >
              AI Job Chommie
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xl text-gray-300 mb-12 font-light"
            >
              Your AI-Powered Career Companion for 2025
            </motion.p>

            {/* Loading section */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="max-w-md mx-auto"
            >
              {/* Loading text */}
              <motion.p
                key={loadingText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-cyan-300 mb-4 text-sm"
              >
                {loadingText}
              </motion.p>

              {/* Progress bar container */}
              <div className="relative h-2 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm">
                {/* Animated background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
                
                {/* Progress bar */}
                <motion.div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute right-0 top-0 h-full w-8 bg-white/30 blur-xl animate-pulse" />
                </motion.div>
              </div>

              {/* Progress percentage */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-4 text-gray-400 text-sm"
              >
                {progress}%
              </motion.div>
            </motion.div>

            {/* Footer text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-16 text-xs text-gray-500"
            >
              <p>© 2025 AI Job Chommie • Transforming Careers with AI</p>
              <p className="mt-1">South Africa's Premier AI Job Platform</p>
            </motion.div>

            {/* Pulsating ring effect */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [1, 2, 3],
                opacity: [0.4, 0.2, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeOut"
              }}
            >
              <div className="w-64 h-64 border-2 border-cyan-400/30 rounded-full" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
