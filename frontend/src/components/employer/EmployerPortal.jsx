import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Plus, 
  Users, 
  FileText, 
  TrendingUp, 
  Settings, 
  Search, 
  Filter, 
  Star, 
  Eye, 
  Download, 
  MessageSquare, 
  Calendar, 
  Clock,
  MapPin,
  DollarSign,
  Briefcase,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Award,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Bell,
  Edit3,
  Trash2,
  Copy,
  Share2,
  BookmarkPlus,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import './EmployerPortal.css';

const JobPostingCard = ({ job, onEdit, onDelete, onViewApplications, onToggleStatus }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'closed': return 'danger';
      case 'draft': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card 
        variant="default" 
        glow={isHovered} 
        hover={true}
        className="job-posting-card"
      >
        <div className="job-posting-card__header">
          <div className="job-posting-card__info">
            <h3 className="job-posting-card__title">{job.title}</h3>
            <div className="job-posting-card__meta">
              <span className="job-posting-card__department">{job.department}</span>
              <span className="job-posting-card__location">
                <MapPin size={12} />
                {job.location}
              </span>
              <span className="job-posting-card__type">{job.type}</span>
            </div>
          </div>
          
          <div className="job-posting-card__status">
            <Badge variant={getStatusVariant(job.status)} size="small">
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
          </div>
        </div>

        <div className="job-posting-card__stats">
          <div className="job-posting-card__stat">
            <div className="job-posting-card__stat-value">{job.applications || 0}</div>
            <div className="job-posting-card__stat-label">Applications</div>
          </div>
          <div className="job-posting-card__stat">
            <div className="job-posting-card__stat-value">{job.views || 0}</div>
            <div className="job-posting-card__stat-label">Views</div>
          </div>
          <div className="job-posting-card__stat">
            <div className="job-posting-card__stat-value">{job.matches || 0}</div>
            <div className="job-posting-card__stat-label">AI Matches</div>
          </div>
        </div>

        <div className="job-posting-card__details">
          <div className="job-posting-card__salary">
            <DollarSign size={14} />
            <span>{job.salary}</span>
          </div>
          <div className="job-posting-card__posted">
            <Clock size={14} />
            <span>Posted {job.postedDate}</span>
          </div>
        </div>

        <div className="job-posting-card__actions">
          <Button variant="ghost" size="small" onClick={() => onEdit(job.id)} icon={<Edit3 />}>
            Edit
          </Button>
          <Button variant="ghost" size="small" onClick={() => onViewApplications(job.id)} icon={<Users />}>
            Applications ({job.applications})
          </Button>
          <Button variant="outline" size="small" onClick={() => onToggleStatus(job.id)}>
            {job.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

const CandidateCard = ({ candidate, onViewProfile, onShortlist, onReject, onContact, isShortlisted = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getMatchColor = (score) => {
    if (score >= 90) return 'green';
    if (score >= 75) return 'cyan';
    if (score >= 60) return 'yellow';
    return 'pink';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card 
        variant="default" 
        glow={isHovered || isShortlisted} 
        hover={true}
        className={`candidate-card ${isShortlisted ? 'candidate-card--shortlisted' : ''}`}
      >
        <div className="candidate-card__header">
          <div className="candidate-card__profile">
            <Avatar size="medium" variant="rounded" glow={isShortlisted}>
              <img src={candidate.avatar || '/api/placeholder/48/48'} alt={candidate.name} />
            </Avatar>
            <div className="candidate-card__info">
              <h3 className="candidate-card__name">{candidate.name}</h3>
              <p className="candidate-card__title">{candidate.currentTitle}</p>
              <div className="candidate-card__location">
                <MapPin size={12} />
                <span>{candidate.location}</span>
              </div>
            </div>
          </div>
          
          <div className="candidate-card__match">
            <div className="candidate-card__match-score">
              <Progress 
                value={candidate.matchScore} 
                color={getMatchColor(candidate.matchScore)}
                size="small" 
                animated={true}
                showPercentage={true}
              />
            </div>
            <span className="candidate-card__match-label">Match Score</span>
          </div>
        </div>

        <div className="candidate-card__details">
          <div className="candidate-card__experience">
            <Briefcase size={14} />
            <span>{candidate.experience} years experience</span>
          </div>
          <div className="candidate-card__salary">
            <DollarSign size={14} />
            <span>{candidate.expectedSalary}</span>
          </div>
          <div className="candidate-card__applied">
            <Clock size={14} />
            <span>Applied {candidate.appliedDate}</span>
          </div>
        </div>

        <div className="candidate-card__skills">
          {candidate.topSkills?.slice(0, 4).map((skill, index) => (
            <Badge key={index} variant="secondary" size="small">
              {skill}
            </Badge>
          ))}
          {candidate.topSkills?.length > 4 && (
            <Badge variant="ghost" size="small">
              +{candidate.topSkills.length - 4} more
            </Badge>
          )}
        </div>

        <div className="candidate-card__actions">
          <Button 
            variant="ghost" 
            size="small" 
            onClick={() => onViewProfile(candidate.id)}
            icon={<Eye />}
          >
            View Profile
          </Button>
          <Button 
            variant="ghost" 
            size="small" 
            onClick={() => onContact(candidate.id)}
            icon={<MessageSquare />}
          >
            Contact
          </Button>
          <Button 
            variant={isShortlisted ? "outline" : "success"} 
            size="small" 
            onClick={() => onShortlist(candidate.id)}
            icon={isShortlisted ? <UserX /> : <UserCheck />}
            glow={!isShortlisted}
          >
            {isShortlisted ? 'Remove' : 'Shortlist'}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

const JobPostingForm = ({ job = null, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: job?.title || '',
    department: job?.department || '',
    location: job?.location || '',
    type: job?.type || 'full-time',
    experience: job?.experience || 'mid',
    salaryMin: job?.salaryMin || '',
    salaryMax: job?.salaryMax || '',
    description: job?.description || '',
    requirements: job?.requirements || '',
    benefits: job?.benefits || '',
    remote: job?.remote || false,
    urgent: job?.urgent || false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card variant="elevated" className="job-posting-form">
      <div className="job-posting-form__header">
        <h3 className="job-posting-form__title">
          <Plus size={20} />
          {job ? 'Edit Job Posting' : 'Create New Job Posting'}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="job-posting-form__form">
        <div className="job-posting-form__grid">
          <div className="job-posting-form__field">
            <label className="job-posting-form__label">Job Title *</label>
            <Input
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="e.g., Senior React Developer"
              required
              glow={true}
            />
          </div>

          <div className="job-posting-form__field">
            <label className="job-posting-form__label">Department</label>
            <Input
              value={formData.department}
              onChange={(e) => handleFieldChange('department', e.target.value)}
              placeholder="e.g., Engineering"
            />
          </div>

          <div className="job-posting-form__field">
            <label className="job-posting-form__label">Location</label>
            <Select value={formData.location} onValueChange={(value) => handleFieldChange('location', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cape-town">Cape Town, WC</SelectItem>
                <SelectItem value="johannesburg">Johannesburg, GP</SelectItem>
                <SelectItem value="durban">Durban, KZN</SelectItem>
                <SelectItem value="pretoria">Pretoria, GP</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="job-posting-form__field">
            <label className="job-posting-form__label">Job Type</label>
            <Select value={formData.type} onValueChange={(value) => handleFieldChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="job-posting-form__field">
            <label className="job-posting-form__label">Experience Level</label>
            <Select value={formData.experience} onValueChange={(value) => handleFieldChange('experience', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Entry Level</SelectItem>
                <SelectItem value="mid">Mid Level</SelectItem>
                <SelectItem value="senior">Senior Level</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="job-posting-form__field job-posting-form__field--salary">
            <label className="job-posting-form__label">Salary Range (ZAR)</label>
            <div className="job-posting-form__salary-inputs">
              <Input
                type="number"
                value={formData.salaryMin}
                onChange={(e) => handleFieldChange('salaryMin', e.target.value)}
                placeholder="Min"
              />
              <span className="job-posting-form__salary-separator">to</span>
              <Input
                type="number"
                value={formData.salaryMax}
                onChange={(e) => handleFieldChange('salaryMax', e.target.value)}
                placeholder="Max"
              />
            </div>
          </div>
        </div>

        <div className="job-posting-form__field">
          <label className="job-posting-form__label">Job Description *</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Describe the role, responsibilities, and what makes this opportunity exciting..."
            rows={6}
            className="job-posting-form__textarea"
            required
          />
        </div>

        <div className="job-posting-form__field">
          <label className="job-posting-form__label">Requirements</label>
          <textarea
            value={formData.requirements}
            onChange={(e) => handleFieldChange('requirements', e.target.value)}
            placeholder="List the key requirements, qualifications, and skills needed..."
            rows={4}
            className="job-posting-form__textarea"
          />
        </div>

        <div className="job-posting-form__field">
          <label className="job-posting-form__label">Benefits & Perks</label>
          <textarea
            value={formData.benefits}
            onChange={(e) => handleFieldChange('benefits', e.target.value)}
            placeholder="Highlight the benefits, perks, and company culture..."
            rows={3}
            className="job-posting-form__textarea"
          />
        </div>

        <div className="job-posting-form__options">
          <label className="job-posting-form__checkbox">
            <input
              type="checkbox"
              checked={formData.remote}
              onChange={(e) => handleFieldChange('remote', e.target.checked)}
            />
            <span>Remote work available</span>
          </label>
          <label className="job-posting-form__checkbox">
            <input
              type="checkbox"
              checked={formData.urgent}
              onChange={(e) => handleFieldChange('urgent', e.target.checked)}
            />
            <span>Urgent hiring</span>
          </label>
        </div>

        <div className="job-posting-form__actions">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" type="submit">
            Save as Draft
          </Button>
          <Button variant="primary" type="submit" glow={true}>
            {job ? 'Update Job' : 'Post Job'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

const CompanyAnalytics = ({ analytics }) => {
  const defaultAnalytics = {
    totalJobs: 12,
    activeJobs: 8,
    totalApplications: 156,
    shortlistedCandidates: 23,
    averageMatchScore: 78,
    responseRate: 45,
    timeToHire: 14,
    applicationTrends: [23, 31, 28, 42, 35, 48, 52]
  };

  const data = analytics || defaultAnalytics;

  return (
    <div className="company-analytics">
      <div className="company-analytics__overview">
        <div className="company-analytics__stat-cards">
          <Card variant="info" hover={true} className="company-analytics__stat-card">
            <div className="company-analytics__stat-icon">
              <Briefcase size={24} />
            </div>
            <div className="company-analytics__stat-content">
              <div className="company-analytics__stat-value">{data.totalJobs}</div>
              <div className="company-analytics__stat-label">Total Jobs</div>
            </div>
          </Card>

          <Card variant="success" hover={true} className="company-analytics__stat-card">
            <div className="company-analytics__stat-icon">
              <Users size={24} />
            </div>
            <div className="company-analytics__stat-content">
              <div className="company-analytics__stat-value">{data.totalApplications}</div>
              <div className="company-analytics__stat-label">Applications</div>
            </div>
          </Card>

          <Card variant="warning" hover={true} className="company-analytics__stat-card">
            <div className="company-analytics__stat-icon">
              <UserCheck size={24} />
            </div>
            <div className="company-analytics__stat-content">
              <div className="company-analytics__stat-value">{data.shortlistedCandidates}</div>
              <div className="company-analytics__stat-label">Shortlisted</div>
            </div>
          </Card>

          <Card variant="info" hover={true} className="company-analytics__stat-card">
            <div className="company-analytics__stat-icon">
              <Target size={24} />
            </div>
            <div className="company-analytics__stat-content">
              <div className="company-analytics__stat-value">{data.averageMatchScore}%</div>
              <div className="company-analytics__stat-label">Avg Match Score</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="company-analytics__detailed">
        <Card variant="elevated" className="company-analytics__chart-card">
          <div className="company-analytics__chart-header">
            <h3 className="company-analytics__chart-title">
              <BarChart3 size={20} />
              Application Trends
            </h3>
            <Button variant="ghost" size="small">View Details</Button>
          </div>
          
          <div className="company-analytics__chart">
            <div className="company-analytics__chart-bars">
              {data.applicationTrends.map((value, index) => (
                <motion.div
                  key={index}
                  className="company-analytics__chart-bar"
                  initial={{ height: 0 }}
                  animate={{ height: `${(value / 60) * 100}%` }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                />
              ))}
            </div>
            <div className="company-analytics__chart-labels">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                <span key={index} className="company-analytics__chart-label">{day}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card variant="default" className="company-analytics__metrics-card">
          <h3 className="company-analytics__metrics-title">Key Metrics</h3>
          <div className="company-analytics__metrics">
            <div className="company-analytics__metric">
              <div className="company-analytics__metric-label">Response Rate</div>
              <div className="company-analytics__metric-value">{data.responseRate}%</div>
              <Progress 
                value={data.responseRate} 
                color="cyan"
                size="small" 
                animated={true}
              />
            </div>
            
            <div className="company-analytics__metric">
              <div className="company-analytics__metric-label">Time to Hire</div>
              <div className="company-analytics__metric-value">{data.timeToHire} days</div>
              <Progress 
                value={(30 - data.timeToHire) / 30 * 100} 
                color="green"
                size="small" 
                animated={true}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const ApplicationsManager = ({ jobId = null, applications = [] }) => {
  const [filters, setFilters] = useState({
    status: 'all',
    matchScore: 'all',
    experience: 'all',
    search: ''
  });
  
  const [sortBy, setSortBy] = useState('match-score');
  const [shortlistedCandidates, setShortlistedCandidates] = useState(new Set());

  const mockApplications = [
    {
      id: 1,
      name: 'Sarah Johnson',
      currentTitle: 'Frontend Developer',
      location: 'Cape Town, WC',
      experience: 5,
      expectedSalary: 'R 75,000 - R 85,000',
      matchScore: 92,
      appliedDate: '2 hours ago',
      status: 'new',
      topSkills: ['React', 'TypeScript', 'Node.js', 'AWS', 'GraphQL'],
      avatar: '/api/placeholder/48/48'
    },
    {
      id: 2,
      name: 'Michael Chen',
      currentTitle: 'Full Stack Developer',
      location: 'Johannesburg, GP',
      experience: 3,
      expectedSalary: 'R 65,000 - R 75,000',
      matchScore: 85,
      appliedDate: '1 day ago',
      status: 'reviewed',
      topSkills: ['React', 'Python', 'Django', 'PostgreSQL'],
      avatar: '/api/placeholder/48/48'
    },
    {
      id: 3,
      name: 'Nomsa Mthembu',
      currentTitle: 'Software Engineer',
      location: 'Durban, KZN',
      experience: 4,
      expectedSalary: 'R 70,000 - R 80,000',
      matchScore: 78,
      appliedDate: '2 days ago',
      status: 'shortlisted',
      topSkills: ['JavaScript', 'Vue.js', 'PHP', 'MySQL'],
      avatar: '/api/placeholder/48/48'
    }
  ];

  const filteredApplications = mockApplications.filter(app => {
    if (filters.search && !app.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !app.currentTitle.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.status !== 'all' && app.status !== filters.status) {
      return false;
    }
    return true;
  });

  const handleShortlist = (candidateId) => {
    const newShortlisted = new Set(shortlistedCandidates);
    if (newShortlisted.has(candidateId)) {
      newShortlisted.delete(candidateId);
    } else {
      newShortlisted.add(candidateId);
    }
    setShortlistedCandidates(newShortlisted);
  };

  return (
    <div className="applications-manager">
      <div className="applications-manager__header">
        <h2 className="applications-manager__title">
          <Users size={24} />
          Application Management
          <Badge variant="info" size="small">{filteredApplications.length} applications</Badge>
        </h2>
        
        <div className="applications-manager__actions">
          <Button variant="outline" icon={<Download />}>
            Export List
          </Button>
          <Button variant="primary" icon={<MessageSquare />} glow={true}>
            Bulk Contact
          </Button>
        </div>
      </div>

      <Card variant="elevated" className="applications-manager__filters">
        <div className="applications-manager__filter-row">
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search candidates..."
            icon={<Search />}
            clearable={true}
            className="applications-manager__search"
          />
          
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger size="medium">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="shortlisted">Shortlisted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger size="medium">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match-score">Best Match</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="experience">Most Experience</SelectItem>
              <SelectItem value="salary">Salary Expectation</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="applications-manager__list">
        <AnimatePresence mode="wait">
          {filteredApplications.length > 0 ? (
            <motion.div
              key="applications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="applications-manager__grid"
            >
              {filteredApplications.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onViewProfile={(id) => console.log('View profile:', id)}
                  onShortlist={handleShortlist}
                  onReject={(id) => console.log('Reject candidate:', id)}
                  onContact={(id) => console.log('Contact candidate:', id)}
                  isShortlisted={shortlistedCandidates.has(candidate.id)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="applications-manager__empty"
            >
              <Card variant="ghost" className="text-center">
                <div className="applications-manager__empty-content">
                  <Users size={48} className="applications-manager__empty-icon" />
                  <h3>No applications found</h3>
                  <p>Applications matching your criteria will appear here</p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const CompanyProfile = ({ company }) => {
  const defaultCompany = {
    name: 'Your Company',
    industry: 'Technology',
    size: '50-100 employees',
    location: 'Cape Town, South Africa',
    website: 'https://yourcompany.com',
    description: 'We are a innovative technology company...',
    logo: '/api/placeholder/80/80',
    benefits: ['Health Insurance', 'Remote Work', 'Professional Development', 'Flexible Hours']
  };

  const companyData = company || defaultCompany;

  return (
    <div className="company-profile">
      <Card variant="elevated" className="company-profile__main">
        <div className="company-profile__header">
          <div className="company-profile__logo">
            <Avatar size="large" variant="rounded" glow={true}>
              <img src={companyData.logo} alt={companyData.name} />
            </Avatar>
          </div>
          
          <div className="company-profile__info">
            <h2 className="company-profile__name">{companyData.name}</h2>
            <div className="company-profile__details">
              <span className="company-profile__industry">{companyData.industry}</span>
              <span className="company-profile__size">{companyData.size}</span>
              <span className="company-profile__location">
                <MapPin size={14} />
                {companyData.location}
              </span>
            </div>
          </div>
          
          <div className="company-profile__actions">
            <Button variant="outline" icon={<Edit3 />}>
              Edit Profile
            </Button>
            <Button variant="primary" icon={<Eye />} glow={true}>
              Preview Public Profile
            </Button>
          </div>
        </div>

        <div className="company-profile__description">
          <h3>About Us</h3>
          <p>{companyData.description}</p>
        </div>

        <div className="company-profile__benefits">
          <h3>Employee Benefits</h3>
          <div className="company-profile__benefits-list">
            {companyData.benefits.map((benefit, index) => (
              <Badge key={index} variant="success" size="medium">
                <CheckCircle size={12} />
                {benefit}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

const EmployerPortal = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Mock data
  const [jobs, setJobs] = useState([
    {
      id: 1,
      title: 'Senior React Developer',
      department: 'Engineering',
      location: 'Cape Town, WC',
      type: 'Full-time',
      salary: 'R 75,000 - R 95,000',
      status: 'active',
      applications: 24,
      views: 156,
      matches: 12,
      postedDate: '3 days ago'
    },
    {
      id: 2,
      title: 'UX/UI Designer',
      department: 'Design',
      location: 'Johannesburg, GP',
      type: 'Full-time',
      salary: 'R 55,000 - R 70,000',
      status: 'active',
      applications: 18,
      views: 89,
      matches: 8,
      postedDate: '1 week ago'
    },
    {
      id: 3,
      title: 'Data Scientist',
      department: 'Analytics',
      location: 'Remote',
      type: 'Contract',
      salary: 'R 80,000 - R 100,000',
      status: 'paused',
      applications: 31,
      views: 203,
      matches: 15,
      postedDate: '2 weeks ago'
    }
  ]);

  const handleCreateJob = () => {
    setSelectedJob(null);
    setShowJobForm(true);
  };

  const handleEditJob = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setSelectedJob(job);
    setShowJobForm(true);
  };

  const handleSaveJob = (jobData) => {
    if (selectedJob) {
      // Update existing job
      setJobs(jobs.map(job => job.id === selectedJob.id ? { ...job, ...jobData } : job));
    } else {
      // Create new job
      const newJob = {
        id: Date.now(),
        ...jobData,
        status: 'active',
        applications: 0,
        views: 0,
        matches: 0,
        postedDate: 'Just now'
      };
      setJobs([newJob, ...jobs]);
    }
    setShowJobForm(false);
    setSelectedJob(null);
  };

  const handleDeleteJob = (jobId) => {
    setJobs(jobs.filter(job => job.id !== jobId));
  };

  const handleToggleJobStatus = (jobId) => {
    setJobs(jobs.map(job => 
      job.id === jobId 
        ? { ...job, status: job.status === 'active' ? 'paused' : 'active' }
        : job
    ));
  };

  return (
    <div className="employer-portal">
      <div className="employer-portal__header">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="employer-portal__title"
        >
          <Building2 className="employer-portal__title-icon" />
          <h1>Employer Portal</h1>
          <p>Manage your job postings and find the perfect candidates</p>
        </motion.div>
        
        <div className="employer-portal__header-actions">
          <Button variant="outline" icon={<Settings />}>
            Settings
          </Button>
          <Button variant="primary" onClick={handleCreateJob} icon={<Plus />} glow={true}>
            Post New Job
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="employer-portal__tabs">
        <TabsList size="large" variant="elevated">
          <TabsTrigger value="overview" icon={<Activity />}>Overview</TabsTrigger>
          <TabsTrigger value="jobs" icon={<Briefcase />}>Job Postings</TabsTrigger>
          <TabsTrigger value="applications" icon={<Users />}>Applications</TabsTrigger>
          <TabsTrigger value="analytics" icon={<TrendingUp />}>Analytics</TabsTrigger>
          <TabsTrigger value="profile" icon={<Building2 />}>Company Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="employer-portal__content">
          <div className="employer-portal__overview">
            <CompanyAnalytics />
            
            <div className="employer-portal__recent">
              <Card variant="default" className="employer-portal__recent-jobs">
                <div className="employer-portal__recent-header">
                  <h3>Recent Job Postings</h3>
                  <Button variant="ghost" size="small">View All</Button>
                </div>
                <div className="employer-portal__recent-list">
                  {jobs.slice(0, 3).map((job) => (
                    <JobPostingCard
                      key={job.id}
                      job={job}
                      onEdit={handleEditJob}
                      onDelete={handleDeleteJob}
                      onViewApplications={(id) => console.log('View applications:', id)}
                      onToggleStatus={handleToggleJobStatus}
                    />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="employer-portal__content">
          <div className="employer-portal__jobs">
            <div className="employer-portal__jobs-header">
              <h2>Job Postings Management</h2>
              <div className="employer-portal__jobs-stats">
                <Badge variant="success" size="medium">
                  {jobs.filter(j => j.status === 'active').length} Active
                </Badge>
                <Badge variant="warning" size="medium">
                  {jobs.filter(j => j.status === 'paused').length} Paused
                </Badge>
                <Badge variant="secondary" size="medium">
                  {jobs.filter(j => j.status === 'draft').length} Drafts
                </Badge>
              </div>
            </div>
            
            <div className="employer-portal__jobs-grid">
              {jobs.map((job) => (
                <JobPostingCard
                  key={job.id}
                  job={job}
                  onEdit={handleEditJob}
                  onDelete={handleDeleteJob}
                  onViewApplications={(id) => console.log('View applications:', id)}
                  onToggleStatus={handleToggleJobStatus}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="applications" className="employer-portal__content">
          <ApplicationsManager />
        </TabsContent>

        <TabsContent value="analytics" className="employer-portal__content">
          <CompanyAnalytics />
        </TabsContent>

        <TabsContent value="profile" className="employer-portal__content">
          <CompanyProfile />
        </TabsContent>
      </Tabs>

      {/* Job Posting Form Modal */}
      <AnimatePresence>
        {showJobForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="employer-portal__modal-overlay"
            onClick={() => setShowJobForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="employer-portal__modal"
              onClick={(e) => e.stopPropagation()}
            >
              <JobPostingForm
                job={selectedJob}
                onSave={handleSaveJob}
                onCancel={() => setShowJobForm(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployerPortal;
