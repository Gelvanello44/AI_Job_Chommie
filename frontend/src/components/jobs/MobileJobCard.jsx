import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  MapPin,
  Clock,
  DollarSign,
  Building2,
  Heart,
  Bookmark,
  Share2,
  ExternalLink,
  User,
  Calendar,
  Briefcase,
  GraduationCap,
  Star,
  CheckCircle,
  X,
  MoreVertical
} from 'lucide-react';
import './MobileJobCard.css';

const MobileJobCard = ({
  job,
  onSave = () => {},
  onApply = () => {},
  onShare = () => {},
  onView = () => {},
  onRemove = () => {},
  isSaved = false,
  isApplied = false,
  showRemoveAction = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const cardRef = useRef(null);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0.5, 1, 0.5]);
  const scale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);

  // Swipe gesture handling
  const handleDragEnd = (event, info) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(offset) > 100 || Math.abs(velocity) > 500) {
      if (offset > 0) {
        // Swipe right - Save job
        setSwipeDirection('right');
        onSave(job.id);
        setTimeout(() => setSwipeDirection(null), 600);
      } else {
        // Swipe left - Quick apply or remove
        setSwipeDirection('left');
        if (showRemoveAction) {
          onRemove(job.id);
        } else {
          onApply(job.id);
        }
        setTimeout(() => setSwipeDirection(null), 600);
      }
    }
    
    // Reset position
    x.set(0);
  };

  // Format salary
  const formatSalary = (min, max, currency = 'R') => {
    if (!min && !max) return 'Salary negotiable';
    if (min && max) {
      return `${currency}${min.toLocaleString()} - ${currency}${max.toLocaleString()}`;
    }
    return `${currency}${(min || max).toLocaleString()}+`;
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just posted';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  // Handle long press for actions menu
  useEffect(() => {
    let pressTimer = null;
    
    const handleTouchStart = () => {
      pressTimer = setTimeout(() => {
        setShowActions(true);
      }, 500);
    };
    
    const handleTouchEnd = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
      }
    };
    
    const card = cardRef.current;
    if (card) {
      card.addEventListener('touchstart', handleTouchStart);
      card.addEventListener('touchend', handleTouchEnd);
      card.addEventListener('touchcancel', handleTouchEnd);
    }
    
    return () => {
      if (card) {
        card.removeEventListener('touchstart', handleTouchStart);
        card.removeEventListener('touchend', handleTouchEnd);
        card.removeEventListener('touchcancel', handleTouchEnd);
      }
      if (pressTimer) {
        clearTimeout(pressTimer);
      }
    };
  }, []);

  return (
    <div className={`mobile-job-card-wrapper ${className}`}>
      {/* Swipe Actions Background */}
      <div className="mobile-job-card__swipe-actions">
        <div className="mobile-job-card__swipe-left">
          <div className="mobile-job-card__swipe-icon">
            <Heart size={24} />
          </div>
          <span>Save</span>
        </div>
        <div className="mobile-job-card__swipe-right">
          <div className="mobile-job-card__swipe-icon">
            {showRemoveAction ? <X size={24} /> : <CheckCircle size={24} />}
          </div>
          <span>{showRemoveAction ? 'Remove' : 'Quick Apply'}</span>
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        ref={cardRef}
        className={`mobile-job-card ${isExpanded ? 'mobile-job-card--expanded' : ''} ${
          swipeDirection ? `mobile-job-card--swiped-${swipeDirection}` : ''
        }`}
        style={{ x, opacity, scale }}
        drag="x"
        dragConstraints={{ left: -200, right: 200 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
        layout
      >
        {/* Card Header */}
        <div className="mobile-job-card__header">
          <div className="mobile-job-card__company-info">
            <div className="mobile-job-card__company-logo">
              {job.company?.logo ? (
                <img src={job.company.logo} alt={job.company.name} />
              ) : (
                <Building2 size={20} />
              )}
            </div>
            <div className="mobile-job-card__title-section">
              <h3 className="mobile-job-card__title">{job.title}</h3>
              <p className="mobile-job-card__company">{job.company?.name}</p>
            </div>
          </div>
          
          <div className="mobile-job-card__header-actions">
            <button
              className="mobile-job-card__action-btn"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Card Content */}
        <div className="mobile-job-card__content">
          {/* Key Info Row */}
          <div className="mobile-job-card__info-row">
            <div className="mobile-job-card__info-item">
              <MapPin size={14} />
              <span>{job.location}</span>
            </div>
            <div className="mobile-job-card__info-item">
              <Clock size={14} />
              <span>{formatTimeAgo(job.createdAt)}</span>
            </div>
            <div className="mobile-job-card__info-item">
              <DollarSign size={14} />
              <span>{formatSalary(job.salaryMin, job.salaryMax)}</span>
            </div>
          </div>

          {/* Job Details */}
          <div className="mobile-job-card__details">
            {job.type && (
              <span className="mobile-job-card__badge mobile-job-card__badge--type">
                {job.type}
              </span>
            )}
            {job.level && (
              <span className="mobile-job-card__badge mobile-job-card__badge--level">
                {job.level}
              </span>
            )}
            {job.remote && (
              <span className="mobile-job-card__badge mobile-job-card__badge--remote">
                Remote
              </span>
            )}
          </div>

          {/* Job Description Preview */}
          <div className="mobile-job-card__description">
            <p>{job.description?.substring(0, 120)}...</p>
          </div>

          {/* Skills Tags */}
          {job.skills && job.skills.length > 0 && (
            <div className="mobile-job-card__skills">
              {job.skills.slice(0, 3).map((skill, index) => (
                <span key={index} className="mobile-job-card__skill-tag">
                  {skill}
                </span>
              ))}
              {job.skills.length > 3 && (
                <span className="mobile-job-card__skill-tag mobile-job-card__skill-tag--more">
                  +{job.skills.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Expanded Content */}
          {isExpanded && (
            <motion.div
              className="mobile-job-card__expanded-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Full Description */}
              <div className="mobile-job-card__full-description">
                <h4>Job Description</h4>
                <p>{job.description}</p>
              </div>

              {/* Requirements */}
              {job.requirements && (
                <div className="mobile-job-card__requirements">
                  <h4>Requirements</h4>
                  <ul>
                    {job.requirements.map((req, index) => (
                      <li key={index}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Benefits */}
              {job.benefits && (
                <div className="mobile-job-card__benefits">
                  <h4>Benefits</h4>
                  <ul>
                    {job.benefits.map((benefit, index) => (
                      <li key={index}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Company Info */}
              <div className="mobile-job-card__company-details">
                <h4>About {job.company?.name}</h4>
                <p>{job.company?.description}</p>
                {job.company?.size && (
                  <div className="mobile-job-card__company-stat">
                    <User size={14} />
                    <span>{job.company.size} employees</span>
                  </div>
                )}
                {job.company?.industry && (
                  <div className="mobile-job-card__company-stat">
                    <Briefcase size={14} />
                    <span>{job.company.industry}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Card Footer */}
        <div className="mobile-job-card__footer">
          <div className="mobile-job-card__status-indicators">
            {isSaved && (
              <div className="mobile-job-card__status mobile-job-card__status--saved">
                <Heart size={12} />
                <span>Saved</span>
              </div>
            )}
            {isApplied && (
              <div className="mobile-job-card__status mobile-job-card__status--applied">
                <CheckCircle size={12} />
                <span>Applied</span>
              </div>
            )}
            {job.matchScore && (
              <div className="mobile-job-card__match-score">
                <Star size={12} />
                <span>{job.matchScore}% match</span>
              </div>
            )}
          </div>

          <div className="mobile-job-card__actions">
            <button
              className="mobile-job-card__action-btn mobile-job-card__action-btn--secondary"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Show Less' : 'Details'}
            </button>
            
            {!isApplied && (
              <button
                className="mobile-job-card__action-btn mobile-job-card__action-btn--primary"
                onClick={() => onApply(job.id)}
              >
                Apply Now
              </button>
            )}
            
            <button
              className="mobile-job-card__action-btn mobile-job-card__action-btn--icon"
              onClick={() => onView(job.id)}
            >
              <ExternalLink size={16} />
            </button>
          </div>
        </div>

        {/* Swipe Hints */}
        <div className="mobile-job-card__swipe-hints">
          <div className="mobile-job-card__swipe-hint mobile-job-card__swipe-hint--left">
            <Heart size={16} />
            <span>Swipe right to save</span>
          </div>
          <div className="mobile-job-card__swipe-hint mobile-job-card__swipe-hint--right">
            {showRemoveAction ? <X size={16} /> : <CheckCircle size={16} />}
            <span>Swipe left to {showRemoveAction ? 'remove' : 'apply'}</span>
          </div>
        </div>
      </motion.div>

      {/* Actions Menu */}
      {showActions && (
        <motion.div
          className="mobile-job-card__actions-menu"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mobile-job-card__actions-content">
            <button
              className="mobile-job-card__action-item"
              onClick={() => {
                onSave(job.id);
                setShowActions(false);
              }}
            >
              <Heart size={18} />
              <span>{isSaved ? 'Unsave' : 'Save Job'}</span>
            </button>
            
            <button
              className="mobile-job-card__action-item"
              onClick={() => {
                onShare(job);
                setShowActions(false);
              }}
            >
              <Share2 size={18} />
              <span>Share Job</span>
            </button>
            
            <button
              className="mobile-job-card__action-item"
              onClick={() => {
                onView(job.id);
                setShowActions(false);
              }}
            >
              <ExternalLink size={18} />
              <span>View Full Details</span>
            </button>
            
            {showRemoveAction && (
              <button
                className="mobile-job-card__action-item mobile-job-card__action-item--danger"
                onClick={() => {
                  onRemove(job.id);
                  setShowActions(false);
                }}
              >
                <X size={18} />
                <span>Remove from List</span>
              </button>
            )}
            
            <button
              className="mobile-job-card__action-item mobile-job-card__action-item--cancel"
              onClick={() => setShowActions(false)}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// PropTypes validation
MobileJobCard.propTypes = {
  job: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    company: PropTypes.shape({
      name: PropTypes.string.isRequired,
      logo: PropTypes.string,
      description: PropTypes.string,
      size: PropTypes.string,
      industry: PropTypes.string
    }),
    location: PropTypes.string.isRequired,
    type: PropTypes.string,
    level: PropTypes.string,
    remote: PropTypes.bool,
    salaryMin: PropTypes.number,
    salaryMax: PropTypes.number,
    description: PropTypes.string,
    requirements: PropTypes.arrayOf(PropTypes.string),
    benefits: PropTypes.arrayOf(PropTypes.string),
    skills: PropTypes.arrayOf(PropTypes.string),
    createdAt: PropTypes.string.isRequired,
    matchScore: PropTypes.number
  }).isRequired,
  onSave: PropTypes.func,
  onApply: PropTypes.func,
  onShare: PropTypes.func,
  onView: PropTypes.func,
  onRemove: PropTypes.func,
  isSaved: PropTypes.bool,
  isApplied: PropTypes.bool,
  showRemoveAction: PropTypes.bool,
  className: PropTypes.string
};

// Mobile Job Card List Component
export const MobileJobCardList = ({
  jobs = [],
  loading = false,
  onLoadMore = () => {},
  hasMore = false,
  ...cardProps
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef(null);

  // Pull to refresh
  const handlePullToRefresh = async () => {
    setRefreshing(true);
    try {
      await onLoadMore();
    } finally {
      setRefreshing(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current || loading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        onLoadMore();
      }
    };

    const list = listRef.current;
    if (list) {
      list.addEventListener('scroll', handleScroll);
      return () => list.removeEventListener('scroll', handleScroll);
    }
  }, [loading, hasMore, onLoadMore]);

  return (
    <div className="mobile-job-card-list" ref={listRef}>
      {/* Pull to Refresh Indicator */}
      {refreshing && (
        <div className="mobile-job-card-list__refresh-indicator">
          <div className="mobile-job-card-list__refresh-spinner" />
          <span>Refreshing jobs...</span>
        </div>
      )}

      {/* Job Cards */}
      <div className="mobile-job-card-list__items">
        {jobs.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <MobileJobCard job={job} {...cardProps} />
          </motion.div>
        ))}
      </div>

      {/* Loading More Indicator */}
      {loading && (
        <div className="mobile-job-card-list__loading">
          <div className="mobile-job-card-list__loading-spinner" />
          <span>Loading more jobs...</span>
        </div>
      )}

      {/* End of List */}
      {!hasMore && jobs.length > 0 && (
        <div className="mobile-job-card-list__end">
          <span>You've reached the end of the list</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && (
        <div className="mobile-job-card-list__empty">
          <Briefcase size={48} />
          <h3>No jobs found</h3>
          <p>Try adjusting your search filters or check back later for new opportunities.</p>
        </div>
      )}
    </div>
  );
};

MobileJobCardList.propTypes = {
  jobs: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  onLoadMore: PropTypes.func,
  hasMore: PropTypes.bool
};

export default MobileJobCard;
