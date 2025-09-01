import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Sparkles, Upload, Check, X, ArrowRight, ArrowLeft,
  Briefcase, GraduationCap, Award, Code, Palette, Globe,
  Heart, Target, MapPin, Calendar, Clock, DollarSign,
  Building, Users, Zap, Star, Camera, FileText, Link2,
  Linkedin, Github, Twitter, ChevronDown, Plus, Trash2,
  Loader2, CheckCircle, AlertCircle, Info, Rocket,
  BookOpen, Coffee, Laptop, TrendingUp, Shield, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Skill categories for job seekers
const skillCategories = {
  'Technology': ['JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker', 'TypeScript', 'Java', 'C++', 'MongoDB'],
  'Design': ['UI/UX', 'Figma', 'Adobe Creative Suite', 'Sketch', 'InVision', 'Wireframing', 'Prototyping'],
  'Marketing': ['SEO', 'Content Marketing', 'Google Analytics', 'Social Media', 'Email Marketing', 'PPC'],
  'Sales': ['B2B Sales', 'Lead Generation', 'CRM', 'Negotiation', 'Account Management', 'Cold Calling'],
  'Finance': ['Financial Analysis', 'Excel', 'QuickBooks', 'Budgeting', 'Forecasting', 'SAP'],
  'Other': []
};

// Industries list
const industries = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing',
  'Consulting', 'Media', 'Real Estate', 'Transportation', 'Energy', 'Other'
];

// Job types
const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Remote'];

// Experience levels
const experienceLevels = ['Entry Level', 'Mid Level', 'Senior', 'Executive', 'Director', 'C-Level'];

