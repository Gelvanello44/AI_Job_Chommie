import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

const OnboardingTour = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);

  const tourSteps = [
    {
      id: 'welcome',
      title: 'Welcome to AI Job Chommie! ',
      description: 'Let us show you around and help you get the most out of our platform.',
      target: null,
      position: 'center',
      action: null
    },
    {
      id: 'dashboard',
      title: 'Your Dashboard',
      description: 'This is your command center. Track applications, view analytics, and manage your job search.',
      target: '[data-tour="dashboard"]',
      position: 'bottom',
      action: 'explore'
    },
    {
      id: 'job-search',
      title: 'Smart Job Search',
      description: 'Our AI-powered search finds jobs that match your skills and preferences.',
      target: '[data-tour="job-search"]',
      position: 'bottom',
      action: 'search'
    },
    {
      id: 'cv-builder',
      title: 'CV Builder',
      description: 'Create ATS-optimized resumes with our intelligent CV builder.',
      target: '[data-tour="cv-builder"]',
      position: 'right',
      action: 'create'
    },
    {
      id: 'applications',
      title: 'Application Tracking',
      description: 'Keep track of all your applications in one place.',
      target: '[data-tour="applications"]',
      position: 'left',
      action: 'track'
    },
    {
      id: 'ai-writing',
      title: 'AI Writing Assistant',
      description: 'Generate personalized cover letters and optimize your resume content.',
      target: '[data-tour="ai-writing"]',
      position: 'bottom',
      action: 'write'
    },
    {
      id: 'analytics',
      title: 'Analytics & Insights',
      description: 'Track your job search progress with detailed analytics.',
      target: '[data-tour="analytics"]',
      position: 'top',
      action: 'analyze'
    },
    {
      id: 'settings',
      title: 'Customize Your Experience',
      description: 'Set your preferences, manage notifications, and configure integrations.',
      target: '[data-tour="settings"]',
      position: 'bottom',
      action: 'configure'
    },
    {
      id: 'complete',
      title: 'You\'re All Set! ',
      description: 'You\'re ready to supercharge your job search. Good luck!',
      target: null,
      position: 'center',
      action: 'complete'
    }
  ];

  useEffect(() => {
    if (isOpen && tourSteps[currentStep].target) {
      const element = document.querySelector(tourSteps[currentStep].target);
      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight class
        element.classList.add('tour-highlight');
      }
    }

    return () => {
      if (highlightedElement) {
        highlightedElement.classList.remove('tour-highlight');
      }
    };
  }, [currentStep, isOpen]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCompletedSteps([...completedSteps, tourSteps[currentStep].id]);
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleComplete = () => {
    // Save completion to localStorage
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('onboardingDate', new Date().toISOString());
    
    if (onComplete) {
      onComplete();
    }
    onClose();
  };

  const getTooltipPosition = () => {
    if (!highlightedElement || !tourSteps[currentStep].target) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const rect = highlightedElement.getBoundingClientRect();
    const position = tourSteps[currentStep].position;
    
    switch (position) {
      case 'top':
        return {
          bottom: `${window.innerHeight - rect.top + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          top: `${rect.bottom + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          right: `${window.innerWidth - rect.left + 10}px`,
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 10}px`,
          transform: 'translateY(-50%)'
        };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  if (!isOpen) return null;

  const currentStepData = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-[9998]" onClick={handleSkip}>
        {highlightedElement && (
          <div
            className="absolute bg-transparent border-4 border-blue-500 rounded-lg transition-all duration-300"
            style={{
              top: highlightedElement.getBoundingClientRect().top - 4,
              left: highlightedElement.getBoundingClientRect().left - 4,
              width: highlightedElement.getBoundingClientRect().width + 8,
              height: highlightedElement.getBoundingClientRect().height + 8,
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

      {/* Tour Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="fixed z-[9999]"
          style={getTooltipPosition()}
        >
          <Card className="w-96 shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={progress} className="h-2 flex-1" />
                    <span className="text-sm text-muted-foreground">
                      {currentStep + 1}/{tourSteps.length}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSkip}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base mb-6">
                {currentStepData.description}
              </CardDescription>

              {/* Step indicators */}
              <div className="flex justify-center gap-1 mb-6">
                {tourSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`h-2 w-2 rounded-full transition-all ${
                      index === currentStep
                        ? 'bg-primary w-8'
                        : index < currentStep
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                {currentStep === tourSteps.length - 1 ? (
                  <Button
                    onClick={handleComplete}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Complete Tour
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Skip option */}
              {currentStep < tourSteps.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4"
                >
                  Skip tour
                </button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Global styles for highlighting */}
      <style jsx global>{`
        .tour-highlight {
          position: relative;
          z-index: 9999 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </>
  );
};

export default OnboardingTour;
