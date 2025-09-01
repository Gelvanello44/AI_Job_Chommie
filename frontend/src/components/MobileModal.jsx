import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTouchGestures } from '../hooks/useTouchGestures';

const MobileModal = ({ isOpen, onClose, title, children, fullScreen = true }) => {
  const gestures = useTouchGestures({
    onSwipeDown: () => onClose(),
    swipeThreshold: 100
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const modalVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 }
  };

  const desktopModalVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            variants={fullScreen ? modalVariants : desktopModalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed z-50 bg-gradient-to-b from-[#1a1f3a] to-[#131829] ${
              fullScreen
                ? 'inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90%] md:max-w-2xl md:h-auto md:max-h-[90vh] md:rounded-2xl'
                : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl max-h-[90vh] rounded-2xl'
            } overflow-hidden`}
          >
            {/* Swipe Indicator (Mobile Only) */}
            {fullScreen && (
              <div
                className="md:hidden w-full h-6 flex justify-center items-center"
                {...gestures.gestureProps}
              >
                <div className="w-12 h-1 bg-white/30 rounded-full" />
              </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1f3a] to-[#1a1f3a]/95 backdrop-blur-sm border-b border-white/10 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(100vh-8rem)] md:max-h-[calc(90vh-8rem)] p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileModal;
