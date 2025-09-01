import React from 'react'

const WidgetsDemo = () => {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Widgets <span className="text-cyan-400">Demo</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Component showcase and demonstration
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <p className="text-gray-300 text-center">
            Widget demonstrations will be displayed here.
          </p>
        </div>
      </div>
    </div>
  )
}

export default WidgetsDemo
