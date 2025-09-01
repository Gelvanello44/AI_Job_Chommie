import React from 'react'
import Spinner from './Spinner'

export default function LoadingOverlay({ 
  isVisible, 
  message = "Loading...", 
  className = '' 
}) {
  if (!isVisible) return null
  
  return (
    <div 
      className={`absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg ${className}`}
      role="status"
      aria-busy="true"
      aria-label={message}
    >
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 flex flex-col items-center">
        <Spinner size="lg" className="mb-3" />
        <span className="text-white text-sm">{message}</span>
      </div>
    </div>
  )
}
