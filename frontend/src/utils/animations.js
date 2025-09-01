// animations.js - Comprehensive animation utilities and configurations

// Framer Motion animation presets
export const animationPresets = {
  // Page transitions
  pageTransition: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  },

  // Slide animations
  slideIn: {
    initial: { x: '-100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },

  slideUp: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },

  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
  },

  fadeInScale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  },

  // Scale animations
  scaleIn: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: 'spring', damping: 20, stiffness: 300 }
  },

  // Rotation animations
  rotateIn: {
    initial: { rotate: -180, opacity: 0 },
    animate: { rotate: 0, opacity: 1 },
    exit: { rotate: 180, opacity: 0 },
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  },

  // Bounce animations
  bounceIn: {
    initial: { scale: 0, opacity: 0 },
    animate: { 
      scale: [0, 1.1, 1], 
      opacity: [0, 1, 1] 
    },
    transition: { 
      duration: 0.6, 
      times: [0, 0.6, 1],
      ease: [0.4, 0, 0.2, 1] 
    }
  },

  // Elastic animations
  elasticIn: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0, opacity: 0 },
    transition: { 
      type: 'spring', 
      damping: 12, 
      stiffness: 400,
      restDelta: 0.001
    }
  },

  // Stagger animations for lists
  staggerChildren: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  },

  staggerItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  },

  // Loading animations
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.8, 1, 0.8]
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  },

  shimmer: {
    animate: {
      x: ['-100%', '100%']
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear'
    }
  },

  // Hover animations
  hoverLift: {
    whileHover: {
      y: -4,
      scale: 1.02,
      transition: { duration: 0.2 }
    },
    whileTap: {
      y: 0,
      scale: 0.98,
      transition: { duration: 0.1 }
    }
  },

  hoverGlow: {
    whileHover: {
      boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)',
      transition: { duration: 0.3 }
    }
  },

  // Button animations
  buttonPress: {
    whileTap: {
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  },

  buttonBounce: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  },

  // Modal animations
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
  },

  modalSlideUp: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },

  // Tab animations
  tabContent: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3 }
  },

  // Form animations
  formField: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  },

  // Success/Error animations
  successBounce: {
    initial: { scale: 0, rotate: -180 },
    animate: { 
      scale: [0, 1.2, 1], 
      rotate: [180, 0, 0] 
    },
    transition: { 
      duration: 0.6,
      times: [0, 0.7, 1],
      ease: [0.4, 0, 0.2, 1]
    }
  },

  errorShake: {
    animate: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4 }
    }
  },

  // Voice animation
  voicePulse: {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [0.8, 1, 0.8]
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  },

  // AI typing animation
  typeWriter: {
    animate: {
      opacity: [0, 1, 0]
    },
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

// Gesture configurations
export const gestureConfigs = {
  swipeThreshold: 50,
  dragElastic: 0.2,
  dragMomentum: false,
  
  // Mobile swipe settings
  mobileSwipe: {
    threshold: 100,
    velocity: 500,
    elastic: 0.1
  },

  // Pull to refresh settings
  pullToRefresh: {
    threshold: 80,
    resistance: 3,
    maxPull: 120
  },

  // Long press settings
  longPress: {
    duration: 500,
    threshold: 10
  }
};

// Animation variants for different states
export const stateVariants = {
  loading: {
    animate: {
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  },

  disabled: {
    animate: {
      opacity: 0.5,
      scale: 0.95
    },
    transition: { duration: 0.2 }
  },

  active: {
    animate: {
      scale: 1.02,
      borderColor: 'rgba(34, 197, 94, 0.5)'
    },
    transition: { duration: 0.2 }
  },

  error: {
    animate: {
      borderColor: 'rgba(239, 68, 68, 0.5)',
      boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)'
    },
    transition: { duration: 0.2 }
  },

  success: {
    animate: {
      borderColor: 'rgba(34, 197, 94, 0.5)',
      boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.1)'
    },
    transition: { duration: 0.2 }
  }
};

// Easing functions
export const easingFunctions = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
  elastic: [0.25, 0.46, 0.45, 0.94],
  sharp: [0.4, 0, 0.6, 1],
  standard: [0.4, 0, 0.2, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.4, 0, 1, 1]
};

// Duration presets
export const durations = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
  slowest: 1.2
};

// Animation utilities
export const createStaggerAnimation = (count, delay = 0.1) => ({
  animate: {
    transition: {
      staggerChildren: delay,
      delayChildren: delay
    }
  }
});

export const createSequenceAnimation = (steps, duration = 0.3) => {
  const stepDuration = duration / steps.length;
  return {
    animate: steps,
    transition: {
      duration,
      times: steps.map((_, i) => i / (steps.length - 1))
    }
  };
};

export const createSpringAnimation = (damping = 25, stiffness = 200) => ({
  transition: {
    type: 'spring',
    damping,
    stiffness,
    restDelta: 0.001
  }
});

