import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Briefcase, 
  TrendingUp, 
  Calendar, 
  Bell, 
  Settings, 
  FileText, 
  Target, 
  Award, 
  Eye,
  Download,
  Edit3,
  MapPin,
  Clock,
  DollarSign,
  Star,
  CheckCircle,
  AlertCircle,
  Users,
  MessageSquare,
  BookmarkPlus,
  Zap,
  Activity,
  BarChart3,
  PieChart,
  Filter
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QuotaMeter from '@/components/QuotaMeter';
import PlanGate from '@/components/PlanGate';
import PaymentDashboard from '@/components/PaymentDashboard';
import { useAuth } from '@/context/AuthContext';
import './UserDashboard.css';

const ProfileSummary = ({ user }) => {
  const [profileScore, setProfileScore] = useState(78);
  
  return (
    <Card variant="elevated" glow={true} className="profile-summary">
      <div className="profile-summary__header">
        <div className="profile-summary__avatar">
          <Avatar size="large" variant="rounded" glow={true}>
            <img src={user?.avatar || '/api/placeholder/80/80'} alt={user?.name || 'User'} />
          </Avatar>
          <div className="profile-summary__status">
            <StatusIndicator status="active" label="Online" animated={true} />
          </div>
        </div>
        
        <div className="profile-summary__info">
          <h2 className="profile-summary__name">{user?.name || 'Welcome back!'}</h2>
          <p className="profile-summary__title">{user?.title || 'Software Developer'}</p>
          <div className="profile-summary__location">
            <MapPin size={14} />
            <span>{user?.location || 'Cape Town, South Africa'}</span>
          </div>
        </div>
        
        <div className="profile-summary__actions">
          <Button variant="outline" size="small" icon={<Edit3 />}>
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="profile-summary__score">
        <div className="profile-summary__score-label">Profile Completion</div>
        <Progress 
          value={profileScore} 
          color="cyan"
          size="medium" 
          animated={true}
          showPercentage={true}
        />
        <div className="profile-summary__score-tips">
          <span>Add 3 more skills to reach 85%</span>
        </div>
      </div>
    </Card>
  );
};