const OnboardingFlow = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Determine account type and total steps
  const accountType = user?.accountType || 'job_seeker';
  const totalSteps = accountType === 'job_seeker' ? 6 : 5;
  
  // Form data state
  const [formData, setFormData] = useState({
    // Step 1: Profile Photo & Bio
    profilePhoto: null,
    photoPreview: null,
    headline: '',
    bio: '',
    
    // Step 2: Professional Details (Job Seeker)
    currentRole: '',
    experienceLevel: '',
    yearsOfExperience: '',
    education: {
      degree: '',
      field: '',
      school: '',
      graduationYear: ''
    },
    
    // Step 2: Company Details (Employer)
    companyLogo: null,
    companyLogoPreview: null,
    companyDescription: '',
    companyWebsite: '',
    companyLinkedin: '',
    
    // Step 3: Skills & Expertise (Job Seeker) / Hiring Needs (Employer)
    skills: [],
    customSkill: '',
    certifications: [],
    languages: [],
    
    // Employer hiring needs
    hiringRoles: [],
    teamSize: '',
    hiringTimeline: '',
    
    // Step 4: Career Preferences (Job Seeker) / Company Culture (Employer)
    desiredRoles: [],
    preferredLocations: [],
    salaryExpectation: {
      min: '',
      max: '',
      currency: 'USD'
    },
    jobTypes: [],
    remotePreference: '',
    
    // Employer culture
    companyValues: [],
    benefits: [],
    workEnvironment: '',
    
    // Step 5: Portfolio & Links (Job Seeker) / Recruitment Process (Employer)
    portfolio: '',
    linkedin: '',
    github: '',
    twitter: '',
    personalWebsite: '',
    resume: null,
    
    // Employer recruitment
    interviewProcess: [],
    responseTime: '',
    hiringManager: '',
    
    // Step 6: Notifications & Preferences (Both)
    emailNotifications: {
      jobMatches: true,
      applications: true,
      messages: true,
      newsletter: true
    },
    pushNotifications: true,
    jobAlertFrequency: 'daily',
    profileVisibility: 'public'
  });

  // Handle file uploads
  const handlePhotoUpload = (e, type = 'profile') => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'profile') {
          setFormData(prev => ({
            ...prev,
            profilePhoto: file,
            photoPreview: reader.result
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            companyLogo: file,
            companyLogoPreview: reader.result
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResumeUpload = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'application/pdf' || file.type.startsWith('application/msword'))) {
      setFormData(prev => ({
        ...prev,
        resume: file
      }));
    }
  };

  // Add skill
  const addSkill = (skill) => {
    if (!formData.skills.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    }
  };

  const removeSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const addCustomSkill = () => {
    if (formData.customSkill && !formData.skills.includes(formData.customSkill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, prev.customSkill],
        customSkill: ''
      }));
    }
  };

  // Validate current step
  const validateStep = () => {
    const newErrors = {};
    
    if (accountType === 'job_seeker') {
      switch (currentStep) {
        case 1:
          if (!formData.headline) newErrors.headline = 'Professional headline is required';
          if (!formData.bio) newErrors.bio = 'Bio is required';
          break;
        case 2:
          if (!formData.currentRole) newErrors.currentRole = 'Current role is required';
          if (!formData.experienceLevel) newErrors.experienceLevel = 'Experience level is required';
          break;
        case 3:
          if (formData.skills.length === 0) newErrors.skills = 'Add at least one skill';
          break;
        case 4:
          if (formData.desiredRoles.length === 0) newErrors.desiredRoles = 'Select at least one desired role';
          if (formData.jobTypes.length === 0) newErrors.jobTypes = 'Select at least one job type';
          break;
      }
    } else {
      switch (currentStep) {
        case 1:
          if (!formData.headline) newErrors.headline = 'Company tagline is required';
          if (!formData.bio) newErrors.bio = 'Company description is required';
          break;
        case 2:
          if (!formData.companyWebsite) newErrors.companyWebsite = 'Company website is required';
          break;
        case 3:
          if (formData.hiringRoles.length === 0) newErrors.hiringRoles = 'Add at least one role you\'re hiring for';
          break;
        case 4:
          if (formData.companyValues.length === 0) newErrors.companyValues = 'Add at least one company value';
          break;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    if (!validateStep()) return;
    
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update profile
      await updateProfile(formData);
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      setErrors({ submit: 'Failed to complete onboarding. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  // Render steps based on account type
  const renderStep = () => {
    if (accountType === 'job_seeker') {
      return renderJobSeekerStep();
    } else {
      return renderEmployerStep();
    }
  };

  const renderJobSeekerStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Let's Build Your Profile</h2>
              <p className="text-gray-400">Help recruiters find you with a complete profile</p>
            </div>

            {/* Profile Photo Upload */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
                  {formData.photoPreview ? (
                    <img src={formData.photoPreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-gray-500" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full cursor-pointer hover:bg-cyan-600 transition-colors">
                  <Upload className="h-4 w-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'profile')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Professional Headline */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Professional Headline
              </label>
              <input
                type="text"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all ${
                  errors.headline ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="e.g., Senior Software Engineer | Full Stack Developer"
                maxLength={120}
              />
              <div className="flex justify-between mt-1">
                {errors.headline && <p className="text-red-400 text-xs">{errors.headline}</p>}
                <p className="text-gray-500 text-xs ml-auto">{formData.headline.length}/120</p>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Professional Summary
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all ${
                  errors.bio ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="Tell us about your professional journey, achievements, and what you're looking for..."
                rows={4}
                maxLength={500}
              />
              <div className="flex justify-between mt-1">
                {errors.bio && <p className="text-red-400 text-xs">{errors.bio}</p>}
                <p className="text-gray-500 text-xs ml-auto">{formData.bio.length}/500</p>
              </div>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Professional Experience</h2>
              <p className="text-gray-400">Share your career journey and education</p>
            </div>

            {/* Current Role */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current/Most Recent Role
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.currentRole}
                  onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })}
                  className={`w-full pl-10 pr-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all ${
                    errors.currentRole ? 'border-red-500' : 'border-gray-700'
                  }`}
                  placeholder="e.g., Software Engineer at Tech Company"
                />
              </div>
              {errors.currentRole && <p className="text-red-400 text-xs mt-1">{errors.currentRole}</p>}
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Experience Level
              </label>
              <div className="grid grid-cols-2 gap-3">
                {experienceLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, experienceLevel: level })}
                    className={`py-2 px-4 rounded-lg border transition-all ${
                      formData.experienceLevel === level
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                        : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              {errors.experienceLevel && <p className="text-red-400 text-xs mt-1">{errors.experienceLevel}</p>}
            </div>

            {/* Years of Experience */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Years of Experience
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <select
                  value={formData.yearsOfExperience}
                  onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all appearance-none"
                >
                  <option value="">Select years</option>
                  <option value="0-1">Less than 1 year</option>
                  <option value="1-3">1-3 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="5-10">5-10 years</option>
                  <option value="10+">10+ years</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Education */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                Education
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.education.degree}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      education: { ...formData.education, degree: e.target.value }
                    })}
                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                    placeholder="Degree (e.g., Bachelor's)"
                  />
                </div>
                <input
                  type="text"
                  value={formData.education.field}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    education: { ...formData.education, field: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="Field of study"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.education.school}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    education: { ...formData.education, school: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="School/University"
                />
                <input
                  type="text"
                  value={formData.education.graduationYear}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    education: { ...formData.education, graduationYear: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="Graduation year"
                />
              </div>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Skills & Expertise</h2>
              <p className="text-gray-400">Highlight your key skills to match with the right opportunities</p>
            </div>

            {/* Skill Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4">
                Select Your Skills
              </label>
              
              {/* Selected Skills */}
              {formData.skills.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {formData.skills.map((skill) => (
                      <motion.div
                        key={skill}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-full text-cyan-400 text-sm flex items-center gap-1"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="ml-1 hover:text-red-400 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Skill Categories */}
              <div className="space-y-3">
                {Object.entries(skillCategories).map(([category, skills]) => (
                  <div key={category} className="border border-gray-700 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">{category}</h4>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSkill(skill)}
                          disabled={formData.skills.includes(skill)}
                          className={`px-3 py-1 rounded-full text-sm transition-all ${
                            formData.skills.includes(skill)
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-800 text-gray-300 hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/50 border border-gray-700'
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Skill Input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Add Custom Skills
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.customSkill}
                    onChange={(e) => setFormData({ ...formData, customSkill: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                    className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                    placeholder="Type a skill and press Enter"
                  />
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {errors.skills && (
                <p className="text-red-400 text-xs mt-2">{errors.skills}</p>
              )}
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Languages
              </label>
              <input
                type="text"
                value={formData.languages.join(', ')}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  languages: e.target.value.split(',').map(l => l.trim()).filter(l => l)
                })}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                placeholder="e.g., English, Spanish, Mandarin"
              />
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Career Preferences</h2>
              <p className="text-gray-400">Tell us what you're looking for in your next role</p>
            </div>

            {/* Desired Roles */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Desired Job Titles
              </label>
              <input
                type="text"
                value={formData.desiredRoles.join(', ')}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  desiredRoles: e.target.value.split(',').map(r => r.trim()).filter(r => r)
                })}
                className={`w-full px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all ${
                  errors.desiredRoles ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="e.g., Software Engineer, Full Stack Developer, Tech Lead"
              />
              {errors.desiredRoles && <p className="text-red-400 text-xs mt-1">{errors.desiredRoles}</p>}
            </div>

            {/* Job Types */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Employment Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {jobTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      if (formData.jobTypes.includes(type)) {
                        setFormData({ 
                          ...formData, 
                          jobTypes: formData.jobTypes.filter(t => t !== type)
                        });
                      } else {
                        setFormData({ 
                          ...formData, 
                          jobTypes: [...formData.jobTypes, type]
                        });
                      }
                    }}
                    className={`py-2 px-4 rounded-lg border transition-all ${
                      formData.jobTypes.includes(type)
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                        : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {errors.jobTypes && <p className="text-red-400 text-xs mt-1">{errors.jobTypes}</p>}
            </div>

            {/* Preferred Locations */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preferred Locations
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.preferredLocations.join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    preferredLocations: e.target.value.split(',').map(l => l.trim()).filter(l => l)
                  })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="e.g., New York, Remote, San Francisco"
                />
              </div>
            </div>

            {/* Salary Expectations */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Salary Expectations (Annual)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <input
                    type="number"
                    value={formData.salaryExpectation.min}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      salaryExpectation: { ...formData.salaryExpectation, min: e.target.value }
                    })}
                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                    placeholder="Min"
                  />
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <input
                    type="number"
                    value={formData.salaryExpectation.max}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      salaryExpectation: { ...formData.salaryExpectation, max: e.target.value }
                    })}
                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                    placeholder="Max"
                  />
                </div>
                <select
                  value={formData.salaryExpectation.currency}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    salaryExpectation: { ...formData.salaryExpectation, currency: e.target.value }
                  })}
                  className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </div>
            </div>

            {/* Remote Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Remote Work Preference
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['On-site', 'Remote', 'Hybrid'].map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setFormData({ ...formData, remotePreference: pref })}
                    className={`py-2 px-4 rounded-lg border transition-all ${
                      formData.remotePreference === pref
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                        : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Portfolio & Links</h2>
              <p className="text-gray-400">Share your work and connect your professional profiles</p>
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Resume/CV
              </label>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-cyan-500/50 transition-colors">
                {formData.resume ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-cyan-400" />
                    <div className="text-left">
                      <p className="text-white font-medium">{formData.resume.name}</p>
                      <p className="text-gray-400 text-sm">{(formData.resume.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, resume: null })}
                      className="ml-4 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">Click to upload or drag and drop</p>
                    <p className="text-gray-500 text-sm mt-1">PDF, DOC, DOCX (Max 5MB)</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleResumeUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                Professional Links
              </label>
              
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="url"
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="LinkedIn profile URL"
                />
              </div>

              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="url"
                  value={formData.github}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="GitHub profile URL"
                />
              </div>

              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="url"
                  value={formData.portfolio}
                  onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="Portfolio website URL"
                />
              </div>

              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="url"
                  value={formData.personalWebsite}
                  onChange={(e) => setFormData({ ...formData, personalWebsite: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="Personal website URL"
                />
              </div>
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div
            key="step6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Notification Preferences</h2>
              <p className="text-gray-400">Choose how you want to stay updated</p>
            </div>

            {/* Email Notifications */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4">
                Email Notifications
              </label>
              <div className="space-y-3">
                {Object.entries({
                  jobMatches: 'New job matches',
                  applications: 'Application updates',
                  messages: 'Messages from recruiters',
                  newsletter: 'Weekly career tips newsletter'
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors">
                    <span className="text-gray-300">{label}</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.emailNotifications[key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          emailNotifications: {
                            ...formData.emailNotifications,
                            [key]: e.target.checked
                          }
                        })}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${
                        formData.emailNotifications[key] ? 'bg-cyan-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${
                          formData.emailNotifications[key] ? 'translate-x-5' : 'translate-x-1'
                        } mt-1`} />
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Job Alert Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Job Alert Frequency
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['daily', 'weekly', 'monthly'].map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFormData({ ...formData, jobAlertFrequency: freq })}
                    className={`py-2 px-4 rounded-lg border transition-all capitalize ${
                      formData.jobAlertFrequency === freq
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                        : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Profile Visibility
              </label>
              <div className="space-y-2">
                {[
                  { value: 'public', label: 'Public', desc: 'Visible to all recruiters and employers' },
                  { value: 'connections', label: 'Connections Only', desc: 'Only visible to your connections' },
                  { value: 'private', label: 'Private', desc: 'Only you can see your profile' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                      formData.profileVisibility === option.value
                        ? 'border-cyan-400 bg-cyan-400/10'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={formData.profileVisibility === option.value}
                      onChange={(e) => setFormData({ ...formData, profileVisibility: e.target.value })}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${
                        formData.profileVisibility === option.value ? 'text-cyan-400' : 'text-gray-300'
                      }`}>
                        {option.label}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">{option.desc}</p>
                    </div>
                    {formData.profileVisibility === option.value && (
                      <CheckCircle className="h-5 w-5 text-cyan-400 ml-2" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const renderEmployerStep = () => {
    // Similar structure but for employer-specific fields
    // This would include company details, hiring needs, culture, etc.
    // For brevity, I'll show a simplified version
    
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="emp-step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Company Profile</h2>
              <p className="text-gray-400">Create your company's presence on AI Job Chommie</p>
            </div>

            {/* Company Logo */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-lg bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
                  {formData.companyLogoPreview ? (
                    <img src={formData.companyLogoPreview} alt="Company Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building className="h-8 w-8 text-gray-500" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-purple-500 rounded-full cursor-pointer hover:bg-purple-600 transition-colors">
                  <Upload className="h-4 w-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'company')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Company Tagline */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Tagline
              </label>
              <input
                type="text"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all ${
                  errors.headline ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="e.g., Building the future of AI-powered recruitment"
                maxLength={120}
              />
              {errors.headline && <p className="text-red-400 text-xs mt-1">{errors.headline}</p>}
            </div>

            {/* Company Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                About Your Company
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all ${
                  errors.bio ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="Tell candidates about your company's mission, values, and what makes you unique..."
                rows={4}
                maxLength={500}
              />
              {errors.bio && <p className="text-red-400 text-xs mt-1">{errors.bio}</p>}
            </div>
          </motion.div>
        );

      // Additional employer steps would go here...
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-400">Employer onboarding steps in progress...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        {/* Header with Progress */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.1 
            }}
            className="inline-block mb-6"
          >
            <div className="relative">
              <Brain className="h-16 w-16 text-cyan-400" />
              <Sparkles className="h-8 w-8 text-purple-400 absolute -top-2 -right-2" />
            </div>
          </motion.div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">Step {currentStep} of {totalSteps}</span>
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Skip for now
              </button>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800"
        >
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {currentStep > 1 && (
              <motion.button
                type="button"
                onClick={handlePrevious}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 bg-gray-800/50 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="h-5 w-5" />
                Previous
              </motion.button>
            )}

            {currentStep < totalSteps ? (
              <motion.button
                type="button"
                onClick={handleNext}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="ml-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                Continue
                <ArrowRight className="h-5 w-5" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={handleComplete}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="ml-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Completing Setup...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <Rocket className="h-5 w-5" />
                  </>
                )}
              </motion.button>
            )}
          </div>

          {/* Error Message */}
          {errors.submit && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center"
            >
              {errors.submit}
            </motion.div>
          )}
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Info className="h-4 w-4" />
            <span>Complete profiles get 3x more visibility</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingFlow;