export const createDelayedAnimation = (animation, delay = 0) => ({
  ...animation,
  transition: {
    ...animation.transition,
    delay
  }
});

// Micro-interaction configurations
export const microInteractions = {
  // Button states
  button: {
    idle: { scale: 1, brightness: 1 },
    hover: { scale: 1.05, brightness: 1.1 },
    active: { scale: 0.95, brightness: 0.9 },
    disabled: { scale: 1, brightness: 0.6, opacity: 0.5 }
  },

  // Card interactions
  card: {
    idle: { y: 0, scale: 1, rotate: 0 },
    hover: { y: -4, scale: 1.02, rotate: 0.5 },
    active: { y: 0, scale: 0.98, rotate: 0 }
  },

  // Input focus states
  input: {
    idle: { borderColor: 'rgba(34, 197, 94, 0.2)', scale: 1 },
    focus: { 
      borderColor: 'rgba(34, 197, 94, 0.5)', 
      scale: 1.01,
      boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.1)'
    },
    error: { 
      borderColor: 'rgba(239, 68, 68, 0.5)',
      boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)'
    }
  },

  // Notification animations
  notification: {
    enter: {
      initial: { x: '100%', opacity: 0 },
      animate: { x: 0, opacity: 1 },
      transition: { type: 'spring', damping: 25, stiffness: 200 }
    },
    exit: {
      animate: { x: '100%', opacity: 0 },
      transition: { duration: 0.3 }
    }
  },

  // Loading states
  skeleton: {
    animate: {
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  },

  // AI interaction animations
  aiThinking: {
    animate: {
      scale: [1, 1.05, 1],
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  },

  // Voice visualizer
  voiceBar: (index) => ({
    animate: {
      scaleY: [0.2, 1, 0.2],
      transition: {
        duration: 0.5,
        repeat: Infinity,
        delay: index * 0.1,
        ease: 'easeInOut'
      }
    }
  }),

  // Progress indicators
  progressFill: {
    initial: { scaleX: 0 },
    animate: { scaleX: 1 },
    transition: { duration: 1, ease: 'easeOut' }
  },

  // Floating action button
  fab: {
    idle: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 5 },
    active: { scale: 0.9, rotate: 0 }
  }
};

// Page transition configurations
export const pageTransitions = {
  slideRight: {
    initial: { x: '-100vw' },
    animate: { x: 0 },
    exit: { x: '100vw' },
    transition: { type: 'spring', damping: 30, stiffness: 300 }
  },

  slideLeft: {
    initial: { x: '100vw' },
    animate: { x: 0 },
    exit: { x: '-100vw' },
    transition: { type: 'spring', damping: 30, stiffness: 300 }
  },

  slideUp: {
    initial: { y: '100vh' },
    animate: { y: 0 },
    exit: { y: '-100vh' },
    transition: { type: 'spring', damping: 30, stiffness: 300 }
  },

  slideDown: {
    initial: { y: '-100vh' },
    animate: { y: 0 },
    exit: { y: '100vh' },
    transition: { type: 'spring', damping: 30, stiffness: 300 }
  },

  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.4 }
  },

  scale: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  }
};

// Mobile-specific animations
export const mobileAnimations = {
  bottomSheet: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },

  swipeCard: {
    swipeRight: {
      x: '100vw',
      rotate: 15,
      opacity: 0,
      transition: { duration: 0.3 }
    },
    swipeLeft: {
      x: '-100vw',
      rotate: -15,
      opacity: 0,
      transition: { duration: 0.3 }
    },
    snapBack: {
      x: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: 'spring', damping: 20, stiffness: 300 }
    }
  },

  pullToRefresh: {
    pulling: (progress) => ({
      y: Math.min(progress * 2, 80),
      rotate: progress * 2,
      transition: { type: 'spring', damping: 15, stiffness: 300 }
    }),
    release: {
      y: 60,
      rotate: 360,
      transition: { duration: 0.5 }
    },
    complete: {
      y: 0,
      rotate: 0,
      transition: { duration: 0.3 }
    }
  },

  touchRipple: {
    initial: { scale: 0, opacity: 0.5 },
    animate: { scale: 4, opacity: 0 },
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

// Accessibility-aware animations
export const accessibleAnimations = {
  // Reduced motion variants
  reducedMotion: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.1 }
    },
    slideIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.1 }
    }
  },

  // Focus animations
  focusRing: {
    animate: {
      boxShadow: [
        '0 0 0 0 rgba(34, 197, 94, 0)',
        '0 0 0 4px rgba(34, 197, 94, 0.3)',
        '0 0 0 4px rgba(34, 197, 94, 0)'
      ],
      transition: { duration: 0.8, repeat: Infinity }
    }
  },

  // High contrast variants
  highContrast: {
    button: {
      hover: { 
        backgroundColor: '#00ff00',
        color: '#000',
        transition: { duration: 0.1 }
      }
    }
  }
};