const QuickStats = ({ stats }) => {
  const statItems = [
    { label: 'Applications', value: stats?.applications || 12, icon: FileText, color: 'cyan' },
    { label: 'Profile Views', value: stats?.profileViews || 45, icon: Eye, color: 'purple' },
    { label: 'Saved Jobs', value: stats?.savedJobs || 8, icon: BookmarkPlus, color: 'green' },
    { label: 'Interviews', value: stats?.interviews || 3, icon: Users, color: 'yellow' }
  ];

  return (
    <div className="quick-stats">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card variant="info" hover={true} className="quick-stats__item">
            <div className="quick-stats__icon" style={{ '--icon-color': `var(--color-${item.color})` }}>
              <item.icon size={24} />
            </div>
            <div className="quick-stats__content">
              <div className="quick-stats__value">{item.value}</div>
              <div className="quick-stats__label">{item.label}</div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

const RecentApplications = ({ applications = [] }) => {
  const mockApplications = [
    {
      id: 1,
      company: 'TechCorp SA',
      position: 'Senior React Developer',
      status: 'interviewing',
      appliedDate: '2024-01-15',
      lastUpdate: '2 hours ago',
      logo: '/api/placeholder/40/40'
    },
    {
      id: 2,
      company: 'Design Studio',
      position: 'UX/UI Designer',
      status: 'pending',
      appliedDate: '2024-01-14',
      lastUpdate: '1 day ago',
      logo: '/api/placeholder/40/40'
    },
    {
      id: 3,
      company: 'Analytics Plus',
      position: 'Data Scientist',
      status: 'rejected',
      appliedDate: '2024-01-10',
      lastUpdate: '3 days ago',
      logo: '/api/placeholder/40/40'
    }
  ];

  const getStatusVariant = (status) => {
    switch (status) {
      case 'interviewing': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
      case 'hired': return 'info';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'interviewing': return <Users size={12} />;
      case 'pending': return <Clock size={12} />;
      case 'rejected': return <AlertCircle size={12} />;
      case 'hired': return <CheckCircle size={12} />;
      default: return <FileText size={12} />;
    }
  };

  return (
    <Card variant="default" className="recent-applications">
      <div className="recent-applications__header">
        <h3 className="recent-applications__title">
          <Briefcase size={20} />
          Recent Applications
        </h3>
        <Button variant="ghost" size="small">View All</Button>
      </div>

      <div className="recent-applications__list">
        {mockApplications.map((app, index) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="recent-applications__item"
          >
            <div className="recent-applications__company">
              <Avatar size="small" variant="rounded">
                <img src={app.logo} alt={app.company} />
              </Avatar>
              <div className="recent-applications__details">
                <h4 className="recent-applications__position">{app.position}</h4>
                <p className="recent-applications__company-name">{app.company}</p>
              </div>
            </div>
            
            <div className="recent-applications__status">
              <Badge 
                variant={getStatusVariant(app.status)} 
                size="small"
                icon={getStatusIcon(app.status)}
              >
                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
              </Badge>
            </div>
            
            <div className="recent-applications__meta">
              <span className="recent-applications__date">Applied {app.appliedDate}</span>
              <span className="recent-applications__update">Updated {app.lastUpdate}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const ActivityFeed = ({ activities = [] }) => {
  const mockActivities = [
    {
      id: 1,
      type: 'application',
      message: 'Applied to Senior React Developer at TechCorp SA',
      time: '2 hours ago',
      icon: FileText
    },
    {
      id: 2,
      type: 'profile_view',
      message: 'Your profile was viewed by Design Studio',
      time: '4 hours ago',
      icon: Eye
    },
    {
      id: 3,
      type: 'job_match',
      message: 'New job match: Data Scientist at Analytics Plus (92% match)',
      time: '6 hours ago',
      icon: Target
    },
    {
      id: 4,
      type: 'interview',
      message: 'Interview scheduled with TechCorp SA for tomorrow',
      time: '1 day ago',
      icon: Calendar
    }
  ];

  return (
    <Card variant="default" className="activity-feed">
      <div className="activity-feed__header">
        <h3 className="activity-feed__title">
          <Activity size={20} />
          Recent Activity
        </h3>
      </div>

      <div className="activity-feed__list">
        {mockActivities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="activity-feed__item"
          >
            <div className="activity-feed__icon">
              <activity.icon size={16} />
            </div>
            <div className="activity-feed__content">
              <p className="activity-feed__message">{activity.message}</p>
              <span className="activity-feed__time">{activity.time}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const JobRecommendations = ({ recommendations = [] }) => {
  const mockRecommendations = [
    {
      id: 1,
      title: 'Senior Frontend Developer',
      company: 'Innovative Tech',
      location: 'Cape Town, WC',
      matchScore: 94,
      salary: 'R 75,000 - R 95,000',
      isNew: true
    },
    {
      id: 2,
      title: 'React Native Developer',
      company: 'Mobile Solutions',
      location: 'Johannesburg, GP',
      matchScore: 87,
      salary: 'R 65,000 - R 80,000',
      isNew: false
    },
    {
      id: 3,
      title: 'Full Stack Developer',
      company: 'StartupCo',
      location: 'Remote',
      matchScore: 82,
      salary: 'R 60,000 - R 85,000',
      isNew: true
    }
  ];

  const getMatchColor = (score) => {
    if (score >= 90) return 'green';
    if (score >= 80) return 'cyan';
    if (score >= 70) return 'yellow';
    return 'pink';
  };

  return (
    <Card variant="default" className="job-recommendations">
      <div className="job-recommendations__header">
        <h3 className="job-recommendations__title">
          <Zap size={20} />
          AI Job Recommendations
        </h3>
        <StatusIndicator status="connected" label="AI Active" animated={true} />
      </div>

      <div className="job-recommendations__list">
        {mockRecommendations.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="job-recommendations__item"
          >
            {job.isNew && (
              <Badge variant="success" size="small" className="job-recommendations__new-badge">
                New
              </Badge>
            )}
            
            <div className="job-recommendations__content">
              <h4 className="job-recommendations__position">{job.title}</h4>
              <p className="job-recommendations__company">{job.company}</p>
              <div className="job-recommendations__details">
                <span className="job-recommendations__location">
                  <MapPin size={12} />
                  {job.location}
                </span>
                <span className="job-recommendations__salary">
                  <DollarSign size={12} />
                  {job.salary}
                </span>
              </div>
            </div>

            <div className="job-recommendations__match">
              <div className="job-recommendations__match-score">
                <Progress 
                  value={job.matchScore} 
                  color={getMatchColor(job.matchScore)}
                  size="small" 
                  animated={true}
                />
                <span className="job-recommendations__match-percentage">
                  {job.matchScore}% match
                </span>
              </div>
              
              <div className="job-recommendations__actions">
                <Button variant="primary" size="small" glow={true}>
                  Apply Now
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const AnalyticsPreview = () => {
  const [analyticsData] = useState({
    applicationRate: 85,
    interviewRate: 34,
    responseRate: 67,
    profileViews: [12, 18, 25, 31, 28, 35, 42]
  });

  return (
    <Card variant="info" glow={true} className="analytics-preview">
      <div className="analytics-preview__header">
        <h3 className="analytics-preview__title">
          <BarChart3 size={20} />
          Performance Analytics
        </h3>
        <Button variant="ghost" size="small">View Full Report</Button>
      </div>

      <div className="analytics-preview__metrics">
        <div className="analytics-preview__metric">
          <div className="analytics-preview__metric-value">{analyticsData.applicationRate}%</div>
          <div className="analytics-preview__metric-label">Application Success</div>
          <Progress 
            value={analyticsData.applicationRate} 
            color="green"
            size="small" 
            animated={true}
          />
        </div>

        <div className="analytics-preview__metric">
          <div className="analytics-preview__metric-value">{analyticsData.interviewRate}%</div>
          <div className="analytics-preview__metric-label">Interview Rate</div>
          <Progress 
            value={analyticsData.interviewRate} 
            color="yellow"
            size="small" 
            animated={true}
          />
        </div>

        <div className="analytics-preview__metric">
          <div className="analytics-preview__metric-value">{analyticsData.responseRate}%</div>
          <div className="analytics-preview__metric-label">Response Rate</div>
          <Progress 
            value={analyticsData.responseRate} 
            color="cyan"
            size="small" 
            animated={true}
          />
        </div>
      </div>

      <div className="analytics-preview__chart">
        <div className="analytics-preview__chart-label">Profile Views (Last 7 days)</div>
        <div className="analytics-preview__chart-bars">
          {analyticsData.profileViews.map((value, index) => (
            <motion.div
              key={index}
              className="analytics-preview__chart-bar"
              initial={{ height: 0 }}
              animate={{ height: `${(value / 50) * 100}%` }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              style={{ '--bar-height': `${(value / 50) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
};

const NotificationsPanel = ({ notifications = [] }) => {
  const [unreadCount, setUnreadCount] = useState(3);
  
  const mockNotifications = [
    {
      id: 1,
      type: 'interview',
      title: 'Interview Reminder',
      message: 'Your interview with TechCorp SA is tomorrow at 2:00 PM',
      time: '1 hour ago',
      isRead: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'application',
      title: 'Application Update',
      message: 'Your application to Design Studio has been reviewed',
      time: '3 hours ago',
      isRead: false,
      priority: 'medium'
    },
    {
      id: 3,
      type: 'match',
      title: 'New Job Match',
      message: 'Found 3 new jobs matching your criteria',
      time: '6 hours ago',
      isRead: false,
      priority: 'low'
    },
    {
      id: 4,
      type: 'profile',
      title: 'Profile View',
      message: 'Analytics Plus viewed your profile',
      time: '1 day ago',
      isRead: true,
      priority: 'low'
    }
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'secondary';
    }
  };

  return (
    <Card variant="default" className="notifications-panel">
      <div className="notifications-panel__header">
        <h3 className="notifications-panel__title">
          <Bell size={20} />
          Notifications
          {unreadCount > 0 && (
            <Badge variant="danger" size="small" pulse={true}>
              {unreadCount}
            </Badge>
          )}
        </h3>
        <Button variant="ghost" size="small">Mark All Read</Button>
      </div>

      <div className="notifications-panel__list">
        {mockNotifications.slice(0, 4).map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`notifications-panel__item ${!notification.isRead ? 'notifications-panel__item--unread' : ''}`}
          >
            <div className="notifications-panel__item-indicator">
              <Badge 
                variant={getPriorityColor(notification.priority)} 
                size="small"
                className="notifications-panel__priority"
              />
            </div>
            
            <div className="notifications-panel__item-content">
              <h4 className="notifications-panel__item-title">{notification.title}</h4>
              <p className="notifications-panel__item-message">{notification.message}</p>
              <span className="notifications-panel__item-time">{notification.time}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const UpcomingEvents = () => {
  const mockEvents = [
    {
      id: 1,
      title: 'Interview with TechCorp SA',
      type: 'interview',
      date: '2024-01-16',
      time: '14:00',
      location: 'Virtual Meeting'
    },
    {
      id: 2,
      title: 'Tech Meetup: React 19 Updates',
      type: 'networking',
      date: '2024-01-18',
      time: '18:00',
      location: 'Cape Town Innovation Hub'
    },
    {
      id: 3,
      title: 'Career Workshop: Interview Skills',
      type: 'workshop',
      date: '2024-01-20',
      time: '10:00',
      location: 'Online'
    }
  ];

  const getEventIcon = (type) => {
    switch (type) {
      case 'interview': return <Users size={16} />;
      case 'networking': return <MessageSquare size={16} />;
      case 'workshop': return <Award size={16} />;
      default: return <Calendar size={16} />;
    }
  };

  const getEventVariant = (type) => {
    switch (type) {
      case 'interview': return 'success';
      case 'networking': return 'info';
      case 'workshop': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <Card variant="default" className="upcoming-events">
      <div className="upcoming-events__header">
        <h3 className="upcoming-events__title">
          <Calendar size={20} />
          Upcoming Events
        </h3>
      </div>

      <div className="upcoming-events__list">
        {mockEvents.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="upcoming-events__item"
          >
            <div className="upcoming-events__icon">
              {getEventIcon(event.type)}
            </div>
            
            <div className="upcoming-events__content">
              <h4 className="upcoming-events__title-text">{event.title}</h4>
              <div className="upcoming-events__details">
                <span className="upcoming-events__datetime">
                  {event.date} at {event.time}
                </span>
                <span className="upcoming-events__location">
                  <MapPin size={12} />
                  {event.location}
                </span>
              </div>
            </div>
            
            <Badge variant={getEventVariant(event.type)} size="small">
              {event.type}
            </Badge>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const SkillsProgress = () => {
  const [skills] = useState([
    { name: 'React', level: 90, target: 95 },
    { name: 'JavaScript', level: 85, target: 90 },
    { name: 'TypeScript', level: 75, target: 85 },
    { name: 'Node.js', level: 70, target: 80 },
    { name: 'Python', level: 60, target: 75 }
  ]);

  return (
    <Card variant="default" className="skills-progress">
      <div className="skills-progress__header">
        <h3 className="skills-progress__title">
          <Target size={20} />
          Skills Development
        </h3>
        <Button variant="ghost" size="small">Manage Skills</Button>
      </div>

      <div className="skills-progress__list">
        {skills.map((skill, index) => (
          <motion.div
            key={skill.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="skills-progress__item"
          >
            <div className="skills-progress__skill-info">
              <span className="skills-progress__skill-name">{skill.name}</span>
              <span className="skills-progress__skill-level">{skill.level}%</span>
            </div>
            
            <div className="skills-progress__bars">
              <Progress 
                value={skill.level} 
                color="cyan"
                size="small" 
                animated={true}
                className="skills-progress__current"
              />
              <div className="skills-progress__target-marker" style={{ left: `${skill.target}%` }}>
                <span className="skills-progress__target-label">Target: {skill.target}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const UserDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    applications: 12,
    profileViews: 45,
    savedJobs: 8,
    interviews: 3
  });

  return (
    <div className="user-dashboard">
      <div className="user-dashboard__header">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="user-dashboard__welcome"
        >
          <h1>Welcome back, {user?.firstName || 'there'}!</h1>
          <p>Here's what's happening with your job search</p>
        </motion.div>
        
        <div className="user-dashboard__header-actions">
          <Button variant="outline" icon={<Settings />}>
            Settings
          </Button>
          <Button variant="primary" icon={<FileText />} glow={true}>
            Update CV
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="user-dashboard__tabs">
        <TabsList size="large" variant="elevated">
          <TabsTrigger value="overview" icon={<Activity />}>Overview</TabsTrigger>
          <TabsTrigger value="applications" icon={<Briefcase />}>Applications</TabsTrigger>
          <TabsTrigger value="analytics" icon={<TrendingUp />}>Analytics</TabsTrigger>
          <TabsTrigger value="profile" icon={<User />}>Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="user-dashboard__content">
          <div className="user-dashboard__grid">
            <div className="user-dashboard__column user-dashboard__column--main">
              <ProfileSummary user={user} />
              <QuickStats stats={stats} />
              <RecentApplications />
            </div>
            
            <div className="user-dashboard__column user-dashboard__column--sidebar">
              <JobRecommendations />
              <NotificationsPanel />
              <UpcomingEvents />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="applications" className="user-dashboard__content">
          <div className="user-dashboard__applications">
            <div className="user-dashboard__applications-header">
              <h2>Application Tracking</h2>
              <div className="user-dashboard__applications-filters">
                <Button variant="outline" size="small" icon={<Filter />}>
                  Filter
                </Button>
              </div>
            </div>
            <RecentApplications />
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="user-dashboard__content">
          <div className="user-dashboard__analytics">
            <AnalyticsPreview />
            <SkillsProgress />
            
            <PlanGate allow={['pro', 'executive']}>
              <div className="user-dashboard__pro-analytics">
                <Card variant="elevated" className="brand-score-widget">
                  <div className="brand-score-widget__header">
                    <h3>Personal Brand Score</h3>
                    <Badge variant="info" size="small">Pro Feature</Badge>
                  </div>
                  <div className="brand-score-widget__scores">
                    <div className="brand-score-widget__score">
                      <div className="brand-score-widget__score-value">92</div>
                      <div className="brand-score-widget__score-label">Overall</div>
                    </div>
                    <div className="brand-score-widget__score">
                      <div className="brand-score-widget__score-value">88</div>
                      <div className="brand-score-widget__score-label">LinkedIn</div>
                    </div>
                    <div className="brand-score-widget__score">
                      <div className="brand-score-widget__score-value">76</div>
                      <div className="brand-score-widget__score-label">Network</div>
                    </div>
                    <div className="brand-score-widget__score">
                      <div className="brand-score-widget__score-value">85</div>
                      <div className="brand-score-widget__score-label">Visibility</div>
                    </div>
                  </div>
                </Card>
              </div>
            </PlanGate>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="user-dashboard__content">
          <div className="user-dashboard__profile">
            <div className="user-dashboard__profile-sections">
              <Card variant="default" className="profile-section">
                <h3 className="profile-section__title">Basic Information</h3>
                <div className="profile-section__content">
                  <div className="profile-field">
                    <label>Full Name</label>
                    <span>{user?.name || 'Not specified'}</span>
                  </div>
                  <div className="profile-field">
                    <label>Email</label>
                    <span>{user?.email || 'Not specified'}</span>
                  </div>
                  <div className="profile-field">
                    <label>Phone</label>
                    <span>{user?.phone || 'Not specified'}</span>
                  </div>
                  <div className="profile-field">
                    <label>Location</label>
                    <span>{user?.location || 'Not specified'}</span>
                  </div>
                </div>
                <Button variant="outline" icon={<Edit3 />}>Edit Information</Button>
              </Card>

              <Card variant="default" className="profile-section">
                <h3 className="profile-section__title">Professional Summary</h3>
                <div className="profile-section__content">
                  <p className="profile-summary-text">
                    {user?.summary || 'Add a professional summary to showcase your expertise and career goals.'}
                  </p>
                </div>
                <Button variant="outline" icon={<Edit3 />}>Edit Summary</Button>
              </Card>

              <Card variant="default" className="profile-section">
                <h3 className="profile-section__title">Usage & Plan</h3>
                <div className="profile-section__content">
                  <QuotaMeter />
                </div>
                <PlanGate allow={['pro', 'executive']}>
                  <PaymentDashboard />
                </PlanGate>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserDashboard;
