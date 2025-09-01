import React from 'react'

export default function Modal({ open, onClose, title, children, actions }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-xl p-6 shadow-xl">
          {title && <div className="text-white text-xl font-semibold mb-3">{title}</div>}
          <div className="text-gray-300 mb-4">{children}</div>
          <div className="flex gap-3 justify-end">
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}

