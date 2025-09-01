import React, { useState } from 'react'
import { useApplicationsQuery, useUpdateApplicationStatusMutation, useApplicationStatsQuery, useUpcomingActionsQuery } from '@/hooks/useApplications'
import { useApplicationDetailQuery, useAddNoteMutation } from '@/hooks/useApplicationDetail'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, TrendingUp, Calendar, AlertCircle, Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'

const statusOrder = ['applied','interview','offer','hired','rejected']

function Drawer({ open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-zinc-900 border-l border-white/10 p-6 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function ApplicationStats() {
  const { data: stats, isLoading } = useApplicationStatsQuery()
  
  if (isLoading || !stats) {
    return <div className="text-gray-300">Loading stats...</div>
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-300">Total Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </CardContent>
      </Card>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-300">Response Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-cyan-400">{stats.responseRate}%</div>
          <Progress value={stats.responseRate} className="mt-2 h-1" />
        </CardContent>
      </Card>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-300">Avg. Response Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.averageTimeToResponse} days</div>
        </CardContent>
      </Card>
      
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-300">Upcoming Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-400">{stats.upcomingActions}</div>
        </CardContent>
      </Card>
    </div>
  )
}

function UpcomingActions() {
  const { data: actions, isLoading } = useUpcomingActionsQuery()
  
  if (isLoading) {
    return <div className="text-gray-300">Loading actions...</div>
  }
  
  if (!actions || actions.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-300">No upcoming actions</div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Actions
        </CardTitle>
        <CardDescription className="text-gray-300">
          Actions you need to take on your applications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.slice(0, 5).map((action) => (
            <div key={action.id} className="flex items-center justify-between p-3 bg-black/20 border border-white/10 rounded-lg">
              <div>
                <div className="text-white font-medium">{action.jobTitle}</div>
                <div className="text-gray-400 text-sm">{action.companyName}</div>
                <div className="text-gray-300 text-sm">{action.action}</div>
              </div>
              <div className="text-right">
                <Badge variant={action.overdue ? 'destructive' : action.priority === 'high' ? 'default' : 'secondary'}>
                  {action.overdue ? 'Overdue' : new Date(action.dueDate).toLocaleDateString('en-ZA')}
                </Badge>
                {action.overdue && (
                  <AlertCircle className="h-4 w-4 text-red-400 mt-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Applications() {
  const [filters, setFilters] = useState({})
  const { data, isLoading, isError, error } = useApplicationsQuery(filters)
  const { mutate: updateStatus, isPending } = useUpdateApplicationStatusMutation()
  const [selectedId, setSelectedId] = useState(null)
  const detail = useApplicationDetailQuery(selectedId)
  const addNote = useAddNoteMutation(selectedId)
  const [noteText, setNoteText] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeView, setActiveView] = useState('kanban')

  const columns = React.useMemo(() => {
    const cols = { applied: [], interview: [], offer: [], hired: [], rejected: [] }
    if (!data) return cols
    for (const a of data.items) cols[a.status].push(a)
    return cols
  }, [data])

  const handleSearch = (value) => {
    setSearchTerm(value)
    setFilters({ ...filters, search: value })
  }
  
  const KanbanView = () => (
    <div className="grid md:grid-cols-5 gap-4">
      {statusOrder.map((status) => (
        <div key={status} className="bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="text-white font-semibold capitalize mb-3 flex items-center justify-between">
            {status}
            <Badge variant="secondary" className="text-xs">
              {columns[status].length}
            </Badge>
          </div>
          <div className="space-y-3">
            {columns[status].map((a) => (
              <div 
                key={a.id} 
                className="bg-black/20 border border-white/10 rounded-lg p-3 text-gray-300 cursor-pointer hover:bg-black/30 transition-colors" 
                onClick={() => setSelectedId(a.id)}
              >
                <div className="text-white font-medium">{a.jobTitle}</div>
                <div className="text-gray-400 text-sm">{a.companyName}</div>
                <div className="text-gray-500 text-xs mt-1">
                  Applied: {new Date(a.appliedAt).toLocaleDateString('en-ZA')}
                </div>
                {a.nextAction && (
                  <div className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next: {a.nextAction.description}
                  </div>
                )}
                <div className="mt-2">
                  <select
                    className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm w-full"
                    value={a.status}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateStatus({ id: a.id, status: e.target.value })
                    }}
                    disabled={isPending}
                  >
                    {statusOrder.map((s) => (
                      <option key={s} value={s} className="bg-zinc-900">
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {columns[status].length === 0 && (
              <div className="text-gray-500 text-sm text-center py-4 border-2 border-dashed border-white/10 rounded-lg">
                No {status} applications
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
  
  const ListView = () => (
    <div className="space-y-3">
      {data?.items?.map((app) => (
        <Card key={app.id} className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setSelectedId(app.id)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-white font-medium">{app.jobTitle}</h3>
                    <p className="text-gray-400 text-sm">{app.companyName} • {app.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
                  <span>Applied: {new Date(app.appliedAt).toLocaleDateString('en-ZA')}</span>
                  {app.salaryRange && <span>Salary: {app.salaryRange}</span>}
                  <span>Source: {app.source}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge 
                  variant={app.status === 'hired' ? 'default' : app.status === 'rejected' ? 'destructive' : 'secondary'}
                  className="capitalize"
                >
                  {app.status}
                </Badge>
                <Badge 
                  variant={app.priority === 'high' ? 'destructive' : app.priority === 'medium' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {app.priority}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl md:text-5xl font-bold text-white">Applications</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        <ApplicationStats />

        {isLoading && <div className="text-gray-300">Loading applications...</div>}
        {isError && <div className="text-red-400">{error?.message}</div>}

        {!isLoading && !isError && (
          <Tabs value={activeView} onValueChange={setActiveView} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-white/10">
                <TabsTrigger value="kanban" className="data-[state=active]:bg-white/20">Kanban View</TabsTrigger>
                <TabsTrigger value="list" className="data-[state=active]:bg-white/20">List View</TabsTrigger>
                <TabsTrigger value="actions" className="data-[state=active]:bg-white/20">Upcoming Actions</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="kanban" className="space-y-6">
              {data && <KanbanView />}
            </TabsContent>
            
            <TabsContent value="list" className="space-y-6">
              {data && <ListView />}
            </TabsContent>
            
            <TabsContent value="actions" className="space-y-6">
              <UpcomingActions />
            </TabsContent>
          </Tabs>
        )}

        <Drawer open={!!selectedId} onClose={()=>setSelectedId(null)}>
          {detail.isLoading && <div className="text-gray-300">Loading…</div>}
          {detail.isError && <div className="text-red-400">{detail.error.message}</div>}
          {detail.data && (
            <div className="space-y-4">
              <div className="text-white text-xl font-semibold">{detail.data.jobTitle}</div>
              <div className="text-gray-400">{detail.data.companyName}</div>
              <div className="text-gray-500 text-sm">Applied: {new Date(detail.data.appliedAt).toLocaleString('en-ZA')}</div>
              {detail.data.job && (
                <div className="bg-white/5 border border-white/10 rounded p-3 text-gray-300">
                  <div className="text-white">{detail.data.job.title}</div>
                  <div className="text-gray-400 text-sm">{detail.data.job.company} • {detail.data.job.location}</div>
                </div>
              )}

              <div>
                <div className="text-white font-semibold mb-2">Notes</div>
                <form onSubmit={(e)=>{ e.preventDefault(); if(noteText.trim()){ addNote.mutate(noteText); setNoteText('') } }} className="flex gap-2 mb-3">
                  <input value={noteText} onChange={(e)=>setNoteText(e.target.value)} placeholder="Add a note" className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded text-white" />
                  <button className="px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded">Add</button>
                </form>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {detail.data.notes.map((n) => (
                    <div key={n.id} className="bg-black/20 border border-white/10 rounded p-2 text-gray-300">
                      <div className="text-white text-sm">{n.text}</div>
                      <div className="text-gray-500 text-xs">{new Date(n.createdAt).toLocaleString('en-ZA')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </div>
  )
}

