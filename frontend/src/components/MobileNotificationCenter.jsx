import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiBell, FiAlertTriangle, FiCheckCircle, FiInfo,
  FiSettings, FiTrash2, FiEye, FiClock, FiUser
} from 'react-icons/fi';

const MobileNotificationCenter = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'warning',
      title: 'High API Usage',
      message: 'API calls are approaching monthly limit (85%). Consider upgrading your plan.',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'info',
      title: 'Scheduled Maintenance',
      message: 'Database maintenance scheduled for Sunday 2AM SAST. Expected downtime: 30 minutes.',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      read: false,
      priority: 'medium'
    },
    {
      id: 3,
      type: 'success',
      title: 'Performance Improvement',
      message: 'System response time improved by 15% after recent optimization updates.',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      read: true,
      priority: 'low'
    },
    {
      id: 4,
      type: 'error',
      title: 'Failed Job Applications',
      message: '3 job applications failed to submit due to network issues. Please retry.',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      read: false,
      priority: 'high'
    },
    {
      id: 5,
      type: 'info',
      title: 'New Feature Available',
      message: 'AI Resume Builder 2.0 is now available with enhanced templates and suggestions.',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      read: true,
      priority: 'medium'
    }
  ]);

  const [filter, setFilter] = useState('all'); // all, unread, high

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'warning': return FiAlertTriangle;
      case 'error': return FiAlertTriangle;
      case 'success': return FiCheckCircle;
      case 'info': return FiInfo;
      default: return FiBell;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'success': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'info': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'high') return notification.priority === 'high';
    return true;
  });

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (id) => {
    setNotifications(prev =>
      prev.filter(notification => notification.id !== id)
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-xl border border-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <FiBell className="text-2xl text-cyan-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Notifications</h2>
                <p className="text-gray-400 text-sm">
                  {unreadCount} unread • {notifications.length} total
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <FiX className="text-xl text-gray-400" />
            </button>
          </div>

          {/* Filters and Actions */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    filter === 'all'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    filter === 'unread'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('high')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    filter === 'high'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  High Priority
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center"
                  >
                    <FiEye className="mr-1" />
                    Mark All Read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors flex items-center"
                >
                  <FiTrash2 className="mr-1" />
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FiBell className="text-4xl text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">No notifications found</p>
                <p className="text-gray-500 text-sm">
                  {filter === 'all' ? 'You\'re all caught up!' : `No ${filter} notifications`}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredNotifications.map((notification, index) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 rounded-lg border transition-all hover:border-opacity-50 ${
                        getNotificationColor(notification.type)
                      } ${!notification.read ? 'ring-2 ring-cyan-400/20' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                          <Icon className="text-lg" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className={`font-semibold ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                              {notification.title}
                            </h3>
                            <div className="flex items-center space-x-2 ml-2">
                              <div
                                className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`}
                                title={`${notification.priority} priority`}
                              />
                              {!notification.read && (
                                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                              )}
                            </div>
                          </div>
                          
                          <p className="text-gray-300 text-sm mb-3">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-xs text-gray-500">
                              <FiClock className="mr-1" />
                              {formatTimestamp(notification.timestamp)}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {!notification.read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 hover:bg-white/10 rounded text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                  title="Mark as read"
                                >
                                  <FiEye />
                                </button>
                              )}
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="p-1 hover:bg-white/10 rounded text-xs text-red-400 hover:text-red-300 transition-colors"
                                title="Delete notification"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </p>
              
              <button className="flex items-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
                <FiSettings className="text-sm" />
                <span>Notification Settings</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MobileNotificationCenter;
