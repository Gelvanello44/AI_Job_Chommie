import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Save, 
  Eye, 
  Wand2, 
  Upload, 
  Copy, 
  Trash2, 
  Plus, 
  GripVertical,
  Sparkles,
  Target,
  CheckCircle,
  AlertTriangle,
  Zap,
  RotateCcw,
  Settings,
  Template,
  Palette,
  Users,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Github
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import './CvBuilderInterface.css';

const CvSchema = z.object({
  personalInfo: z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional()
  }),
  summary: z.string().optional(),
  experience: z.array(z.object({
    id: z.string(),
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    current: z.boolean().default(false),
    description: z.string().optional(),
    achievements: z.array(z.string()).default([])
  })).default([]),
  education: z.array(z.object({
    id: z.string(),
    degree: z.string(),
    institution: z.string(),
    location: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    gpa: z.string().optional(),
    description: z.string().optional()
  })).default([]),
  skills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    level: z.number().min(1).max(5),
    category: z.string()
  })).default([]),
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    technologies: z.array(z.string()).default([]),
    url: z.string().optional(),
    github: z.string().optional()
  })).default([])
});

const TemplateSelector = ({ selectedTemplate, onTemplateChange, templates }) => {
  const [previewTemplate, setPreviewTemplate] = useState(null);
  
  const availableTemplates = [
    {
      id: 'modern',
      name: 'Modern Professional',
      description: 'Clean, contemporary design with accent colors',
      preview: '/api/placeholder/200/280',
      features: ['ATS Friendly', 'Color Accents', 'Modern Layout'],
      isPro: false
    },
    {
      id: 'executive',
      name: 'Executive Elite',
      description: 'Sophisticated design for senior positions',
      preview: '/api/placeholder/200/280',
      features: ['Premium Design', 'Executive Focus', 'Leadership Emphasis'],
      isPro: true
    },
    {
      id: 'creative',
      name: 'Creative Edge',
      description: 'Eye-catching design for creative professionals',
      preview: '/api/placeholder/200/280',
      features: ['Visual Appeal', 'Portfolio Integration', 'Creative Layout'],
      isPro: true
    },
    {
      id: 'minimal',
      name: 'Minimal Clean',
      description: 'Simple, focused design that highlights content',
      preview: '/api/placeholder/200/280',
      features: ['Ultra Clean', 'Content Focus', 'High Readability'],
      isPro: false
    }
  ];

  return (
    <Card variant="elevated" className="template-selector">
      <div className="template-selector__header">
        <h3 className="template-selector__title">
          <Template size={20} />
          Choose Template
        </h3>
        <StatusIndicator status="active" label="Auto-Save" animated={true} />
      </div>

      <div className="template-selector__grid">
        {availableTemplates.map((template) => (
          <motion.div
            key={template.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`template-selector__item ${selectedTemplate === template.id ? 'template-selector__item--selected' : ''}`}
            onClick={() => onTemplateChange(template.id)}
          >
            <div className="template-selector__preview">
              <img src={template.preview} alt={template.name} />
              {template.isPro && (
                <Badge variant="warning" size="small" className="template-selector__pro-badge">
                  Pro
                </Badge>
              )}
            </div>
            
            <div className="template-selector__info">
              <h4 className="template-selector__name">{template.name}</h4>
              <p className="template-selector__description">{template.description}</p>
              
              <div className="template-selector__features">
                {template.features.map((feature, index) => (
                  <Badge key={index} variant="secondary" size="small">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const PersonalInfoEditor = ({ form, errors }) => {
  return (
    <Card variant="default" className="personal-info-editor">
      <div className="personal-info-editor__header">
        <h3 className="personal-info-editor__title">
          <Users size={20} />
          Personal Information
        </h3>
      </div>

      <div className="personal-info-editor__grid">
        <div className="personal-info-editor__field">
          <label className="personal-info-editor__label">Full Name *</label>
          <Input
            {...form.register('personalInfo.fullName')}
            placeholder="Enter your full name"
            error={errors.personalInfo?.fullName?.message}
            icon={<Users size={16} />}
            glow={true}
          />
        </div>

        <div className="personal-info-editor__field">
          <label className="personal-info-editor__label">Email *</label>
          <Input
            {...form.register('personalInfo.email')}
            type="email"
            placeholder="your.email@example.com"
            error={errors.personalInfo?.email?.message}
            icon={<Mail size={16} />}
            glow={true}
          />
        </div>

        <div className="personal-info-editor__field">
          <label className="personal-info-editor__label">Phone</label>
          <Input
            {...form.register('personalInfo.phone')}
            placeholder="+27 XX XXX XXXX"
            icon={<Phone size={16} />}
          />
        </div>

        <div className="personal-info-editor__field">
          <label className="personal-info-editor__label">Location</label>
          <Input
            {...form.register('personalInfo.location')}
            placeholder="City, Province, South Africa"
            icon={<MapPin size={16} />}
          />
        </div>

        <div className="personal-info-editor__field">
          <label className="personal-info-editor__label">Website</label>
          <Input
            {...form.register('personalInfo.website')}
            placeholder="https://yourwebsite.com"
            icon={<Globe size={16} />}
          />
        </div>

        <div className="personal-info-editor__field">
          <label className="personal-info-editor__label">LinkedIn</label>
          <Input
            {...form.register('personalInfo.linkedin')}
            placeholder="linkedin.com/in/yourprofile"
            icon={<Linkedin size={16} />}
          />
        </div>

        <div className="personal-info-editor__field">
          <label className="personal-info-editor__label">GitHub</label>
          <Input
            {...form.register('personalInfo.github')}
            placeholder="github.com/yourusername"
            icon={<Github size={16} />}
          />
        </div>
      </div>
    </Card>
  );
};

const SummaryEditor = ({ form, errors }) => {
  const [aiSuggestions, setAiSuggestions] = useState([
    "Experienced software developer with 5+ years in React and TypeScript development",
    "Results-driven professional with expertise in full-stack web development",
    "Passionate developer focused on creating scalable, user-centric applications"
  ]);
  
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAISummary = async () => {
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      const newSummary = "AI-generated professional summary based on your experience and skills...";
      form.setValue('summary', newSummary);
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <Card variant="default" className="summary-editor">
      <div className="summary-editor__header">
        <h3 className="summary-editor__title">
          <FileText size={20} />
          Professional Summary
        </h3>
        <Button 
          variant="secondary" 
          size="small" 
          onClick={generateAISummary}
          disabled={isGenerating}
          icon={<Wand2 />}
          glow={true}
        >
          {isGenerating ? 'Generating...' : 'AI Generate'}
        </Button>
      </div>

      <div className="summary-editor__content">
        <textarea
          {...form.register('summary')}
          placeholder="Write a compelling professional summary that highlights your key strengths, experience, and career objectives..."
          className="summary-editor__textarea"
          rows={6}
        />
        
        {errors.summary && (
          <div className="summary-editor__error">
            {errors.summary.message}
          </div>
        )}

        <div className="summary-editor__suggestions">
          <h4 className="summary-editor__suggestions-title">AI Suggestions</h4>
          <div className="summary-editor__suggestions-list">
            {aiSuggestions.map((suggestion, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="summary-editor__suggestion"
                onClick={() => form.setValue('summary', suggestion)}
              >
                <Sparkles size={14} />
                <span>{suggestion}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

const ExperienceEditor = ({ form, errors }) => {
  const [experiences, setExperiences] = useState([]);

  const addExperience = () => {
    const newExperience = {
      id: Date.now().toString(),
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      achievements: []
    };
    setExperiences([...experiences, newExperience]);
  };

  const removeExperience = (id) => {
    setExperiences(experiences.filter(exp => exp.id !== id));
  };

  const updateExperience = (id, field, value) => {
    setExperiences(experiences.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    ));
  };

  return (
    <Card variant="default" className="experience-editor">
      <div className="experience-editor__header">
        <h3 className="experience-editor__title">
          <Briefcase size={20} />
          Work Experience
        </h3>
        <Button 
          variant="primary" 
          size="small" 
          onClick={addExperience}
          icon={<Plus />}
          glow={true}
        >
          Add Experience
        </Button>
      </div>

      <Reorder.Group values={experiences} onReorder={setExperiences} className="experience-editor__list">
        <AnimatePresence>
          {experiences.map((experience) => (
            <Reorder.Item 
              key={experience.id} 
              value={experience}
              className="experience-editor__item"
            >
              <div className="experience-editor__item-header">
                <div className="experience-editor__drag-handle">
                  <GripVertical size={16} />
                </div>
                <h4 className="experience-editor__item-title">
                  {experience.title || 'New Position'}
                </h4>
                <Button 
                  variant="ghost" 
                  size="small" 
                  onClick={() => removeExperience(experience.id)}
                  icon={<Trash2 />}
                  className="experience-editor__remove"
                >
                  Remove
                </Button>
              </div>

              <div className="experience-editor__item-grid">
                <div className="experience-editor__field">
                  <label>Job Title *</label>
                  <Input
                    value={experience.title}
                    onChange={(e) => updateExperience(experience.id, 'title', e.target.value)}
                    placeholder="e.g., Senior React Developer"
                  />
                </div>

                <div className="experience-editor__field">
                  <label>Company *</label>
                  <Input
                    value={experience.company}
                    onChange={(e) => updateExperience(experience.id, 'company', e.target.value)}
                    placeholder="e.g., TechCorp SA"
                  />
                </div>

                <div className="experience-editor__field">
                  <label>Location</label>
                  <Input
                    value={experience.location}
                    onChange={(e) => updateExperience(experience.id, 'location', e.target.value)}
                    placeholder="e.g., Cape Town, WC"
                  />
                </div>

                <div className="experience-editor__field">
                  <label>Start Date</label>
                  <Input
                    type="month"
                    value={experience.startDate}
                    onChange={(e) => updateExperience(experience.id, 'startDate', e.target.value)}
                  />
                </div>

                <div className="experience-editor__field">
                  <label>End Date</label>
                  <Input
                    type="month"
                    value={experience.endDate}
                    onChange={(e) => updateExperience(experience.id, 'endDate', e.target.value)}
                    disabled={experience.current}
                    placeholder={experience.current ? 'Present' : ''}
                  />
                </div>

                <div className="experience-editor__field experience-editor__field--checkbox">
                  <label className="experience-editor__checkbox">
                    <input
                      type="checkbox"
                      checked={experience.current}
                      onChange={(e) => updateExperience(experience.id, 'current', e.target.checked)}
                    />
                    <span>Current Position</span>
                  </label>
                </div>
              </div>

              <div className="experience-editor__description">
                <label>Description & Achievements</label>
                <textarea
                  value={experience.description}
                  onChange={(e) => updateExperience(experience.id, 'description', e.target.value)}
                  placeholder="Describe your role and key achievements..."
                  rows={4}
                  className="experience-editor__textarea"
                />
                <div className="experience-editor__ai-help">
                  <Button variant="ghost" size="small" icon={<Wand2 />}>
                    AI Improve
                  </Button>
                  <Button variant="ghost" size="small" icon={<Sparkles />}>
                    Add Achievements
                  </Button>
                </div>
              </div>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {experiences.length === 0 && (
        <div className="experience-editor__empty">
          <Briefcase size={48} className="experience-editor__empty-icon" />
          <h4>No work experience added yet</h4>
          <p>Add your professional experience to strengthen your CV</p>
          <Button variant="primary" onClick={addExperience} icon={<Plus />} glow={true}>
            Add Your First Experience
          </Button>
        </div>
      )}
    </Card>
  );
};

const SkillsEditor = ({ form, errors }) => {
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('technical');

  const skillCategories = [
    'Technical',
    'Soft Skills',
    'Languages',
    'Tools & Software',
    'Certifications'
  ];

  const addSkill = () => {
    if (skillInput.trim()) {
      const newSkill = {
        id: Date.now().toString(),
        name: skillInput.trim(),
        level: 3,
        category: selectedCategory
      };
      setSkills([...skills, newSkill]);
      setSkillInput('');
    }
  };

  const removeSkill = (id) => {
    setSkills(skills.filter(skill => skill.id !== id));
  };

  const updateSkillLevel = (id, level) => {
    setSkills(skills.map(skill => 
      skill.id === id ? { ...skill, level } : skill
    ));
  };

  const suggestedSkills = [
    'React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Git',
    'Problem Solving', 'Team Leadership', 'Communication', 'Project Management'
  ];

  return (
    <Card variant="default" className="skills-editor">
      <div className="skills-editor__header">
        <h3 className="skills-editor__title">
          <Target size={20} />
          Skills & Expertise
        </h3>
        <Button variant="secondary" size="small" icon={<Wand2 />}>
          AI Suggest
        </Button>
      </div>

      <div className="skills-editor__add-section">
        <div className="skills-editor__add-controls">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger size="medium">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {skillCategories.map((category) => (
                <SelectItem key={category} value={category.toLowerCase().replace(' ', '-')}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            placeholder="Enter skill name"
            onKeyPress={(e) => e.key === 'Enter' && addSkill()}
            className="skills-editor__input"
          />

          <Button variant="primary" onClick={addSkill} icon={<Plus />}>
            Add
          </Button>
        </div>

        <div className="skills-editor__suggestions">
          <span className="skills-editor__suggestions-label">Suggested:</span>
          <div className="skills-editor__suggestions-list">
            {suggestedSkills.map((skill, index) => (
              <Badge
                key={index}
                variant="ghost"
                size="small"
                className="skills-editor__suggestion"
                onClick={() => setSkillInput(skill)}
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="skills-editor__list">
        {Object.entries(
          skills.reduce((acc, skill) => {
            const category = skill.category;
            if (!acc[category]) acc[category] = [];
            acc[category].push(skill);
            return acc;
          }, {})
        ).map(([category, categorySkills]) => (
          <div key={category} className="skills-editor__category">
            <h4 className="skills-editor__category-title">
              {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
            </h4>
            <div className="skills-editor__category-skills">
              {categorySkills.map((skill) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="skills-editor__skill"
                >
                  <div className="skills-editor__skill-info">
                    <span className="skills-editor__skill-name">{skill.name}</span>
                    <div className="skills-editor__skill-level">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <button
                          key={index}
                          className={`skills-editor__level-dot ${index < skill.level ? 'skills-editor__level-dot--active' : ''}`}
                          onClick={() => updateSkillLevel(skill.id, index + 1)}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => removeSkill(skill.id)}
                    icon={<Trash2 />}
                    className="skills-editor__skill-remove"
                  >
                    Remove
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {skills.length === 0 && (
        <div className="skills-editor__empty">
          <Target size={48} className="skills-editor__empty-icon" />
          <h4>No skills added yet</h4>
          <p>Add your technical and soft skills to showcase your expertise</p>
        </div>
      )}
    </Card>
  );
};

const ATSScorePanel = ({ score = 78, suggestions = [] }) => {
  const getScoreColor = (score) => {
    if (score >= 90) return 'green';
    if (score >= 75) return 'cyan';
    if (score >= 60) return 'yellow';
    return 'pink';
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const defaultSuggestions = [
    { type: 'keyword', message: 'Add more industry-specific keywords', priority: 'high' },
    { type: 'format', message: 'Use bullet points for achievements', priority: 'medium' },
    { type: 'length', message: 'Consider expanding work descriptions', priority: 'low' }
  ];

  return (
    <Card variant="warning" className="ats-score-panel">
      <div className="ats-score-panel__header">
        <h3 className="ats-score-panel__title">
          <Target size={20} />
          ATS Optimization Score
        </h3>
        <StatusIndicator status="processing" label="Analyzing" animated={true} />
      </div>

      <div className="ats-score-panel__score">
        <div className="ats-score-panel__score-circle">
          <Progress 
            value={score} 
            color={getScoreColor(score)}
            size="large"
            variant="circular"
            animated={true}
            showPercentage={true}
          />
        </div>
        <div className="ats-score-panel__score-info">
          <div className="ats-score-panel__score-label">{getScoreLabel(score)}</div>
          <div className="ats-score-panel__score-description">
            Your CV is {score >= 75 ? 'well-optimized' : 'partially optimized'} for ATS systems
          </div>
        </div>
      </div>

      <div className="ats-score-panel__suggestions">
        <h4 className="ats-score-panel__suggestions-title">Improvement Suggestions</h4>
        <div className="ats-score-panel__suggestions-list">
          {defaultSuggestions.map((suggestion, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="ats-score-panel__suggestion"
            >
              <div className="ats-score-panel__suggestion-icon">
                {suggestion.priority === 'high' ? (
                  <AlertTriangle size={16} />
                ) : (
                  <CheckCircle size={16} />
                )}
              </div>
              <div className="ats-score-panel__suggestion-content">
                <span className="ats-score-panel__suggestion-message">
                  {suggestion.message}
                </span>
                <Badge 
                  variant={suggestion.priority === 'high' ? 'danger' : suggestion.priority === 'medium' ? 'warning' : 'info'} 
                  size="small"
                >
                  {suggestion.priority}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  );
};

const PreviewPanel = ({ cvData, selectedTemplate, isPreviewMode }) => {
  const [zoom, setZoom] = useState(1);

  return (
    <Card variant="elevated" className="preview-panel">
      <div className="preview-panel__header">
        <h3 className="preview-panel__title">
          <Eye size={20} />
          Live Preview
        </h3>
        
        <div className="preview-panel__controls">
          <div className="preview-panel__zoom">
            <Button
              variant="ghost"
              size="small"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            >
              -
            </Button>
            <span className="preview-panel__zoom-value">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            >
              +
            </Button>
          </div>
          
          <Button variant="outline" size="small" icon={<Download />}>
            Export PDF
          </Button>
        </div>
      </div>

      <div className="preview-panel__content">
        <div 
          className="preview-panel__document"
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="cv-preview cv-preview--modern">
            {/* CV Preview Content */}
            <div className="cv-preview__header">
              <h1 className="cv-preview__name">
                {cvData?.personalInfo?.fullName || 'Your Name'}
              </h1>
              <div className="cv-preview__contact">
                {cvData?.personalInfo?.email && (
                  <span>{cvData.personalInfo.email}</span>
                )}
                {cvData?.personalInfo?.phone && (
                  <span>{cvData.personalInfo.phone}</span>
                )}
                {cvData?.personalInfo?.location && (
                  <span>{cvData.personalInfo.location}</span>
                )}
              </div>
            </div>

            {cvData?.summary && (
              <div className="cv-preview__section">
                <h2 className="cv-preview__section-title">Professional Summary</h2>
                <p className="cv-preview__summary">{cvData.summary}</p>
              </div>
            )}

            {cvData?.experience?.length > 0 && (
              <div className="cv-preview__section">
                <h2 className="cv-preview__section-title">Work Experience</h2>
                <div className="cv-preview__experience-list">
                  {cvData.experience.map((exp, index) => (
                    <div key={index} className="cv-preview__experience-item">
                      <div className="cv-preview__experience-header">
                        <h3 className="cv-preview__experience-title">{exp.title}</h3>
                        <span className="cv-preview__experience-dates">
                          {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                        </span>
                      </div>
                      <div className="cv-preview__experience-company">
                        {exp.company} {exp.location && `• ${exp.location}`}
                      </div>
                      {exp.description && (
                        <div className="cv-preview__experience-description">
                          {exp.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

const CvBuilderInterface = () => {
  const [activeTab, setActiveTab] = useState('personal');
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [atsScore, setAtsScore] = useState(78);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());

  const form = useForm({
    resolver: zodResolver(CvSchema),
    defaultValues: {
      personalInfo: {
        fullName: '',
        email: '',
        phone: '',
        location: '',
        website: '',
        linkedin: '',
        github: ''
      },
      summary: '',
      experience: [],
      education: [],
      skills: [],
      projects: []
    }
  });

  const { formState: { errors } } = form;

  // Auto-save functionality
  useEffect(() => {
    const subscription = form.watch(() => {
      setIsAutoSaving(true);
      setTimeout(() => {
        setIsAutoSaving(false);
        setLastSaved(new Date());
      }, 1000);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleExport = async () => {
    const cvData = form.getValues();
    // Simulate export process
    console.log('Exporting CV:', cvData);
  };

  const handleSave = async () => {
    const cvData = form.getValues();
    // Simulate save process
    console.log('Saving CV:', cvData);
  };

  return (
    <div className="cv-builder-interface">
      <div className="cv-builder-interface__header">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cv-builder-interface__title"
        >
          <FileText className="cv-builder-interface__title-icon" />
          <h1>AI-Powered CV Builder</h1>
          <p>Create a professional CV that gets you noticed</p>
        </motion.div>
        
        <div className="cv-builder-interface__header-actions">
          <div className="cv-builder-interface__save-status">
            {isAutoSaving ? (
              <StatusIndicator status="processing" label="Auto-saving..." animated={true} />
            ) : (
              <StatusIndicator status="success" label={`Saved ${lastSaved.toLocaleTimeString()}`} />
            )}
          </div>
          
          <Button variant="outline" onClick={handleSave} icon={<Save />}>
            Save Draft
          </Button>
          <Button variant="primary" onClick={handleExport} icon={<Download />} glow={true}>
            Export PDF
          </Button>
        </div>
      </div>

      <div className="cv-builder-interface__content">
        <div className="cv-builder-interface__editor">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="cv-builder-interface__tabs">
            <TabsList size="large" variant="elevated">
              <TabsTrigger value="template" icon={<Template />}>Template</TabsTrigger>
              <TabsTrigger value="personal" icon={<User />}>Personal</TabsTrigger>
              <TabsTrigger value="summary" icon={<FileText />}>Summary</TabsTrigger>
              <TabsTrigger value="experience" icon={<Briefcase />}>Experience</TabsTrigger>
              <TabsTrigger value="skills" icon={<Target />}>Skills</TabsTrigger>
              <TabsTrigger value="education" icon={<Calendar />}>Education</TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="cv-builder-interface__tab-content">
              <TemplateSelector 
                selectedTemplate={selectedTemplate}
                onTemplateChange={setSelectedTemplate}
              />
            </TabsContent>

            <TabsContent value="personal" className="cv-builder-interface__tab-content">
              <PersonalInfoEditor form={form} errors={errors} />
            </TabsContent>

            <TabsContent value="summary" className="cv-builder-interface__tab-content">
              <SummaryEditor form={form} errors={errors} />
            </TabsContent>

            <TabsContent value="experience" className="cv-builder-interface__tab-content">
              <ExperienceEditor form={form} errors={errors} />
            </TabsContent>

            <TabsContent value="skills" className="cv-builder-interface__tab-content">
              <SkillsEditor form={form} errors={errors} />
            </TabsContent>

            <TabsContent value="education" className="cv-builder-interface__tab-content">
              {/* Education editor would go here */}
              <Card variant="default">
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <Calendar size={48} style={{ color: 'rgba(148, 163, 184, 0.5)', margin: '0 auto 1rem' }} />
                  <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>Education Editor</h3>
                  <p style={{ color: 'rgba(148, 163, 184, 0.7)' }}>Education section coming soon...</p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="cv-builder-interface__sidebar">
          <ATSScorePanel score={atsScore} />
          <PreviewPanel 
            cvData={form.watch()} 
            selectedTemplate={selectedTemplate}
          />
        </div>
      </div>
    </div>
  );
};

export default CvBuilderInterface;
