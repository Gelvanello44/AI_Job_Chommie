import React from 'react'

export default function CvEducationEditor({ value = [], onChange }) {
  function add() { onChange([...(value||[]), { degree:'', institution:'', start:'', end:'' }]) }
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
      {(value||[]).map((ed,i)=>(
        <div key={i} className="grid md:grid-cols-2 gap-2">
          <input placeholder="Degree" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={ed.degree} onChange={(ev)=>update(i,{degree:ev.target.value})} />
          <input placeholder="Institution" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={ed.institution} onChange={(ev)=>update(i,{institution:ev.target.value})} />
          <input placeholder="Start (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={ed.start} onChange={(ev)=>update(i,{start:ev.target.value})} />
          <input placeholder="End (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" value={ed.end} onChange={(ev)=>update(i,{end:ev.target.value})} />
          <div className="md:col-span-2 flex justify-end">
            <button type="button" onClick={()=>remove(i)} className="px-3 py-1 border border-white/20 text-white rounded">Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="px-3 py-2 bg-white/10 border border-white/20 text-white rounded">Add education</button>
    </div>
  )
}

