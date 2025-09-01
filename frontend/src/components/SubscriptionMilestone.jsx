import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FiTarget, FiTrendingUp, FiUsers, FiCalendar, 
  FiBarChart2, FiAward, FiStar 
} from 'react-icons/fi';
import { Line, Bar } from 'react-chartjs-2';

const SubscriptionMilestone = () => {
  const [milestoneData, setMilestoneData] = useState({
    currentSubscribers: 8742,
    target: 10000,
    dailyGrowth: 45,
    weeklyGrowth: 312,
    monthlyGrowth: 1248,
    estimatedDaysToGoal: 28,
    conversionRate: 18.4,
    churnRate: 2.1,
    topPerformingPlan: 'Premium',
    revenue: {
      current: 185420,
      projected: 250000
    }
  });

  const progressPercentage = (milestoneData.currentSubscribers / milestoneData.target) * 100;

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    datasets: [
      {
        label: 'Subscribers',
        data: [2100, 3200, 4100, 5300, 6200, 7100, 7900, 8742],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Target Trajectory',
        data: [1250, 2500, 3750, 5000, 6250, 7500, 8750, 10000],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: false,
        borderDash: [5, 5],
        tension: 0.4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
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

  const milestoneCards = [
    {
      title: 'Current Progress',
      value: `${milestoneData.currentSubscribers.toLocaleString()}`,
      subtitle: `${progressPercentage.toFixed(1)}% to goal`,
      icon: FiUsers,
      color: 'bg-gradient-to-r from-green-600 to-emerald-600'
    },
    {
      title: 'Daily Growth',
      value: `+${milestoneData.dailyGrowth}`,
      subtitle: 'New subscribers today',
      icon: FiTrendingUp,
      color: 'bg-gradient-to-r from-blue-600 to-indigo-600'
    },
    {
      title: 'Days to Goal',
      value: milestoneData.estimatedDaysToGoal,
      subtitle: 'At current rate',
      icon: FiCalendar,
      color: 'bg-gradient-to-r from-purple-600 to-pink-600'
    },
    {
      title: 'Conversion Rate',
      value: `${milestoneData.conversionRate}%`,
      subtitle: 'Visitors to subscribers',
      icon: FiTarget,
      color: 'bg-gradient-to-r from-orange-600 to-red-600'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">10K Subscribers Milestone</h1>
        <p className="text-gray-300 text-lg">
          Track our journey to reaching 10,000 subscribers and celebrate the milestones along the way
        </p>
      </div>

      {/* Progress Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900 p-8 rounded-lg border border-cyan-400/20"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <FiAward className="mr-2 text-cyan-400" />
            Progress to 10K
          </h2>
          <div className="text-right">
            <div className="text-3xl font-bold text-cyan-400">
              {progressPercentage.toFixed(1)}%
            </div>
            <div className="text-gray-300 text-sm">
              {(milestoneData.target - milestoneData.currentSubscribers).toLocaleString()} remaining
            </div>
          </div>
        </div>
        
        <div className="w-full bg-gray-700 rounded-full h-6 mb-4">
          <motion.div 
            className="bg-gradient-to-r from-cyan-500 to-green-500 h-6 rounded-full flex items-center justify-end pr-2"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 2, ease: "easeOut" }}
          >
            <FiStar className="text-white text-sm" />
          </motion.div>
        </div>
        
        <div className="flex justify-between text-sm text-gray-400">
          <span>0</span>
          <span>2.5K</span>
          <span>5K</span>
          <span>7.5K</span>
          <span className="text-cyan-400 font-bold">10K</span>
        </div>
      </motion.div>

      {/* Milestone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {milestoneCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`${card.color} p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow`}
          >
            <div className="flex items-center justify-between mb-4">
              <card.icon className="text-2xl text-white" />
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{card.value}</div>
                <div className="text-white/80 text-sm">{card.subtitle}</div>
              </div>
            </div>
            <h3 className="text-white font-semibold">{card.title}</h3>
          </motion.div>
        ))}
      </div>

      {/* Growth Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gray-900 p-6 rounded-lg border border-white/10"
      >
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <FiBarChart2 className="mr-2 text-cyan-400" />
          Growth Trajectory
        </h2>
        <div className="h-80">
          <Line data={chartData} options={chartOptions} />
        </div>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Growth Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Weekly Growth:</span>
              <span className="text-green-400 font-bold">+{milestoneData.weeklyGrowth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Monthly Growth:</span>
              <span className="text-green-400 font-bold">+{milestoneData.monthlyGrowth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Churn Rate:</span>
              <span className="text-yellow-400 font-bold">{milestoneData.churnRate}%</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gray-900 p-6 rounded-lg border border-white/10"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Best Plan:</span>
              <span className="text-cyan-400 font-bold">{milestoneData.topPerformingPlan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Current MRR:</span>
              <span className="text-green-400 font-bold">R{milestoneData.revenue.current.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Projected at 10K:</span>
              <span className="text-purple-400 font-bold">R{milestoneData.revenue.projected.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-r from-cyan-600/20 to-purple-600/20 p-6 rounded-lg border border-cyan-400/20"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Celebration Ready!</h3>
          <p className="text-gray-300 text-sm mb-4">
            We're planning something special for our 10K milestone. Stay tuned!
          </p>
          <div className="flex items-center space-x-2">
            <FiAward className="text-yellow-400" />
            <span className="text-yellow-400 font-semibold">Epic Milestone Ahead!</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SubscriptionMilestone;
