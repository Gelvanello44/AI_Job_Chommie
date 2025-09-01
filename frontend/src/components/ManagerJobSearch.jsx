import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FiSearch, FiFilter, FiMapPin, FiDollarSign, 
  FiBriefcase, FiClock, FiUsers, FiTrendingUp,
  FiDownload, FiEye, FiExternalLink, FiStar
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const ManagerJobSearch = () => {
  const [searchParams, setSearchParams] = useState({
    query: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
    jobType: '',
    experience: '',
    industry: '',
    company: ''
  });

  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    datePosted: 'any',
    remote: false,
    urgent: false
  });

  const [searchStats, setSearchStats] = useState({
    totalResults: 1247,
    newToday: 23,
    avgSalary: 'R45,000',
    topLocation: 'Cape Town',
    totalSearches: 15843,
    successfulPlacements: 1205
  });

  // Mock job data for demonstration
  const mockJobs = [
    {
      id: 1,
      title: 'Senior Software Developer',
      company: 'TechCorp SA',
      location: 'Cape Town, WC',
      salary: 'R50,000 - R75,000',
      type: 'Full-time',
      posted: '2 hours ago',
      description: 'We are looking for a skilled software developer to join our dynamic team...',
      skills: ['React', 'Node.js', 'TypeScript', 'AWS'],
      urgent: true,
      remote: true
    },
    {
      id: 2,
      title: 'Data Analyst',
      company: 'Analytics Plus',
      location: 'Johannesburg, GP',
      salary: 'R35,000 - R45,000',
      type: 'Full-time',
      posted: '1 day ago',
      description: 'Seeking a detail-oriented data analyst to help drive business decisions...',
      skills: ['Python', 'SQL', 'Tableau', 'Excel'],
      urgent: false,
      remote: false
    },
    {
      id: 3,
      title: 'Marketing Manager',
      company: 'Brand Solutions',
      location: 'Durban, KZN',
      salary: 'R40,000 - R55,000',
      type: 'Full-time',
      posted: '3 days ago',
      description: 'Lead our marketing initiatives and drive brand growth across South Africa...',
      skills: ['Digital Marketing', 'SEO', 'Analytics', 'Campaign Management'],
      urgent: false,
      remote: true
    }
  ];

  useEffect(() => {
    setSearchResults(mockJobs);
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      // Filter results based on search parameters
      let filtered = mockJobs.filter(job => {
        const matchesQuery = !searchParams.query || 
          job.title.toLowerCase().includes(searchParams.query.toLowerCase()) ||
          job.company.toLowerCase().includes(searchParams.query.toLowerCase());
        
        const matchesLocation = !searchParams.location ||
          job.location.toLowerCase().includes(searchParams.location.toLowerCase());
        
        return matchesQuery && matchesLocation;
      });

      // Apply filters
      if (filters.urgent) {
        filtered = filtered.filter(job => job.urgent);
      }
      
      if (filters.remote) {
        filtered = filtered.filter(job => job.remote);
      }

      // Sort results
      if (filters.sortBy === 'date') {
        // Sort by posted date (mock implementation)
        filtered.sort((a, b) => new Date(b.posted) - new Date(a.posted));
      }

      setSearchResults(filtered);
      setIsLoading(false);
      toast.success(`Found ${filtered.length} matching jobs`);
    }, 1500);
  };

  const handleExport = () => {
    // Mock export functionality
    toast.success('Job search results exported successfully!');
  };

  const statCards = [
    {
      title: 'Total Jobs Found',
      value: searchStats.totalResults.toLocaleString(),
      subtitle: `+${searchStats.newToday} new today`,
      icon: FiBriefcase,
      color: 'from-blue-600 to-indigo-600'
    },
    {
      title: 'Average Salary',
      value: searchStats.avgSalary,
      subtitle: 'Across all positions',
      icon: FiDollarSign,
      color: 'from-green-600 to-emerald-600'
    },
    {
      title: 'Top Location',
      value: searchStats.topLocation,
      subtitle: 'Most job postings',
      icon: FiMapPin,
      color: 'from-purple-600 to-pink-600'
    },
    {
      title: 'Success Rate',
      value: `${Math.round((searchStats.successfulPlacements / searchStats.totalSearches) * 100)}%`,
      subtitle: 'Placement success',
      icon: FiTrendingUp,
      color: 'from-orange-600 to-red-600'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Advanced Job Search</h1>
        <p className="text-gray-300 text-lg">
          Powered by SerpAPI - Access to comprehensive job listings across South Africa
        </p>
      </div>

      {/* Search Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-gradient-to-r ${stat.color} p-6 rounded-lg shadow-lg`}
          >
            <div className="flex items-center justify-between mb-4">
              <stat.icon className="text-2xl text-white" />
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-white/80 text-sm">{stat.subtitle}</div>
              </div>
            </div>
            <h3 className="text-white font-semibold">{stat.title}</h3>
          </motion.div>
        ))}
      </div>

      {/* Search Interface */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gray-900 p-6 rounded-lg border border-white/10"
      >
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <FiSearch className="mr-2 text-cyan-400" />
          Job Search Parameters
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-white font-medium mb-2">Job Title/Keywords</label>
            <input
              type="text"
              value={searchParams.query}
              onChange={(e) => setSearchParams({...searchParams, query: e.target.value})}
              placeholder="e.g., Software Developer"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
            />
          </div>
          
          <div>
            <label className="block text-white font-medium mb-2">Location</label>
            <input
              type="text"
              value={searchParams.location}
              onChange={(e) => setSearchParams({...searchParams, location: e.target.value})}
              placeholder="e.g., Cape Town"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
            />
          </div>
          
          <div>
            <label className="block text-white font-medium mb-2">Min Salary</label>
            <input
              type="text"
              value={searchParams.salaryMin}
              onChange={(e) => setSearchParams({...searchParams, salaryMin: e.target.value})}
              placeholder="e.g., R30000"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
            />
          </div>
          
          <div>
            <label className="block text-white font-medium mb-2">Max Salary</label>
            <input
              type="text"
              value={searchParams.salaryMax}
              onChange={(e) => setSearchParams({...searchParams, salaryMax: e.target.value})}
              placeholder="e.g., R80000"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-white font-medium mb-2">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date Posted</option>
              <option value="salary">Salary</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-4 pt-8">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.remote}
                onChange={(e) => setFilters({...filters, remote: e.target.checked})}
                className="mr-2"
              />
              <span className="text-white">Remote Only</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.urgent}
                onChange={(e) => setFilters({...filters, urgent: e.target.checked})}
                className="mr-2"
              />
              <span className="text-white">Urgent</span>
            </label>
          </div>
        </div>

        {/* Search Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
            ) : (
              <FiSearch className="mr-2" />
            )}
            {isLoading ? 'Searching...' : 'Search Jobs'}
          </button>
          
          <button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center"
          >
            <FiDownload className="mr-2" />
            Export Results
          </button>
        </div>
      </motion.div>

      {/* Search Results */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-gray-900 p-6 rounded-lg border border-white/10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <FiBriefcase className="mr-2 text-cyan-400" />
            Search Results ({searchResults.length})
          </h2>
          
          <div className="flex items-center space-x-2">
            <FiFilter className="text-gray-400" />
            <span className="text-gray-400 text-sm">
              {filters.remote && 'Remote • '}
              {filters.urgent && 'Urgent • '}
              Sorted by {filters.sortBy}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {searchResults.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 p-6 rounded-lg border border-white/10 hover:border-cyan-400/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-semibold text-white">{job.title}</h3>
                    {job.urgent && (
                      <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        URGENT
                      </span>
                    )}
                    {job.remote && (
                      <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        REMOTE
                      </span>
                    )}
                  </div>
                  <p className="text-cyan-400 font-medium mb-2">{job.company}</p>
                  <p className="text-gray-300 text-sm mb-3">{job.description}</p>
                </div>
                
                <div className="flex space-x-2">
                  <button className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                    <FiEye size={16} />
                  </button>
                  <button className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors">
                    <FiExternalLink size={16} />
                  </button>
                  <button className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors">
                    <FiStar size={16} />
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center text-gray-300">
                  <FiMapPin className="mr-1 text-cyan-400" />
                  {job.location}
                </div>
                <div className="flex items-center text-gray-300">
                  <FiDollarSign className="mr-1 text-green-400" />
                  {job.salary}
                </div>
                <div className="flex items-center text-gray-300">
                  <FiUsers className="mr-1 text-purple-400" />
                  {job.type}
                </div>
                <div className="flex items-center text-gray-300">
                  <FiClock className="mr-1 text-orange-400" />
                  {job.posted}
                </div>
              </div>

              {job.skills && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {job.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="bg-cyan-600/20 text-cyan-400 px-3 py-1 rounded-full text-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {searchResults.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <FiSearch className="mx-auto text-4xl text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">No jobs found matching your criteria</p>
            <p className="text-gray-500 text-sm">Try adjusting your search parameters</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ManagerJobSearch;
