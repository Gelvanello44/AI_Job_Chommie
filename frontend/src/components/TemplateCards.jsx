import React from 'react'

export default function TemplateCards({ templates = [], selectedId, onSelect }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect?.(t.id)}
          className={`text-left rounded-lg border ${selectedId===t.id ? 'border-cyan-500' : 'border-white/20'} bg-white/5 hover:bg-white/10 p-3`}
        >
          <div className="text-white font-semibold">{t.name}</div>
          <div className="text-gray-400 text-xs mb-2">{t.description}</div>
          {/* tiny preview mock */}
          <div className="bg-black/30 rounded p-2">
            <div className="h-3 bg-white/30 rounded w-2/3 mb-1" />
            <div className="h-2 bg-white/20 rounded w-5/6 mb-1" />
            <div className="h-2 bg-white/10 rounded w-4/6 mb-1" />
            <div className="h-2 bg-white/10 rounded w-3/5" />
          </div>
        </button>
      ))}
    </div>
  )
}

