import React from 'react'
import { Link } from 'react-router-dom'

export default function EmptyState({ 
  title, 
  description, 
  ctaLabel, 
  ctaHref, 
  ctaOnClick,
  icon,
  className = '' 
}) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && (
        <div className="mb-4 flex justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">{description}</p>
      {(ctaLabel && (ctaHref || ctaOnClick)) && (
        <div>
          {ctaHref ? (
            <Link 
              to={ctaHref}
              className="inline-flex items-center px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
            >
              {ctaLabel}
            </Link>
          ) : (
            <button 
              onClick={ctaOnClick}
              className="inline-flex items-center px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
