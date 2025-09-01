import React from 'react'

export default function CvExperienceEditor({ value = [], onChange }) {
  function add() { onChange([...(value||[]), { role:'', company:'', start:'', end:'', description:'' }]) }
  function update(i, patch) {
    const copy = [...(value||[])]
    copy[i] = { ...copy[i], ...patch }
    onChange(copy)
  }
  function remove(i) {
    const copy = [...(value||[])]
    copy.splice(i,1)
    onChange(copy)
  }
  return (
    <div className="space-y-2">
      {(value||[]).map((e,i)=>(
        <div key={i} className="grid md:grid-cols-2 gap-2">
          <input placeholder="Role" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={e.role} onChange={(ev)=>update(i,{role:ev.target.value})} />
          <input placeholder="Company" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={e.company} onChange={(ev)=>update(i,{company:ev.target.value})} />
          <input placeholder="Start (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={e.start} onChange={(ev)=>update(i,{start:ev.target.value})} />
          <input placeholder="End (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={e.end} onChange={(ev)=>update(i,{end:ev.target.value})} />
          <input placeholder="Description" className="md:col-span-2 px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={e.description} onChange={(ev)=>update(i,{description:ev.target.value})} />
          <div className="md:col-span-2 flex justify-end">
            <button type="button" onClick={()=>remove(i)} className="px-3 py-1 border border-white/20 text-white rounded">Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="px-3 py-2 bg-white/10 border border-white/20 text-white rounded">Add experience</button>
    </div>
  )
}

