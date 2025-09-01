import React, { useEffect, useRef } from 'react'

export default function ErrorBanner({ 
  title = "Something went wrong", 
  message, 
  onRetry, 
  variant = "soft",
  className = '' 
}) {
  const ref = useRef(null)
  
  useEffect(() => {
    // Focus the banner when it mounts for accessibility
    if (ref.current) {
      ref.current.focus()
    }
  }, [])
  
  const variantClasses = {
    soft: 'bg-red-500/10 border-red-500/20 text-red-200',
    solid: 'bg-red-500 border-red-600 text-white'
  }
  
  return (
    <div 
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={`border rounded-lg p-4 ${variantClasses[variant]} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold mb-1">{title}</h4>
          {message && <p className="text-sm opacity-90">{message}</p>}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
