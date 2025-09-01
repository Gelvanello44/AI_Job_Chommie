import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, MapPin, Clock, DollarSign, Star, Bookmark, Eye, Briefcase, TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import './JobSearchInterface.css';

const JobCard = ({ job, onSave, onView, isSaved = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const matchScore = job.aiMatchScore || Math.floor(Math.random() * 40) + 60;
  const getMatchColor = (score) => {
    if (score >= 90) return 'green';
    if (score >= 75) return 'cyan';
    if (score >= 60) return 'yellow';
    return 'pink';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card 
        variant="default" 
        glow={isHovered} 
        hover={true}
        className="job-card"
      >
        <div className="job-card__header">
          <div className="job-card__company">
            <Avatar size="medium" variant="rounded">
              <img src={job.companyLogo || '/api/placeholder/40/40'} alt={job.company} />
            </Avatar>
            <div className="job-card__company-info">
              <h3 className="job-card__title">{job.title}</h3>
              <p className="job-card__company-name">{job.company}</p>
            </div>
          </div>
          
          <div className="job-card__actions">
            <Button
              variant="ghost"
              size="small"
              onClick={() => onSave(job.id)}
              icon={<Bookmark />}
              glow={isSaved}
            >
              {isSaved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="job-card__content">
          <div className="job-card__details">
            <div className="job-card__detail">
              <MapPin size={16} />
              <span>{job.location}</span>
              {job.remote && <Badge variant="info" size="small">Remote</Badge>}
            </div>
            
            <div className="job-card__detail">
              <Clock size={16} />
              <span>{job.type}</span>
            </div>
            
            {job.salary && (
              <div className="job-card__detail">
                <DollarSign size={16} />
                <span>{job.salary}</span>
              </div>
            )}
          </div>

          <div className="job-card__description">
            {job.description}
          </div>

          <div className="job-card__skills">
            {job.skills?.slice(0, 4).map((skill, index) => (
              <Badge key={index} variant="secondary" size="small">
                {skill}
              </Badge>
            ))}
            {job.skills?.length > 4 && (
              <Badge variant="ghost" size="small">
                +{job.skills.length - 4} more
              </Badge>
            )}
          </div>
        </div>

        <div className="job-card__footer">
          <div className="job-card__match">
            <div className="job-card__match-label">AI Match Score</div>
            <div className="job-card__match-score">
              <Progress 
                value={matchScore} 
                color={getMatchColor(matchScore)}
                size="small" 
                animated={true}
                showPercentage={true}
              />
            </div>
          </div>
          
          <div className="job-card__meta">
            <span className="job-card__posted">Posted {job.postedTime}</span>
            <Button
              variant="primary"
              size="small"
              onClick={() => onView(job.id)}
              icon={<Eye />}
            >
              View Details
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const SearchFilters = ({ filters, onFiltersChange, onReset }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card variant="elevated" className="search-filters">
      <div className="search-filters__header">
        <h3 className="search-filters__title">
          <Filter size={20} />
          Search Filters
        </h3>
        <Button
          variant="ghost"
          size="small"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      <div className="search-filters__main">
        <Input
          placeholder="Search jobs, companies, or keywords..."
          value={filters.query}
          onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
          icon={<Search />}
          clearable={true}
          glow={true}
          size="large"
        />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="search-filters__expanded"
          >
            <div className="search-filters__grid">
              <div className="search-filters__group">
                <label className="search-filters__label">Location</label>
                <Select value={filters.location} onValueChange={(value) => onFiltersChange({ ...filters, location: value })}>
                  <SelectTrigger variant="default" glow={true}>
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Province</SelectItem>
                    <SelectItem value="western-cape">Western Cape</SelectItem>
                    <SelectItem value="gauteng">Gauteng</SelectItem>
                    <SelectItem value="kwazulu-natal">KwaZulu-Natal</SelectItem>
                    <SelectItem value="eastern-cape">Eastern Cape</SelectItem>
                    <SelectItem value="free-state">Free State</SelectItem>
                    <SelectItem value="north-west">North West</SelectItem>
                    <SelectItem value="northern-cape">Northern Cape</SelectItem>
                    <SelectItem value="mpumalanga">Mpumalanga</SelectItem>
                    <SelectItem value="limpopo">Limpopo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="search-filters__group">
                <label className="search-filters__label">Job Type</label>
                <Select value={filters.type} onValueChange={(value) => onFiltersChange({ ...filters, type: value })}>
                  <SelectTrigger variant="default" glow={true}>
                    <SelectValue placeholder="Job type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Type</SelectItem>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="search-filters__group">
                <label className="search-filters__label">Experience Level</label>
                <Select value={filters.experience} onValueChange={(value) => onFiltersChange({ ...filters, experience: value })}>
                  <SelectTrigger variant="default" glow={true}>
                    <SelectValue placeholder="Experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Level</SelectItem>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="mid">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior Level</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="search-filters__group">
                <label className="search-filters__label">Salary Range</label>
                <div className="search-filters__salary">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.salaryMin}
                    onChange={(e) => onFiltersChange({ ...filters, salaryMin: e.target.value })}
                    size="medium"
                  />
                  <span className="search-filters__salary-separator">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.salaryMax}
                    onChange={(e) => onFiltersChange({ ...filters, salaryMax: e.target.value })}
                    size="medium"
                  />
                </div>
              </div>

              <div className="search-filters__group">
                <label className="search-filters__label">Work Arrangement</label>
                <div className="search-filters__checkboxes">
                  <label className="search-filters__checkbox">
                    <input
                      type="checkbox"
                      checked={filters.remote}
                      onChange={(e) => onFiltersChange({ ...filters, remote: e.target.checked })}
                    />
                    <span>Remote</span>
                  </label>
                  <label className="search-filters__checkbox">
                    <input
                      type="checkbox"
                      checked={filters.hybrid}
                      onChange={(e) => onFiltersChange({ ...filters, hybrid: e.target.checked })}
                    />
                    <span>Hybrid</span>
                  </label>
                  <label className="search-filters__checkbox">
                    <input
                      type="checkbox"
                      checked={filters.onsite}
                      onChange={(e) => onFiltersChange({ ...filters, onsite: e.target.checked })}
                    />
                    <span>On-site</span>
                  </label>
                </div>
              </div>

              <div className="search-filters__group">
                <label className="search-filters__label">BEE Status</label>
                <Select value={filters.beeStatus} onValueChange={(value) => onFiltersChange({ ...filters, beeStatus: value })}>
                  <SelectTrigger variant="default" glow={true}>
                    <SelectValue placeholder="BEE preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="bee-friendly">BEE-Friendly</SelectItem>
                    <SelectItem value="not-specified">Not Specified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="search-filters__actions">
              <Button variant="secondary" onClick={onReset}>
                Reset Filters
              </Button>
              <Button variant="primary" glow={true}>
                Apply Filters
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const AIInsights = ({ searchQuery, totalResults }) => {
  const [insights, setInsights] = useState({
    trending: ['React Developer', 'Data Scientist', 'UX Designer'],
    marketDemand: 'High',
    avgSalary: 'R 45,000 - R 85,000',
    skillsInDemand: ['React', 'Python', 'AWS', 'Machine Learning']
  });

  return (
    <Card variant="info" glow={true} className="ai-insights">
      <div className="ai-insights__header">
        <div className="ai-insights__title">
          <Zap className="ai-insights__icon" />
          AI Market Insights
        </div>
        <StatusIndicator status="connected" label="AI Active" animated={true} />
      </div>

      <div className="ai-insights__content">
        <div className="ai-insights__stat">
          <div className="ai-insights__stat-value">{totalResults}</div>
          <div className="ai-insights__stat-label">Jobs Found</div>
        </div>

        <div className="ai-insights__stat">
          <div className="ai-insights__stat-value">{insights.marketDemand}</div>
          <div className="ai-insights__stat-label">Market Demand</div>
        </div>

        <div className="ai-insights__section">
          <h4 className="ai-insights__section-title">Trending Now</h4>
          <div className="ai-insights__tags">
            {insights.trending.map((trend, index) => (
              <Badge key={index} variant="success" size="small" pulse={true}>
                <TrendingUp size={12} />
                {trend}
              </Badge>
            ))}
          </div>
        </div>

        <div className="ai-insights__section">
          <h4 className="ai-insights__section-title">Skills in Demand</h4>
          <div className="ai-insights__tags">
            {insights.skillsInDemand.map((skill, index) => (
              <Badge key={index} variant="info" size="small">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div className="ai-insights__recommendation">
          <p> Based on your profile, consider highlighting <strong>React</strong> and <strong>Python</strong> skills for better matches.</p>
        </div>
      </div>
    </Card>
  );
};

const JobSearchInterface = () => {
  const [filters, setFilters] = useState({
    query: '',
    location: '',
    type: '',
    experience: '',
    salaryMin: '',
    salaryMax: '',
    remote: false,
    hybrid: false,
    onsite: false,
    beeStatus: ''
  });

  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState('grid');
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Mock job data - in real app this would come from API
  const [jobs] = useState([
    {
      id: 1,
      title: 'Senior React Developer',
      company: 'TechCorp SA',
      location: 'Cape Town, WC',
      type: 'Full-time',
      salary: 'R 65,000 - R 85,000',
      remote: true,
      description: 'Join our dynamic team building next-generation web applications...',
      skills: ['React', 'TypeScript', 'Node.js', 'AWS', 'GraphQL'],
      postedTime: '2 hours ago',
      companyLogo: '/api/placeholder/40/40',
      aiMatchScore: 92
    },
    {
      id: 2,
      title: 'UX/UI Designer',
      company: 'Design Studio',
      location: 'Johannesburg, GP',
      type: 'Contract',
      salary: 'R 45,000 - R 60,000',
      remote: false,
      description: 'Create beautiful and intuitive user experiences for our clients...',
      skills: ['Figma', 'Adobe XD', 'Prototyping', 'User Research'],
      postedTime: '4 hours ago',
      companyLogo: '/api/placeholder/40/40',
      aiMatchScore: 78
    },
    {
      id: 3,
      title: 'Data Scientist',
      company: 'Analytics Plus',
      location: 'Durban, KZN',
      type: 'Full-time',
      salary: 'R 70,000 - R 95,000',
      remote: true,
      description: 'Analyze complex datasets and build predictive models...',
      skills: ['Python', 'Machine Learning', 'SQL', 'Tableau', 'R'],
      postedTime: '1 day ago',
      companyLogo: '/api/placeholder/40/40',
      aiMatchScore: 85
    }
  ]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (filters.query && !job.title.toLowerCase().includes(filters.query.toLowerCase()) &&
          !job.company.toLowerCase().includes(filters.query.toLowerCase())) {
        return false;
      }
      if (filters.location && filters.location !== 'any' && 
          !job.location.toLowerCase().includes(filters.location.replace('-', ' '))) {
        return false;
      }
      if (filters.type && filters.type !== 'any' && job.type.toLowerCase() !== filters.type.replace('-', ' ')) {
        return false;
      }
      if (filters.remote && !job.remote) {
        return false;
      }
      return true;
    });
  }, [jobs, filters]);

  const handleSaveJob = (jobId) => {
    const newSavedJobs = new Set(savedJobs);
    if (newSavedJobs.has(jobId)) {
      newSavedJobs.delete(jobId);
    } else {
      newSavedJobs.add(jobId);
    }
    setSavedJobs(newSavedJobs);
  };

  const handleViewJob = (jobId) => {
    // Navigate to job details
    console.log('Viewing job:', jobId);
  };

  const handleResetFilters = () => {
    setFilters({
      query: '',
      location: '',
      type: '',
      experience: '',
      salaryMin: '',
      salaryMax: '',
      remote: false,
      hybrid: false,
      onsite: false,
      beeStatus: ''
    });
  };

  return (
    <div className="job-search-interface">
      <div className="job-search-interface__header">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="job-search-interface__title"
        >
          <Briefcase className="job-search-interface__title-icon" />
          <h1>Discover Your Next Opportunity</h1>
          <p>AI-powered job matching for South African professionals</p>
        </motion.div>
        
        <div className="job-search-interface__stats">
          <div className="job-search-interface__stat">
            <div className="job-search-interface__stat-value">{filteredJobs.length}</div>
            <div className="job-search-interface__stat-label">Jobs Available</div>
          </div>
          <div className="job-search-interface__stat">
            <div className="job-search-interface__stat-value">24/7</div>
            <div className="job-search-interface__stat-label">AI Matching</div>
          </div>
        </div>
      </div>

      <div className="job-search-interface__content">
        <div className="job-search-interface__sidebar">
          <SearchFilters 
            filters={filters}
            onFiltersChange={setFilters}
            onReset={handleResetFilters}
          />
          
          <AIInsights 
            searchQuery={filters.query}
            totalResults={filteredJobs.length}
          />
        </div>

        <div className="job-search-interface__main">
          <div className="job-search-interface__toolbar">
            <div className="job-search-interface__sort">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger size="medium">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Most Relevant</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="salary-high">Highest Salary</SelectItem>
                  <SelectItem value="salary-low">Lowest Salary</SelectItem>
                  <SelectItem value="match-score">Best Match</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList size="small">
                <TabsTrigger value="grid">Grid</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="job-search-interface__results">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="job-search-interface__loading"
                >
                  <div className="job-search-interface__skeleton-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="job-search-interface__skeleton-card" />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`job-search-interface__grid ${viewMode === 'list' ? 'job-search-interface__grid--list' : ''}`}
                >
                  {filteredJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onSave={handleSaveJob}
                      onView={handleViewJob}
                      isSaved={savedJobs.has(job.id)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {!isLoading && filteredJobs.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="job-search-interface__empty"
              >
                <Card variant="ghost" className="text-center">
                  <div className="job-search-interface__empty-content">
                    <Briefcase size={48} className="job-search-interface__empty-icon" />
                    <h3>No jobs found</h3>
                    <p>Try adjusting your search criteria or filters</p>
                    <Button variant="primary" onClick={handleResetFilters} glow={true}>
                      Reset Filters
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>

          {filteredJobs.length > 0 && (
            <div className="job-search-interface__pagination">
              <Button variant="outline" size="large">
                Load More Jobs
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobSearchInterface;
