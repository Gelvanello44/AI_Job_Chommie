import React from 'react';
import { Bookmark, Share2, MapPin, DollarSign, Clock, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSwipeableCard } from '../hooks/useTouchGestures';

const SwipeableJobCard = ({ job, onAccept, onReject, onSave }) => {
  const swipeCard = useSwipeableCard({
    onSwipeLeft: () => onReject?.(job),
    onSwipeRight: () => onAccept?.(job),
    swipeThreshold: 100
  });

  return (
    <motion.div
      style={swipeCard.cardStyle}
      className="relative bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/10 p-6 cursor-grab active:cursor-grabbing"
      onTouchStart={swipeCard.onTouchStart}
      onTouchMove={swipeCard.onTouchMove}
      onTouchEnd={swipeCard.onTouchEnd}
    >
      {/* Swipe Indicators */}
      {swipeCard.isDragging && (
        <>
          {swipeCard.offset.x > 50 && (
            <div className="absolute top-8 left-8 px-4 py-2 rounded-lg bg-green-500 text-white font-semibold rotate-[-20deg]">
              INTERESTED
            </div>
          )}
          {swipeCard.offset.x < -50 && (
            <div className="absolute top-8 right-8 px-4 py-2 rounded-lg bg-red-500 text-white font-semibold rotate-[20deg]">
              PASS
            </div>
          )}
        </>
      )}

      {/* Job Content */}
      <div className="space-y-4">
        {/* Company Logo & Title */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold">
                {job.company.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{job.title}</h3>
              <p className="text-gray-400">{job.company}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave?.(job);
            }}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Bookmark className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Job Details */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1 text-sm text-gray-300">
            <MapPin className="h-4 w-4" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-300">
            <DollarSign className="h-4 w-4" />
            <span>{job.salary}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-300">
            <Clock className="h-4 w-4" />
            <span>{job.type}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-300 line-clamp-3">{job.description}</p>

        {/* Skills */}
        <div className="flex flex-wrap gap-2">
          {job.skills?.slice(0, 4).map((skill, index) => (
            <span
              key={index}
              className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-sm"
            >
              {skill}
            </span>
          ))}
          {job.skills?.length > 4 && (
            <span className="px-3 py-1 rounded-full bg-white/10 text-gray-400 text-sm">
              +{job.skills.length - 4} more
            </span>
          )}
        </div>

        {/* Action Buttons (Alternative to Swipe) */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <button
            onClick={() => onReject?.(job)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <X className="h-5 w-5" />
            <span>Pass</span>
          </button>
          <button
            onClick={() => onAccept?.(job)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
          >
            <Check className="h-5 w-5" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeableJobCard;
