import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, Briefcase, MapPin, DollarSign, Clock, Heart, 
  Send, Eye, ChevronRight, Star, TrendingUp, Target, Zap,
  Calendar, Users, Building, CheckCircle, XCircle, AlertCircle,
  BookOpen, Award, Globe, Loader2, ArrowUp, ArrowDown, 
  BarChart3, PieChart, Activity, FileText, Download, Share2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const JobSeekerFlow = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    salary: { min: 0, max: 200000 },
    jobType: [],
    experience: '',
    remote: false
  });
  const [jobs, setJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [matchScore, setMatchScore] = useState(0);

  // Mock data for demonstration
  useEffect(() => {
    const mockJobs = [
      {
        id: 1,
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'Cape Town',
        salary: { min: 80000, max: 120000 },
        type: 'Full-time',
        remote: true,
        posted: '2 days ago',
        matchScore: 95,
        description: 'Looking for an experienced software engineer...',
        requirements: ['5+ years experience', 'React', 'Node.js'],
        benefits: ['Medical aid', 'Remote work', 'Stock options']
      },
      {
        id: 2,
        title: 'Full Stack Developer',
        company: 'StartupXYZ',
        location: 'Johannesburg',
        salary: { min: 60000, max: 90000 },
        type: 'Full-time',
        remote: false,
        posted: '1 week ago',
        matchScore: 88,
        description: 'Join our growing team...',
        requirements: ['3+ years experience', 'JavaScript', 'Python'],
        benefits: ['Flexible hours', 'Learning budget']
      }
    ];
    setJobs(mockJobs);

    const mockApplications = [
      {
        id: 1,
        jobTitle: 'Frontend Developer',
        company: 'Digital Agency',
        status: 'under_review',
        appliedDate: '2024-01-15',
        lastUpdate: '2024-01-18'
      },
      {
        id: 2,
        jobTitle: 'React Developer',
        company: 'E-commerce Co',
        status: 'interview_scheduled',
        appliedDate: '2024-01-10',
        lastUpdate: '2024-01-17',
        interviewDate: '2024-01-25'
      }
    ];
    setApplications(mockApplications);
  }, []);

  const handleJobSearch = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const saveJob = (jobId) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter(id => id !== jobId));
    } else {
      setSavedJobs([...savedJobs, jobId]);
    }
  };

  const applyToJob = (job) => {
    const newApplication = {
      id: applications.length + 1,
      jobTitle: job.title,
      company: job.company,
      status: 'submitted',
      appliedDate: new Date().toISOString().split('T')[0],
      lastUpdate: new Date().toISOString().split('T')[0]
    };
    setApplications([...applications, newApplication]);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'submitted': return 'text-blue-400 bg-blue-400/10';
      case 'under_review': return 'text-yellow-400 bg-yellow-400/10';
      case 'interview_scheduled': return 'text-green-400 bg-green-400/10';
      case 'rejected': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'submitted': return AlertCircle;
      case 'under_review': return Clock;
      case 'interview_scheduled': return Calendar;
      case 'rejected': return XCircle;
      case 'accepted': return CheckCircle;
      default: return AlertCircle;
    }
  };

  const views = [
    { id: 'search', label: 'Job Search', icon: Search },
    { id: 'matches', label: 'AI Matches', icon: Target },
    { id: 'saved', label: 'Saved Jobs', icon: Heart },
    { id: 'applications', label: 'Applications', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Job Seeker Dashboard</h1>
          <p className="text-gray-400">Find your perfect job with AI-powered matching</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8 flex gap-2 overflow-x-auto">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeView === view.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {activeView === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search Bar */}
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-800">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Job title, keywords, or company"
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                      type="text"
                      value={filters.location}
                      onChange={(e) => setFilters({...filters, location: e.target.value})}
                      placeholder="Location"
                      className="pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                  <button
                    onClick={handleJobSearch}
                    className="px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    Search
                  </button>
                </div>

                {/* Filters */}
                <div className="mt-4 flex gap-2">
                  <button className="px-3 py-1 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 hover:border-cyan-400">
                    <Filter className="h-4 w-4 inline mr-1" />
                    All Filters
                  </button>
                  <button className="px-3 py-1 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400">
                    Remote
                  </button>
                  <button className="px-3 py-1 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400">
                    Full-time
                  </button>
                  <button className="px-3 py-1 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400">
                    Entry Level
                  </button>
                </div>
              </div>

              {/* Job Listings */}
              <div className="grid gap-4">
                {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800 hover:border-cyan-400/50 transition-all cursor-pointer"
                    onClick={() => setSelectedJob(job)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-white mb-2">{job.title}</h3>
                            <p className="text-cyan-400 mb-2">{job.company}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-green-400/10 text-green-400 rounded-lg text-sm">
                              {job.matchScore}% Match
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveJob(job.id);
                              }}
                              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                            >
                              <Heart className={`h-5 w-5 ${savedJobs.includes(job.id) ? 'text-red-400 fill-current' : 'text-gray-400'}`} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-3">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            R{job.salary.min/1000}k - R{job.salary.max/1000}k
                          </span>
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-4 w-4" />
                            {job.type}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {job.posted}
                          </span>
                        </div>

                        <p className="text-gray-300 mb-3">{job.description}</p>

                        <div className="flex gap-2">
                          {job.requirements.slice(0, 3).map((req, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-800/50 rounded text-xs text-gray-400">
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          applyToJob(job);
                        }}
                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 flex items-center gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Quick Apply
                      </button>
                      <button className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50">
                        View Details
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <div className="text-center mb-6">
                  <Target className="h-12 w-12 text-cyan-400 mx-auto mb-3" />
                  <h2 className="text-2xl font-bold text-white mb-2">AI-Powered Job Matches</h2>
                  <p className="text-gray-400">Jobs perfectly matched to your profile and preferences</p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                    <p className="text-3xl font-bold text-cyan-400">95%</p>
                    <p className="text-sm text-gray-400">Average Match Score</p>
                  </div>
                  <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                    <p className="text-3xl font-bold text-purple-400">24</p>
                    <p className="text-sm text-gray-400">New Matches Today</p>
                  </div>
                  <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                    <p className="text-3xl font-bold text-green-400">7</p>
                    <p className="text-sm text-gray-400">Perfect Matches</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {jobs.filter(job => job.matchScore > 85).map((job) => (
                    <div key={job.id} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-white">{job.title}</h3>
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-400" />
                          <span className="text-yellow-400 font-semibold">{job.matchScore}% Match</span>
                        </div>
                      </div>
                      <p className="text-cyan-400 mb-2">{job.company}</p>
                      <p className="text-gray-400 text-sm mb-3">AI Analysis: Strong match based on your skills in React and Node.js, plus your preference for remote work.</p>
                      <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
                        View Match Details
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'applications' && (
            <motion.div
              key="applications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <h2 className="text-2xl font-bold text-white mb-6">Application Tracker</h2>
                
                <div className="space-y-4">
                  {applications.map((app) => {
                    const StatusIcon = getStatusIcon(app.status);
                    return (
                      <div key={app.id} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-1">{app.jobTitle}</h3>
                            <p className="text-cyan-400 mb-2">{app.company}</p>
                            <div className="flex gap-4 text-sm text-gray-400">
                              <span>Applied: {app.appliedDate}</span>
                              <span>Updated: {app.lastUpdate}</span>
                              {app.interviewDate && (
                                <span className="text-green-400">Interview: {app.interviewDate}</span>
                              )}
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-lg flex items-center gap-2 ${getStatusColor(app.status)}`}>
                            <StatusIcon className="h-4 w-4" />
                            <span className="text-sm capitalize">{app.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <Eye className="h-8 w-8 text-cyan-400" />
                    <span className="text-green-400 text-sm flex items-center gap-1">
                      <ArrowUp className="h-3 w-3" />
                      12%
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white">248</p>
                  <p className="text-gray-400">Profile Views</p>
                </div>

                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <Send className="h-8 w-8 text-purple-400" />
                    <span className="text-green-400 text-sm flex items-center gap-1">
                      <ArrowUp className="h-3 w-3" />
                      8%
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white">34</p>
                  <p className="text-gray-400">Applications Sent</p>
                </div>

                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <Calendar className="h-8 w-8 text-green-400" />
                    <span className="text-green-400 text-sm flex items-center gap-1">
                      <ArrowUp className="h-3 w-3" />
                      25%
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white">5</p>
                  <p className="text-gray-400">Interviews Scheduled</p>
                </div>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <h3 className="text-xl font-bold text-white mb-4">Application Success Rate</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Response Rate</span>
                      <span className="text-white">68%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400" style={{ width: '68%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Interview Rate</span>
                      <span className="text-white">42%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400" style={{ width: '42%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Offer Rate</span>
                      <span className="text-white">15%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400" style={{ width: '15%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'saved' && (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <h2 className="text-2xl font-bold text-white mb-6">Saved Jobs</h2>
                {savedJobs.length > 0 ? (
                  <div className="grid gap-4">
                    {jobs.filter(job => savedJobs.includes(job.id)).map((job) => (
                      <div key={job.id} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-2">{job.title}</h3>
                        <p className="text-cyan-400 mb-2">{job.company}</p>
                        <div className="flex gap-3 mt-3">
                          <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
                            Apply Now
                          </button>
                          <button 
                            onClick={() => saveJob(job.id)}
                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Heart className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No saved jobs yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default JobSeekerFlow;
