import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Briefcase, Users, Calendar, Filter, Search, Star, 
  MessageSquare, Video, Mail, Phone, Clock, CheckCircle, XCircle,
  TrendingUp, BarChart3, PieChart, Eye, FileText, Download,
  Settings, Edit3, Trash2, Copy, Share2, Globe, MapPin,
  DollarSign, Building, Target, Zap, Award, Heart, Shield,
  ArrowUp, ArrowDown, AlertCircle, Loader2, Send, Archive
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EmployerFlow = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('jobs');
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [jobForm, setJobForm] = useState({
    title: '',
    department: '',
    location: '',
    type: 'Full-time',
    remote: false,
    salaryMin: '',
    salaryMax: '',
    description: '',
    requirements: [],
    benefits: [],
    skills: []
  });

  // Mock data
  useEffect(() => {
    const mockJobs = [
      {
        id: 1,
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'Cape Town',
        type: 'Full-time',
        remote: true,
        status: 'active',
        posted: '2024-01-10',
        applications: 45,
        views: 320,
        candidates: {
          new: 12,
          screening: 8,
          interview: 5,
          offer: 2
        }
      },
      {
        id: 2,
        title: 'Product Manager',
        department: 'Product',
        location: 'Johannesburg',
        type: 'Full-time',
        remote: false,
        status: 'active',
        posted: '2024-01-05',
        applications: 28,
        views: 180,
        candidates: {
          new: 8,
          screening: 6,
          interview: 3,
          offer: 1
        }
      }
    ];
    setJobs(mockJobs);

    const mockCandidates = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+27 12 345 6789',
        position: 'Senior Software Engineer',
        status: 'screening',
        matchScore: 92,
        applied: '2024-01-15',
        skills: ['React', 'Node.js', 'TypeScript'],
        experience: '5 years'
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+27 98 765 4321',
        position: 'Senior Software Engineer',
        status: 'interview',
        matchScore: 88,
        applied: '2024-01-14',
        skills: ['Python', 'Django', 'AWS'],
        experience: '7 years',
        interviewDate: '2024-01-25'
      }
    ];
    setCandidates(mockCandidates);
  }, []);

  const handleJobSubmit = () => {
    const newJob = {
      id: jobs.length + 1,
      ...jobForm,
      status: 'active',
      posted: new Date().toISOString().split('T')[0],
      applications: 0,
      views: 0,
      candidates: {
        new: 0,
        screening: 0,
        interview: 0,
        offer: 0
      }
    };
    setJobs([...jobs, newJob]);
    setShowJobForm(false);
    setJobForm({
      title: '',
      department: '',
      location: '',
      type: 'Full-time',
      remote: false,
      salaryMin: '',
      salaryMax: '',
      description: '',
      requirements: [],
      benefits: [],
      skills: []
    });
  };

  const updateCandidateStatus = (candidateId, newStatus) => {
    setCandidates(candidates.map(c => 
      c.id === candidateId ? { ...c, status: newStatus } : c
    ));
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'new': return 'text-blue-400 bg-blue-400/10';
      case 'screening': return 'text-yellow-400 bg-yellow-400/10';
      case 'interview': return 'text-purple-400 bg-purple-400/10';
      case 'offer': return 'text-green-400 bg-green-400/10';
      case 'rejected': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const views = [
    { id: 'jobs', label: 'Job Postings', icon: Briefcase },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'pipeline', label: 'Hiring Pipeline', icon: Target },
    { id: 'interviews', label: 'Interviews', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Employer Dashboard</h1>
          <p className="text-gray-400">Manage your job postings and find the perfect candidates</p>
        </div>

        {/* Navigation */}
        <div className="mb-8 flex gap-2 overflow-x-auto">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeView === view.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeView === 'jobs' && (
            <motion.div
              key="jobs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Action Bar */}
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search jobs..."
                      className="pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                  <button className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 hover:border-purple-400">
                    <Filter className="h-4 w-4 inline mr-2" />
                    Filter
                  </button>
                </div>
                <button
                  onClick={() => setShowJobForm(true)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Post New Job
                </button>
              </div>

              {/* Job Listings */}
              <div className="grid gap-4">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-semibold text-white mb-1">{job.title}</h3>
                            <div className="flex gap-4 text-sm text-gray-400">
                              <span className="flex items-center gap-1">
                                <Building className="h-4 w-4" />
                                {job.department}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {job.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-4 w-4" />
                                {job.type}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button className="p-2 hover:bg-gray-800 rounded-lg">
                              <Edit3 className="h-4 w-4 text-gray-400" />
                            </button>
                            <button className="p-2 hover:bg-gray-800 rounded-lg">
                              <Copy className="h-4 w-4 text-gray-400" />
                            </button>
                            <button className="p-2 hover:bg-gray-800 rounded-lg">
                              <Archive className="h-4 w-4 text-gray-400" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                            <p className="text-2xl font-bold text-white">{job.applications}</p>
                            <p className="text-xs text-gray-400">Applications</p>
                          </div>
                          <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                            <p className="text-2xl font-bold text-cyan-400">{job.views}</p>
                            <p className="text-xs text-gray-400">Views</p>
                          </div>
                          <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                            <p className="text-2xl font-bold text-purple-400">{job.candidates.interview}</p>
                            <p className="text-xs text-gray-400">Interviews</p>
                          </div>
                          <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                            <p className="text-2xl font-bold text-green-400">{job.candidates.offer}</p>
                            <p className="text-xs text-gray-400">Offers</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Posted on {job.posted}</span>
                          <button className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30">
                            View Candidates
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'candidates' && (
            <motion.div
              key="candidates"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <h2 className="text-2xl font-bold text-white mb-6">Candidate Management</h2>
                
                <div className="space-y-4">
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{candidate.name}</h3>
                              <p className="text-purple-400">{candidate.position}</p>
                              <div className="flex gap-4 text-sm text-gray-400 mt-1">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {candidate.email}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {candidate.phone}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-3 py-1 bg-green-400/10 text-green-400 rounded-lg text-sm">
                                {candidate.matchScore}% Match
                              </span>
                              <span className={`px-3 py-1 rounded-lg text-sm ${getStatusColor(candidate.status)}`}>
                                {candidate.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              {candidate.skills.slice(0, 3).map((skill, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                                  {skill}
                                </span>
                              ))}
                              <span className="text-xs text-gray-500">
                                • {candidate.experience}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <button className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30">
                                <MessageSquare className="h-4 w-4 inline mr-1" />
                                Message
                              </button>
                              <button className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30">
                                <Video className="h-4 w-4 inline mr-1" />
                                Schedule Interview
                              </button>
                              <button className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
                                View Profile
                              </button>
                            </div>
                          </div>

                          {candidate.interviewDate && (
                            <div className="mt-3 p-2 bg-purple-500/10 border border-purple-500/30 rounded text-sm text-purple-400">
                              <Calendar className="h-4 w-4 inline mr-2" />
                              Interview scheduled: {candidate.interviewDate}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'pipeline' && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <h2 className="text-2xl font-bold text-white mb-6">Hiring Pipeline</h2>
                
                <div className="grid grid-cols-5 gap-4">
                  {['New', 'Screening', 'Interview', 'Offer', 'Hired'].map((stage) => (
                    <div key={stage} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-400 mb-3">{stage}</h3>
                      <div className="space-y-2">
                        {candidates
                          .filter(c => c.status === stage.toLowerCase())
                          .map((candidate) => (
                            <div key={candidate.id} className="p-2 bg-gray-800 rounded text-sm">
                              <p className="text-white font-medium">{candidate.name}</p>
                              <p className="text-xs text-gray-400">{candidate.position}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'interviews' && (
            <motion.div
              key="interviews"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <h2 className="text-2xl font-bold text-white mb-6">Interview Schedule</h2>
                
                <div className="space-y-4">
                  {candidates
                    .filter(c => c.interviewDate)
                    .map((candidate) => (
                      <div key={candidate.id} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{candidate.name}</h3>
                            <p className="text-purple-400">{candidate.position}</p>
                            <p className="text-sm text-gray-400 mt-1">
                              <Calendar className="h-4 w-4 inline mr-1" />
                              {candidate.interviewDate} at 2:00 PM
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">
                              <Video className="h-4 w-4 inline mr-2" />
                              Join Interview
                            </button>
                            <button className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">
                              Reschedule
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                  <Users className="h-8 w-8 text-purple-400 mb-4" />
                  <p className="text-2xl font-bold text-white">156</p>
                  <p className="text-gray-400">Total Applicants</p>
                  <span className="text-green-400 text-sm">
                    <ArrowUp className="h-3 w-3 inline" /> 23%
                  </span>
                </div>

                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                  <Calendar className="h-8 w-8 text-cyan-400 mb-4" />
                  <p className="text-2xl font-bold text-white">18</p>
                  <p className="text-gray-400">Interviews</p>
                  <span className="text-green-400 text-sm">
                    <ArrowUp className="h-3 w-3 inline" /> 12%
                  </span>
                </div>

                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                  <CheckCircle className="h-8 w-8 text-green-400 mb-4" />
                  <p className="text-2xl font-bold text-white">7</p>
                  <p className="text-gray-400">Hires Made</p>
                  <span className="text-green-400 text-sm">
                    <ArrowUp className="h-3 w-3 inline" /> 40%
                  </span>
                </div>

                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800">
                  <Clock className="h-8 w-8 text-yellow-400 mb-4" />
                  <p className="text-2xl font-bold text-white">21</p>
                  <p className="text-gray-400">Avg. Days to Hire</p>
                  <span className="text-red-400 text-sm">
                    <ArrowDown className="h-3 w-3 inline" /> 15%
                  </span>
                </div>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
                <h3 className="text-xl font-bold text-white mb-4">Hiring Funnel</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Applications</span>
                      <span className="text-white">156</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Screening</span>
                      <span className="text-white">82</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400" style={{ width: '52%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Interviews</span>
                      <span className="text-white">18</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400" style={{ width: '12%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Offers</span>
                      <span className="text-white">7</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400" style={{ width: '4.5%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Job Form Modal */}
        <AnimatePresence>
          {showJobForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-800"
              >
                <h2 className="text-2xl font-bold text-white mb-6">Post New Job</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Job Title</label>
                    <input
                      type="text"
                      value={jobForm.title}
                      onChange={(e) => setJobForm({...jobForm, title: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="e.g., Senior Software Engineer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Department</label>
                      <input
                        type="text"
                        value={jobForm.department}
                        onChange={(e) => setJobForm({...jobForm, department: e.target.value})}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="e.g., Engineering"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                      <input
                        type="text"
                        value={jobForm.location}
                        onChange={(e) => setJobForm({...jobForm, location: e.target.value})}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="e.g., Cape Town"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea
                      value={jobForm.description}
                      onChange={(e) => setJobForm({...jobForm, description: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      rows={4}
                      placeholder="Describe the role and responsibilities..."
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowJobForm(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleJobSubmit}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                    >
                      Post Job
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EmployerFlow;
