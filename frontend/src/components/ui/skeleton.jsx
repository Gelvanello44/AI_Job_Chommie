import React from 'react'

export function SkeletonLine({ width = 'full', height = '4', className = '' }) {
  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4'
  }

  const heightClasses = {
    '3': 'h-3',
    '4': 'h-4',
    '5': 'h-5',
    '6': 'h-6'
  }

  return (
    <div
      className={`${widthClasses[width]} ${heightClasses[height]} bg-white/10 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonBox({ width = 'full', height = '20', className = '' }) {
  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4'
  }

  const heightClasses = {
    '16': 'h-16',
    '20': 'h-20',
    '24': 'h-24',
    '32': 'h-32',
    '40': 'h-40'
  }

  return (
    <div
      className={`${widthClasses[width]} ${heightClasses[height]} bg-white/10 rounded-lg animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonJobCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6" aria-hidden="true">
      <SkeletonLine width="3/4" height="6" className="mb-2" />
      <SkeletonLine width="1/2" height="4" className="mb-1" />
      <SkeletonLine width="1/3" height="4" className="mb-4" />
      <div className="flex gap-3">
        <SkeletonLine width="1/4" height="4" />
        <SkeletonLine width="1/4" height="4" />
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6" aria-hidden="true">
      <SkeletonLine width="1/3" height="5" className="mb-4" />
      <SkeletonBox height="40" />
    </div>
  )
}
