import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-white mb-4">404</h1>
        <p className="text-gray-300 mb-6">The page you are looking for does not exist.</p>
        <Link to="/" className="text-cyan-400">Go home</Link>
      </div>
    </div>
  )
}

