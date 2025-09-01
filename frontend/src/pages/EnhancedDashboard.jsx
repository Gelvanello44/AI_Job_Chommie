import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Sparkles, TrendingUp, Briefcase, Users, DollarSign,
  Search, Filter, Bell, Settings, LogOut, Plus, Calendar,
  Clock, MapPin, Building, Star, Heart, Share2, Eye,
  ChevronRight, ChevronLeft, ArrowRight, ArrowUpRight,
  Target, Award, BookOpen, MessageSquare, FileText,
  BarChart3, PieChart, Activity, Zap, Shield, Check,
  X, AlertCircle, Info, Loader2, Download, Upload,
  Send, Archive, Trash2, Edit, MoreVertical, Grid,
  List, Bookmark, ThumbsUp, UserCheck, UserPlus,
  Mail, Phone, Linkedin, Github, Globe, Coffee
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Mock data for demonstration
const mockJobSeekerData = {
  profile: {
    name: 'John Doe',
    title: 'Senior Software Engineer',
    location: 'San Francisco, CA',
    profileCompletion: 85,
    profileViews: 127,
    searchAppearances: 342,
    applicationsSent: 23,
    interviewsScheduled: 5
  },
  stats: {
    weekly: {
      applications: 8,
      interviews: 2,
      views: 45,
      matches: 12
    },
    trend: '+23%'
  },
  aiScore: {
    overall: 87,
    resume: 92,
    skills: 85,
    experience: 88,
    education: 84
  },
  recentActivity: [
    { type: 'application', company: 'Tech Corp', role: 'Senior Developer', time: '2 hours ago', status: 'submitted' },
    { type: 'interview', company: 'StartupXYZ', role: 'Full Stack Engineer', time: '1 day ago', status: 'scheduled' },
    { type: 'match', company: 'Innovation Labs', role: 'Tech Lead', time: '2 days ago', status: 'new' },
    { type: 'view', company: 'Digital Agency', role: 'Software Architect', time: '3 days ago', status: 'viewed' }
  ],
  recommendedJobs: [
    {
      id: 1,
      title: 'Senior Software Engineer',
      company: 'TechGiant Inc',
      location: 'San Francisco, CA',
      salary: '$150k - $200k',
      type: 'Full-time',
      remote: true,
      matchScore: 94,
      logo: '',
      posted: '2 days ago',
      saved: false
    },
    {
      id: 2,
      title: 'Full Stack Developer',
      company: 'StartupHub',
      location: 'New York, NY',
      salary: '$130k - $170k',
      type: 'Full-time',
      remote: true,
      matchScore: 89,
      logo: '',
      posted: '1 week ago',
      saved: true
    },
    {
      id: 3,
      title: 'Tech Lead',
      company: 'Innovation Co',
      location: 'Austin, TX',
      salary: '$160k - $210k',
      type: 'Full-time',
      remote: false,
      matchScore: 86,
      logo: '',
      posted: '3 days ago',
      saved: false
    }
  ],
  upcomingInterviews: [
    {
      company: 'Tech Corp',
      role: 'Senior Developer',
      date: '2024-01-15',
      time: '10:00 AM',
      type: 'Video Call',
      interviewer: 'Sarah Johnson'
    },
    {
      company: 'StartupXYZ',
      role: 'Full Stack Engineer',
      date: '2024-01-17',
      time: '2:00 PM',
      type: 'On-site',
      interviewer: 'Mike Chen'
    }
  ]
};