// Animation utility functions
export const getResponsiveAnimation = (animation, isMobile = false) => {
  if (isMobile) {
    return {
      ...animation,
      transition: {
        ...animation.transition,
        duration: (animation.transition?.duration || 0.3) * 0.8
      }
    };
  }
  return animation;
};

export const getAccessibleAnimation = (animation, prefersReducedMotion = false) => {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.1 }
    };
  }
  return animation;
};

export const combineAnimations = (...animations) => {
  return animations.reduce((combined, animation) => ({
    ...combined,
    ...animation,
    transition: {
      ...combined.transition,
      ...animation.transition
    }
  }), {});
};

// Performance optimization utilities
export const optimizeForMobile = (animation) => ({
  ...animation,
  transition: {
    ...animation.transition,
    type: 'tween', // Use tween instead of spring for better mobile performance
    ease: 'easeOut'
  }
});

export const createBatchAnimation = (items, animation, staggerDelay = 0.1) => ({
  animate: {
    transition: {
      staggerChildren: staggerDelay
    }
  },
  children: items.map((_, index) => ({
    ...animation,
    transition: {
      ...animation.transition,
      delay: index * staggerDelay
    }
  }))
});

// CSS animation classes for better performance
export const cssAnimationClasses = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  slideLeft: 'animate-slide-left',
  slideRight: 'animate-slide-right',
  scaleIn: 'animate-scale-in',
  bounce: 'animate-bounce',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  wiggle: 'animate-wiggle',
  shake: 'animate-shake',
  glow: 'animate-glow'
};

// Animation presets for specific components
export const componentAnimations = {
  jobCard: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9 },
    whileHover: { y: -2, scale: 1.01 },
    transition: { duration: 0.3 }
  },

  navigation: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },

  modal: {
    backdrop: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    },
    content: {
      initial: { y: '100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '100%', opacity: 0 }
    }
  },

  dropdown: {
    initial: { opacity: 0, scale: 0.95, y: -10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -10 },
    transition: { duration: 0.2 }
  },

  tooltip: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: 0.15 }
  },

  notification: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },

  tab: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  }
};

// Voice-specific animations
export const voiceAnimations = {
  listening: {
    animate: {
      scale: [1, 1.1, 1],
      boxShadow: [
        '0 0 0 0 rgba(34, 197, 94, 0.7)',
        '0 0 0 20px rgba(34, 197, 94, 0)',
        '0 0 0 0 rgba(34, 197, 94, 0)'
      ]
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  },

  speaking: {
    animate: {
      opacity: [1, 0.7, 1],
      scale: [1, 1.02, 1]
    },
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  },

  waveform: (bars) => 
    bars.map((_, index) => ({
      animate: {
        scaleY: [0.2, 1, 0.2]
      },
      transition: {
        duration: 0.5,
        repeat: Infinity,
        delay: index * 0.1,
        ease: 'easeInOut'
      }
    }))
};

// Performance monitoring
export const animationPerformance = {
  // Track animation performance
  trackPerformance: (animationName, startTime) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (duration > 16.67) { // > 60fps
      console.warn(`Animation "${animationName}" took ${duration.toFixed(2)}ms (may cause jank)`);
    }
  },

  // Optimize animations for low-end devices
  optimizeForDevice: (animation) => {
    const isLowEndDevice = navigator.hardwareConcurrency <= 2;
    
    if (isLowEndDevice) {
      return {
        ...animation,
        transition: {
          ...animation.transition,
          duration: (animation.transition?.duration || 0.3) * 0.5,
          type: 'tween'
        }
      };
    }
    
    return animation;
  }
};

// Custom hooks for animations
export const useAnimationControls = () => {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    isAnimating,
    setIsAnimating,
    prefersReducedMotion,
    shouldAnimate: !prefersReducedMotion
  };
};

export const useSequentialAnimation = (items, delay = 0.1) => {
  const [visibleItems, setVisibleItems] = React.useState(0);

  React.useEffect(() => {
    if (visibleItems < items.length) {
      const timer = setTimeout(() => {
        setVisibleItems(prev => prev + 1);
      }, delay * 1000);

      return () => clearTimeout(timer);
    }
  }, [visibleItems, items.length, delay]);

  return visibleItems;
};

// Animation context
export const AnimationContext = React.createContext({
  prefersReducedMotion: false,
  animationSpeed: 1,
  enableAnimations: true
});

export const useAnimationContext = () => React.useContext(AnimationContext);

// Export default configuration
export default {
  presets: animationPresets,
  gestures: gestureConfigs,
  states: stateVariants,
  easing: easingFunctions,
  durations,
  microInteractions,
  mobile: mobileAnimations,
  accessible: accessibleAnimations,
  components: componentAnimations,
  voice: voiceAnimations,
  performance: animationPerformance
};
