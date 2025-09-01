import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings, 
  HelpCircle, 
  Zap, 
  MessageSquare,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info,
  Command
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Toggle } from '@/components/ui/toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import './VoiceOperationSystem.css';

const VoiceCommandHelp = ({ isOpen, onClose }) => {
  const commands = [
    {
      category: 'Navigation',
      commands: [
        { phrase: 'Go to dashboard', description: 'Navigate to the main dashboard' },
        { phrase: 'Open job search', description: 'Go to job search interface' },
        { phrase: 'Show my applications', description: 'View application tracking' },
        { phrase: 'Open CV builder', description: 'Launch the CV builder' },
        { phrase: 'Go back', description: 'Navigate to previous page' }
      ]
    },
    {
      category: 'Job Search',
      commands: [
        { phrase: 'Search for [job title]', description: 'Search for specific job titles' },
        { phrase: 'Filter by location [location]', description: 'Filter jobs by location' },
        { phrase: 'Show remote jobs', description: 'Filter for remote positions' },
        { phrase: 'Save this job', description: 'Save the current job to favorites' },
        { phrase: 'Apply to this job', description: 'Start application process' }
      ]
    },
    {
      category: 'Application Management',
      commands: [
        { phrase: 'Show my saved jobs', description: 'View bookmarked positions' },
        { phrase: 'Check application status', description: 'View application progress' },
        { phrase: 'Update my profile', description: 'Edit profile information' },
        { phrase: 'Export my CV', description: 'Download CV as PDF' }
      ]
    },
    {
      category: 'Accessibility',
      commands: [
        { phrase: 'Read this page', description: 'Read page content aloud' },
        { phrase: 'Describe this job', description: 'Read job details aloud' },
        { phrase: 'Help me navigate', description: 'Get navigation assistance' },
        { phrase: 'Stop reading', description: 'Stop text-to-speech' }
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="voice-command-help__overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="voice-command-help__modal"
        onClick={(e) => e.stopPropagation()}
      >
        <Card variant="elevated" className="voice-command-help">
          <div className="voice-command-help__header">
            <h3 className="voice-command-help__title">
              <Command size={20} />
              Voice Commands Guide
            </h3>
            <Button variant="ghost" size="small" onClick={onClose}>
              
            </Button>
          </div>

          <div className="voice-command-help__content">
            {commands.map((category, index) => (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="voice-command-help__category"
              >
                <h4 className="voice-command-help__category-title">
                  {category.category}
                </h4>
                <div className="voice-command-help__commands">
                  {category.commands.map((cmd, cmdIndex) => (
                    <motion.div
                      key={cmdIndex}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (index * 0.1) + (cmdIndex * 0.05) }}
                      className="voice-command-help__command"
                    >
                      <div className="voice-command-help__phrase">
                        "{cmd.phrase}"
                      </div>
                      <div className="voice-command-help__description">
                        {cmd.description}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="voice-command-help__tips">
            <h4> Voice Tips</h4>
            <ul>
              <li>Speak clearly and at a normal pace</li>
              <li>Wait for the listening indicator before speaking</li>
              <li>Use "Hey Job Chommie" to activate voice commands</li>
              <li>Say "help" or "what can I say" for guidance</li>
            </ul>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

const VoiceVisualizer = ({ isListening, audioLevel = 0 }) => {
  const bars = Array.from({ length: 5 }, (_, i) => i);
  
  return (
    <div className="voice-visualizer">
      {bars.map((bar, index) => (
        <motion.div
          key={bar}
          className="voice-visualizer__bar"
          animate={{
            scaleY: isListening 
              ? 0.2 + (audioLevel * (1 + index * 0.2)) 
              : 0.2,
            opacity: isListening ? 1 : 0.3
          }}
          transition={{
            duration: 0.1,
            ease: "easeOut"
          }}
          style={{
            animationDelay: `${index * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

const VoiceOperationSystem = () => {
  const [isListening, setIsListening] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [language, setLanguage] = useState('en-US');
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voicePitch, setVoicePitch] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Check browser support
  useEffect(() => {
    const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasSynthesis = 'speechSynthesis' in window;
    setIsSupported(hasWebSpeech && hasSynthesis);
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = language;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      console.log('Voice recognition started');
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      console.log('Voice recognition ended');
    };

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
          setConfidence(event.results[i][0].confidence);
        } else {
          interimTranscript += transcriptPart;
        }
      }

      setTranscript(interimTranscript || finalTranscript);

      if (finalTranscript) {
        processVoiceCommand(finalTranscript.trim());
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      speak('Sorry, I had trouble understanding. Please try again.');
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, isSupported]);

  // Audio level monitoring
  useEffect(() => {
    if (!isListening || !navigator.mediaDevices) return;

    const startAudioMonitoring = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateAudioLevel = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
          setAudioLevel(average / 255);
          
          if (isListening) {
            animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
          }
        };

        updateAudioLevel();
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    };

    startAudioMonitoring();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isListening]);

  const speak = useCallback((text, options = {}) => {
    if (!isSupported || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || voiceSpeed;
    utterance.pitch = options.pitch || voicePitch;
    utterance.volume = options.volume || 0.8;
    utterance.lang = language;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
    synthesisRef.current = utterance;
  }, [voiceSpeed, voicePitch, language, isSupported]);

  const processVoiceCommand = useCallback((command) => {
    const lowercaseCommand = command.toLowerCase();
    setLastCommand(command);
    
    // Add to command history
    setCommandHistory(prev => [
      { command, timestamp: new Date(), success: true },
      ...prev.slice(0, 9)
    ]);

    console.log('Processing voice command:', command);

    // Navigation commands
    if (lowercaseCommand.includes('dashboard') || lowercaseCommand.includes('home')) {
      speak('Navigating to dashboard');
      // Navigate to dashboard
      return;
    }

    if (lowercaseCommand.includes('job search') || lowercaseCommand.includes('find jobs')) {
      speak('Opening job search');
      // Navigate to job search
      return;
    }

    if (lowercaseCommand.includes('cv builder') || lowercaseCommand.includes('resume')) {
      speak('Opening CV builder');
      // Navigate to CV builder
      return;
    }

    if (lowercaseCommand.includes('applications') || lowercaseCommand.includes('my applications')) {
      speak('Showing your applications');
      // Navigate to applications
      return;
    }

    // Job search commands
    if (lowercaseCommand.includes('search for')) {
      const jobTitle = lowercaseCommand.replace(/.*search for\s+/, '');
      speak(`Searching for ${jobTitle} positions`);
      // Perform job search
      return;
    }

    if (lowercaseCommand.includes('filter by location')) {
      const location = lowercaseCommand.replace(/.*filter by location\s+/, '');
      speak(`Filtering jobs in ${location}`);
      // Apply location filter
      return;
    }

    if (lowercaseCommand.includes('show remote jobs')) {
      speak('Showing remote job opportunities');
      // Filter for remote jobs
      return;
    }

    if (lowercaseCommand.includes('save this job') || lowercaseCommand.includes('bookmark')) {
      speak('Job saved to your favorites');
      // Save current job
      return;
    }

    // Application commands
    if (lowercaseCommand.includes('apply to this job') || lowercaseCommand.includes('apply now')) {
      speak('Starting application process');
      // Start application
      return;
    }

    // Reading commands
    if (lowercaseCommand.includes('read this') || lowercaseCommand.includes('read page')) {
      speak('Reading page content');
      // Read page content
      return;
    }

    if (lowercaseCommand.includes('describe this job')) {
      speak('Reading job description');
      // Read job details
      return;
    }

    if (lowercaseCommand.includes('stop reading') || lowercaseCommand.includes('stop')) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Help commands
    if (lowercaseCommand.includes('help') || lowercaseCommand.includes('what can i say')) {
      speak('Here are some things you can say. You can navigate to different sections, search for jobs, manage applications, or ask me to read content aloud.');
      setShowHelp(true);
      return;
    }

    // Greeting
    if (lowercaseCommand.includes('hello') || lowercaseCommand.includes('hi')) {
      speak('Hello! I\'m your Job Chommie voice assistant. How can I help you today?');
      return;
    }

    // Default response
    speak('I didn\'t understand that command. Say "help" to see available commands.');
    setCommandHistory(prev => [
      { command, timestamp: new Date(), success: false },
      ...prev.slice(0, 9)
    ]);
  }, [speak]);

  const startListening = () => {
    if (!isSupported || !isEnabled) return;
    
    try {
      recognitionRef.current?.start();
      setTranscript('');
    } catch (error) {
      console.error('Error starting recognition:', error);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const enableVoiceOperations = () => {
    setIsEnabled(true);
    speak('Voice operations enabled. Say "Hey Job Chommie" followed by a command, or click the microphone to start.');
  };

  const disableVoiceOperations = () => {
    setIsEnabled(false);
    stopListening();
    stopSpeaking();
  };

  if (!isSupported) {
    return (
      <Card variant="warning" className="voice-operation-system voice-operation-system--unsupported">
        <div className="voice-operation-system__unsupported">
          <AlertCircle size={24} />
          <div>
            <h3>Voice Operations Not Supported</h3>
            <p>Your browser doesn't support voice features. Please use a modern browser like Chrome, Edge, or Safari.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card 
        variant={isEnabled ? "success" : "default"} 
        className="voice-operation-system"
        glow={isListening || isSpeaking}
      >
        <div className="voice-operation-system__header">
          <div className="voice-operation-system__title">
            <Zap size={20} />
            Voice Assistant
            {isEnabled && (
              <StatusIndicator 
                status={isListening ? "processing" : "connected"} 
                label={isListening ? "Listening..." : "Ready"} 
                animated={true} 
              />
            )}
          </div>
          
          <div className="voice-operation-system__controls">
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowHelp(true)}
              icon={<HelpCircle />}
            >
              Help
            </Button>
            <Button
              variant="ghost"
              size="small"
              icon={<Settings />}
            >
              Settings
            </Button>
          </div>
        </div>

        {!isEnabled ? (
          <div className="voice-operation-system__setup">
            <div className="voice-operation-system__setup-content">
              <Mic size={48} className="voice-operation-system__setup-icon" />
              <h3>Enable Voice Operations</h3>
              <p>Control Job Chommie with your voice for hands-free navigation and accessibility</p>
              <Button 
                variant="primary" 
                onClick={enableVoiceOperations}
                icon={<Mic />}
                glow={true}
                size="large"
              >
                Enable Voice Assistant
              </Button>
            </div>
          </div>
        ) : (
          <div className="voice-operation-system__active">
            <div className="voice-operation-system__main-controls">
              <div className="voice-operation-system__mic-section">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`voice-operation-system__mic-button ${isListening ? 'voice-operation-system__mic-button--active' : ''}`}
                  onClick={toggleListening}
                >
                  {isListening ? <MicOff size={32} /> : <Mic size={32} />}
                </motion.div>
                
                <VoiceVisualizer isListening={isListening} audioLevel={audioLevel} />
              </div>

              <div className="voice-operation-system__status">
                <div className="voice-operation-system__transcript">
                  {transcript && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="voice-operation-system__transcript-text"
                    >
                      "{transcript}"
                    </motion.div>
                  )}
                  
                  {!transcript && !isListening && (
                    <div className="voice-operation-system__prompt">
                      Click the microphone or say "Hey Job Chommie"
                    </div>
                  )}
                </div>

                {confidence > 0 && (
                  <div className="voice-operation-system__confidence">
                    <span className="voice-operation-system__confidence-label">Confidence:</span>
                    <Progress 
                      value={confidence * 100} 
                      color={confidence > 0.7 ? 'green' : confidence > 0.4 ? 'yellow' : 'pink'}
                      size="small" 
                      animated={true}
                      showPercentage={true}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="voice-operation-system__quick-actions">
              <Button
                variant={isSpeaking ? "danger" : "outline"}
                size="small"
                onClick={isSpeaking ? stopSpeaking : () => speak('Voice assistant is ready to help')}
                icon={isSpeaking ? <Square /> : <Volume2 />}
              >
                {isSpeaking ? 'Stop Speaking' : 'Test Voice'}
              </Button>
              
              <Button
                variant="outline"
                size="small"
                onClick={() => setShowHelp(true)}
                icon={<Command />}
              >
                Voice Commands
              </Button>
              
              <Toggle
                pressed={isEnabled}
                onPressedChange={isEnabled ? disableVoiceOperations : enableVoiceOperations}
                size="small"
              >
                {isEnabled ? 'Disable' : 'Enable'}
              </Toggle>
            </div>

            {lastCommand && (
              <div className="voice-operation-system__last-command">
                <div className="voice-operation-system__last-command-label">Last Command:</div>
                <div className="voice-operation-system__last-command-text">"{lastCommand}"</div>
              </div>
            )}

            <div className="voice-operation-system__settings">
              <div className="voice-operation-system__setting">
                <label className="voice-operation-system__setting-label">Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger size="small">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="en-ZA">English (South Africa)</SelectItem>
                    <SelectItem value="af-ZA">Afrikaans</SelectItem>
                    <SelectItem value="zu-ZA">Zulu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="voice-operation-system__setting">
                <label className="voice-operation-system__setting-label">Speech Speed</label>
                <div className="voice-operation-system__slider">
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                    className="voice-operation-system__range"
                  />
                  <span className="voice-operation-system__slider-value">{voiceSpeed}x</span>
                </div>
              </div>

              <div className="voice-operation-system__setting">
                <label className="voice-operation-system__setting-label">Voice Pitch</label>
                <div className="voice-operation-system__slider">
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={voicePitch}
                    onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                    className="voice-operation-system__range"
                  />
                  <span className="voice-operation-system__slider-value">{voicePitch}x</span>
                </div>
              </div>
            </div>

            {commandHistory.length > 0 && (
              <div className="voice-operation-system__history">
                <h4 className="voice-operation-system__history-title">Recent Commands</h4>
                <div className="voice-operation-system__history-list">
                  {commandHistory.slice(0, 5).map((entry, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="voice-operation-system__history-item"
                    >
                      <div className="voice-operation-system__history-icon">
                        {entry.success ? (
                          <CheckCircle size={12} className="text-green-400" />
                        ) : (
                          <AlertCircle size={12} className="text-red-400" />
                        )}
                      </div>
                      <div className="voice-operation-system__history-command">
                        "{entry.command}"
                      </div>
                      <div className="voice-operation-system__history-time">
                        {entry.timestamp.toLocaleTimeString()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <VoiceCommandHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
};

// Voice Control Hook for other components
export const useVoiceControl = () => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const speak = useCallback((text, options = {}) => {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 0.8;
    window.speechSynthesis.speak(utterance);
  }, [isVoiceEnabled]);

  const announcePageChange = useCallback((pageName) => {
    speak(`Navigated to ${pageName}`);
  }, [speak]);

  const announceAction = useCallback((action) => {
    speak(action);
  }, [speak]);

  const readText = useCallback((text) => {
    speak(text);
  }, [speak]);

  return {
    isVoiceEnabled,
    setIsVoiceEnabled,
    isListening,
    speak,
    announcePageChange,
    announceAction,
    readText
  };
};

// Voice Navigation Component for global use
export const VoiceNavigationButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  return (
    <motion.div
      className="voice-navigation-button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        variant={isListening ? "success" : "outline"}
        size="large"
        onClick={() => setIsOpen(!isOpen)}
        icon={isListening ? <MicOff /> : <Mic />}
        glow={isListening}
        className="voice-navigation-button__trigger"
      >
        Voice
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="voice-navigation-button__popup"
          >
            <VoiceOperationSystem />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VoiceOperationSystem;
