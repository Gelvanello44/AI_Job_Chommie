import React from 'react'
import { Link } from 'react-router-dom'

export default function Upsell({ plan = 'pro', feature = 'this feature' }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg p-4">
      <div className="font-semibold mb-1">Upgrade required</div>
      <div className="text-sm mb-3">Upgrade to {plan === 'executive' ? 'Executive' : 'Pro'} to unlock {feature}.</div>
<Link to={`/payment?plan=${plan}`} className="inline-block px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded">Upgrade now</Link>
    </div>
  )
}