const mockEmployerData = {
  company: {
    name: 'TechGiant Inc',
    industry: 'Technology',
    size: '1000+ employees',
    activeJobs: 12,
    totalApplications: 234,
    newApplications: 45,
    scheduledInterviews: 8
  },
  stats: {
    weekly: {
      applications: 67,
      interviews: 12,
      hires: 3,
      views: 892
    },
    trend: '+34%'
  },
  jobPerformance: [
    { title: 'Senior Developer', applications: 45, interviews: 8, status: 'active' },
    { title: 'Product Manager', applications: 32, interviews: 5, status: 'active' },
    { title: 'UX Designer', applications: 28, interviews: 4, status: 'active' },
    { title: 'Data Scientist', applications: 19, interviews: 2, status: 'paused' }
  ],
  recentCandidates: [
    {
      id: 1,
      name: 'Alice Smith',
      role: 'Senior Developer',
      matchScore: 92,
      experience: '8 years',
      status: 'new',
      avatar: ''
    },
    {
      id: 2,
      name: 'Bob Wilson',
      role: 'Product Manager',
      matchScore: 88,
      experience: '6 years',
      status: 'reviewing',
      avatar: ''
    },
    {
      id: 3,
      name: 'Carol Davis',
      role: 'UX Designer',
      matchScore: 85,
      experience: '5 years',
      status: 'interview',
      avatar: ''
    }
  ]
};

const EnhancedDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [selectedTimeRange, setSelectedTimeRange] = useState('week'); // week, month, year
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isJobSeeker = user?.accountType === 'job_seeker';
  const data = isJobSeeker ? mockJobSeekerData : mockEmployerData;

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Brain className="h-10 w-10 text-cyan-400" />
                <Sparkles className="h-5 w-5 text-purple-400 absolute -top-1 -right-1" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AI Job Chommie</h1>
                <p className="text-xs text-gray-400">Welcome back, {isJobSeeker ? data.profile.name : data.company.name}!</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/dashboard" className="text-cyan-400 font-medium">Dashboard</Link>
              {isJobSeeker ? (
                <>
                  <Link to="/jobs" className="text-gray-300 hover:text-white transition-colors">Jobs</Link>
                  <Link to="/applications" className="text-gray-300 hover:text-white transition-colors">Applications</Link>
                  <Link to="/interviews" className="text-gray-300 hover:text-white transition-colors">Interviews</Link>
                </>
              ) : (
                <>
                  <Link to="/post-job" className="text-gray-300 hover:text-white transition-colors">Post Job</Link>
                  <Link to="/candidates" className="text-gray-300 hover:text-white transition-colors">Candidates</Link>
                  <Link to="/analytics" className="text-gray-300 hover:text-white transition-colors">Analytics</Link>
                </>
              )}
              <Link to="/messages" className="text-gray-300 hover:text-white transition-colors">Messages</Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <Link to="/settings" className="p-2 text-gray-400 hover:text-white transition-colors">
                <Settings className="h-6 w-6" />
              </Link>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {isJobSeeker ? (
          // Job Seeker Dashboard
          <div className="space-y-8">
            {/* Welcome Section with Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl p-8 border border-gray-800"
            >
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Welcome back, {data.profile.name}!
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Your AI-powered job search is actively working for you. Here's what's new today.
                  </p>
                  <div className="flex gap-4">
                    <Link
                      to="/jobs"
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all"
                    >
                      Browse Jobs
                    </Link>
                    <Link
                      to="/profile"
                      className="px-6 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all"
                    >
                      Update Profile
                    </Link>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Eye className="h-5 w-5 text-cyan-400" />
                      <span className="text-xs text-green-400">+15%</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.profile.profileViews}</p>
                    <p className="text-xs text-gray-400">Profile views</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Search className="h-5 w-5 text-purple-400" />
                      <span className="text-xs text-green-400">+23%</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.profile.searchAppearances}</p>
                    <p className="text-xs text-gray-400">Search appearances</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Send className="h-5 w-5 text-cyan-400" />
                      <span className="text-xs text-green-400">+8</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.profile.applicationsSent}</p>
                    <p className="text-xs text-gray-400">Applications sent</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Calendar className="h-5 w-5 text-purple-400" />
                      <span className="text-xs text-yellow-400">Upcoming</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.profile.interviewsScheduled}</p>
                    <p className="text-xs text-gray-400">Interviews</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* AI Match Score & Profile Strength */}
            <div className="grid md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">AI Match Score</h3>
                  <Zap className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="relative">
                  <svg className="w-32 h-32 mx-auto">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-700"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(data.aiScore.overall / 100) * 351.86} 351.86`}
                      strokeLinecap="round"
                      transform="rotate(-90 64 64)"
                      className="text-cyan-400"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-white">{data.aiScore.overall}</p>
                      <p className="text-xs text-gray-400">Overall</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Resume</span>
                    <span className="text-cyan-400">{data.aiScore.resume}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Skills</span>
                    <span className="text-purple-400">{data.aiScore.skills}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Experience</span>
                    <span className="text-cyan-400">{data.aiScore.experience}%</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="md:col-span-2 bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Profile Strength</h3>
                  <span className="text-sm text-gray-400">{data.profile.profileCompletion}% Complete</span>
                </div>
                
                {/* Profile Completion Bar */}
                <div className="mb-6">
                  <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{ width: `${data.profile.profileCompletion}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Basic</span>
                    <span>Intermediate</span>
                    <span>Complete</span>
                  </div>
                </div>

                {/* Action Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-cyan-400" />
                      <div>
                        <p className="text-sm text-white">Upload Latest Resume</p>
                        <p className="text-xs text-gray-400">Boost your match score by 10%</p>
                      </div>
                    </div>
                    <button className="text-cyan-400 hover:text-cyan-300">
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="text-sm text-white">Add Certifications</p>
                        <p className="text-xs text-gray-400">Stand out to recruiters</p>
                      </div>
                    </div>
                    <button className="text-purple-400 hover:text-purple-300">
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Recommended Jobs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">AI-Matched Jobs for You</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'grid' ? 'bg-gray-800 text-cyan-400' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Grid className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'list' ? 'bg-gray-800 text-cyan-400' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <List className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className={viewMode === 'grid' ? 'grid md:grid-cols-3 gap-4' : 'space-y-4'}>
                {data.recommendedJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-cyan-500/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-3xl">{job.logo}</div>
                      <div className="flex items-center gap-1">
                        <div className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full font-semibold">
                          {job.matchScore}% Match
                        </div>
                      </div>
                    </div>
                    <h4 className="text-white font-semibold mb-1">{job.title}</h4>
                    <p className="text-gray-400 text-sm mb-3">{job.company}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                      {job.remote && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                          Remote
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{job.salary}</span>
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-red-400 transition-colors">
                          <Heart className={`h-4 w-4 ${job.saved ? 'fill-red-400 text-red-400' : ''}`} />
                        </button>
                        <button className="px-3 py-1 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600 transition-colors">
                          Apply
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link
                  to="/jobs"
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  View All Recommendations
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            {/* Recent Activity & Upcoming Interviews */}
            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {data.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                      <div className={`p-2 rounded-lg ${
                        activity.type === 'application' ? 'bg-cyan-500/20 text-cyan-400' :
                        activity.type === 'interview' ? 'bg-purple-500/20 text-purple-400' :
                        activity.type === 'match' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {activity.type === 'application' && <Send className="h-4 w-4" />}
                        {activity.type === 'interview' && <Calendar className="h-4 w-4" />}
                        {activity.type === 'match' && <Zap className="h-4 w-4" />}
                        {activity.type === 'view' && <Eye className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white">
                          {activity.type === 'application' && 'Applied to'}
                          {activity.type === 'interview' && 'Interview scheduled with'}
                          {activity.type === 'match' && 'New match at'}
                          {activity.type === 'view' && 'Profile viewed by'}
                          {' '}{activity.company}
                        </p>
                        <p className="text-xs text-gray-400">{activity.role} • {activity.time}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-600" />
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Upcoming Interviews</h3>
                <div className="space-y-3">
                  {data.upcomingInterviews.map((interview, index) => (
                    <div key={index} className="p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-white font-semibold">{interview.role}</h4>
                          <p className="text-sm text-gray-400">{interview.company}</p>
                        </div>
                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                          {interview.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(interview.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {interview.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {interview.interviewer}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors">
                          Prepare
                        </button>
                        <button className="px-3 py-1 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600 transition-colors">
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        ) : (
          // Employer Dashboard
          <div className="space-y-8">
            {/* Company Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-2xl p-8 border border-gray-800"
            >
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {data.company.name} Dashboard
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Your AI-powered recruitment is finding the best talent. Here's your hiring overview.
                  </p>
                  <div className="flex gap-4">
                    <Link
                      to="/post-job"
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all"
                    >
                      Post New Job
                    </Link>
                    <Link
                      to="/candidates"
                      className="px-6 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all"
                    >
                      View Candidates
                    </Link>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Briefcase className="h-5 w-5 text-purple-400" />
                      <span className="text-xs text-green-400">Active</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.company.activeJobs}</p>
                    <p className="text-xs text-gray-400">Job Postings</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="h-5 w-5 text-cyan-400" />
                      <span className="text-xs text-green-400">+{data.company.newApplications}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.company.totalApplications}</p>
                    <p className="text-xs text-gray-400">Total Applications</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Calendar className="h-5 w-5 text-purple-400" />
                      <span className="text-xs text-yellow-400">Scheduled</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.company.scheduledInterviews}</p>
                    <p className="text-xs text-gray-400">Interviews</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="h-5 w-5 text-cyan-400" />
                      <span className="text-xs text-green-400">{data.stats.trend}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{data.stats.weekly.hires}</p>
                    <p className="text-xs text-gray-400">Weekly Hires</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Job Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Job Performance</h3>
                <select className="bg-gray-800 text-white px-3 py-1 rounded-lg text-sm border border-gray-700">
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                      <th className="pb-3">Job Title</th>
                      <th className="pb-3">Applications</th>
                      <th className="pb-3">Interviews</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobPerformance.map((job, index) => (
                      <tr key={index} className="border-b border-gray-800/50">
                        <td className="py-3">
                          <div className="text-white font-medium">{job.title}</div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white">{job.applications}</span>
                            <div className="w-20 bg-gray-800 rounded-full h-2">
                              <div 
                                className="h-full rounded-full bg-cyan-500"
                                style={{ width: `${(job.applications / 50) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white">{job.interviews}</span>
                            <div className="w-20 bg-gray-800 rounded-full h-2">
                              <div 
                                className="h-full rounded-full bg-purple-500"
                                style={{ width: `${(job.interviews / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            job.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button className="p-1 text-gray-400 hover:text-white transition-colors">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-white transition-colors">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-white transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Recent Candidates */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Top AI-Matched Candidates</h3>
                <Link to="/candidates" className="text-cyan-400 hover:text-cyan-300 text-sm">
                  View All →
                </Link>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {data.recentCandidates.map((candidate) => (
                  <div key={candidate.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{candidate.avatar}</div>
                        <div>
                          <h4 className="text-white font-semibold">{candidate.name}</h4>
                          <p className="text-xs text-gray-400">{candidate.role}</p>
                        </div>
                      </div>
                      <div className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full font-semibold">
                        {candidate.matchScore}%
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      {candidate.experience} experience
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        candidate.status === 'new' ? 'bg-green-500/20 text-green-400' :
                        candidate.status === 'reviewing' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {candidate.status}
                      </span>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors">
                          View
                        </button>
                        <button className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition-colors">
                          Interview
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Analytics Overview */}
            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Hiring Funnel</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Applications</span>
                      <span className="text-white">234</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Screened</span>
                      <span className="text-white">156</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: '67%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Interviewed</span>
                      <span className="text-white">45</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: '19%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Offers Made</span>
                      <span className="text-white">12</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: '5%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Hired</span>
                      <span className="text-white">8</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3">
                      <div className="h-full rounded-full bg-green-500" style={{ width: '3%' }} />
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full p-3 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <Plus className="h-5 w-5 text-purple-400" />
                      <span className="text-white">Post New Job</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                  </button>
                  <button className="w-full p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <Search className="h-5 w-5 text-cyan-400" />
                      <span className="text-white">Search Candidates</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                  </button>
                  <button className="w-full p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-purple-400" />
                      <span className="text-white">Schedule Interviews</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                  </button>
                  <button className="w-full p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5 text-cyan-400" />
                      <span className="text-white">View Analytics</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EnhancedDashboard;
