import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FiUsers, FiTrendingUp, FiBarChart2, FiPieChart, 
  FiMapPin, FiClock, FiActivity, FiTarget,
  FiDownload, FiRefreshCw, FiFilter, FiCalendar
} from 'react-icons/fi';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

const MobileAnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('users');
  const [loading, setLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState({
    overview: {
      totalUsers: 12485,
      activeUsers: 8742,
      newSignups: 342,
      conversionRate: 18.4,
      retentionRate: 76.2,
      avgSessionDuration: '12m 34s',
      bounceRate: 24.5,
      pageViews: 184291
    },
    demographics: {
      age: {
        '18-25': 28,
        '26-35': 45,
        '36-45': 20,
        '46-55': 5,
        '55+': 2
      },
      location: {
        'Gauteng': 4521,
        'Western Cape': 3214,
        'KwaZulu-Natal': 2841,
        'Eastern Cape': 1909
      },
      devices: {
        'Mobile': 68,
        'Desktop': 28,
        'Tablet': 4
      }
    },
    engagement: {
      dailyActive: [2100, 2340, 2180, 2890, 2750, 2940, 3100],
      weeklyActive: [8200, 8450, 8150, 8900, 8750, 9100, 8742],
      userJourney: {
        'Landing Page': 100,
        'Sign Up': 18.4,
        'Profile Complete': 14.2,
        'First Job Applied': 11.8,
        'Second Week Active': 8.9
      }
    }
  });

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#ffffff'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  };

  const userGrowthData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    datasets: [
      {
        label: 'Total Users',
        data: [3200, 4500, 6100, 7800, 9200, 10500, 11800, 12485],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Active Users',
        data: [2100, 3200, 4300, 5600, 6800, 7500, 8100, 8742],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const engagementData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Daily Active Users',
        data: analyticsData.engagement.dailyActive,
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 2,
      }
    ]
  };

  const locationData = {
    labels: Object.keys(analyticsData.demographics.location),
    datasets: [
      {
        label: 'Users by Province',
        data: Object.values(analyticsData.demographics.location),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(249, 115, 22, 0.8)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(168, 85, 247)',
          'rgb(249, 115, 22)',
        ],
        borderWidth: 2,
      }
    ]
  };

  const deviceData = {
    labels: Object.keys(analyticsData.demographics.devices),
    datasets: [
      {
        data: Object.values(analyticsData.demographics.devices),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(168, 85, 247)',
        ],
        borderWidth: 2,
      }
    ]
  };

  const metricCards = [
    {
      title: 'Total Users',
      value: analyticsData.overview.totalUsers.toLocaleString(),
      change: '+12.3%',
      icon: FiUsers,
      color: 'from-blue-600 to-indigo-600',
      positive: true
    },
    {
      title: 'Active Users',
      value: analyticsData.overview.activeUsers.toLocaleString(),
      change: '+8.7%',
      icon: FiActivity,
      color: 'from-green-600 to-emerald-600',
      positive: true
    },
    {
      title: 'New Signups',
      value: analyticsData.overview.newSignups.toLocaleString(),
      change: '+15.2%',
      icon: FiTrendingUp,
      color: 'from-purple-600 to-pink-600',
      positive: true
    },
    {
      title: 'Conversion Rate',
      value: `${analyticsData.overview.conversionRate}%`,
      change: '-2.1%',
      icon: FiTarget,
      color: 'from-orange-600 to-red-600',
      positive: false
    }
  ];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  const handleExport = () => {
    // Mock export functionality
    const data = JSON.stringify(analyticsData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">Analytics Dashboard</h1>
          <p className="text-gray-300 text-lg">
            Comprehensive insights into user behavior and platform performance
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center"
          >
            <FiDownload className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-gradient-to-r ${metric.color} p-6 rounded-lg shadow-lg`}
          >
            <div className="flex items-center justify-between mb-4">
              <metric.icon className="text-2xl text-white" />
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{metric.value}</div>
                <div className={`text-sm ${metric.positive ? 'text-green-200' : 'text-red-200'}`}>
                  {metric.change}
                </div>
              </div>
            </div>
            <h3 className="text-white font-semibold">{metric.title}</h3>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* User Growth Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <FiTrendingUp className="mr-2 text-cyan-400" />
            User Growth Trend
          </h2>
          <div className="h-80">
            <Line data={userGrowthData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Daily Engagement */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <FiBarChart2 className="mr-2 text-cyan-400" />
            Daily Engagement
          </h2>
          <div className="h-80">
            <Bar data={engagementData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Geographic Distribution */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <FiMapPin className="mr-2 text-cyan-400" />
            Users by Province
          </h2>
          <div className="h-80">
            <Bar data={locationData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Device Breakdown */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <FiPieChart className="mr-2 text-cyan-400" />
            Device Usage
          </h2>
          <div className="h-80">
            <Doughnut 
              data={deviceData} 
              options={{
                ...chartOptions,
                scales: undefined,
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: '#ffffff',
                      padding: 20
                    }
                  }
                }
              }} 
            />
          </div>
        </motion.div>
      </div>

      {/* Detailed Metrics Tables */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* User Journey Funnel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6">User Journey Funnel</h2>
          <div className="space-y-4">
            {Object.entries(analyticsData.engagement.userJourney).map(([stage, percentage], index) => (
              <div key={stage} className="relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">{stage}</span>
                  <span className="text-cyan-400 font-bold">{percentage}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <motion.div 
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, delay: 1 + index * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Age Demographics */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Age Demographics</h2>
          <div className="space-y-4">
            {Object.entries(analyticsData.demographics.age).map(([ageGroup, percentage]) => (
              <div key={ageGroup} className="flex items-center justify-between">
                <span className="text-gray-300">{ageGroup} years</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full"
                      style={{ width: `${percentage * 2}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-8 text-right">{percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Additional Metrics */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="bg-gray-900 p-6 rounded-lg border border-white/10"
      >
        <h2 className="text-2xl font-bold text-white mb-6">Additional Metrics</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-cyan-400 mb-2">
              {analyticsData.overview.retentionRate}%
            </div>
            <div className="text-gray-300">Retention Rate</div>
            <div className="text-sm text-green-400 mt-1">+2.3% from last month</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">
              {analyticsData.overview.avgSessionDuration}
            </div>
            <div className="text-gray-300">Avg Session Duration</div>
            <div className="text-sm text-green-400 mt-1">+1.2m from last month</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400 mb-2">
              {analyticsData.overview.bounceRate}%
            </div>
            <div className="text-gray-300">Bounce Rate</div>
            <div className="text-sm text-red-400 mt-1">+0.8% from last month</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">
              {analyticsData.overview.pageViews.toLocaleString()}
            </div>
            <div className="text-gray-300">Total Page Views</div>
            <div className="text-sm text-green-400 mt-1">+18.5% from last month</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MobileAnalyticsDashboard;
