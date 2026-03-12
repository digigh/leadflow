import { useState, useMemo } from 'react'
import {
  CalendarClock, Search, AlertTriangle, Clock, CalendarCheck, ChevronRight,
  Building2, Mail, Phone, Globe, Facebook, User, Edit2, Save, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { StatusBadge, PriorityBadge, Toast, ElegantDateTimeInput, formatToLocalDatetime, toISODatetime } from '../components/UI'
import { STATUS_OPTIONS, PRIORITY_OPTIONS, ASSIGNED_OPTIONS } from '../lib/constants'

// ── Helpers ──────────────────────────────────────────────────────────────────
function classify(followUpDate) {
  if (!followUpDate) return null
  const fu = new Date(followUpDate)
  const now = new Date()
  if (fu.toDateString() === now.toDateString()) return fu < now ? 'overdue-today' : 'today'
  if (fu < now) return 'overdue'
  return 'upcoming'
}
function classLabel(cls) {
  if (cls === 'overdue' || cls === 'overdue-today') return 'Overdue'
  if (cls === 'today') return 'Today'
  return 'Upcoming'
}
function classStyle(cls) {
  if (cls === 'overdue' || cls === 'overdue-today') return 'bg-red-50 text-red-600 border border-red-200'
  if (cls === 'today') return 'bg-orange-50 text-orange-600 border border-orange-200'
  return 'bg-green-50 text-green-600 border border-green-200'
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FollowUpsTab({ leads = [], setLeads, dbReady = false, darkMode = false, settings = {} }) {
  const statusOpts = settings.statusOptions || STATUS_OPTIONS
  const priorityOpts = settings.priorityOptions || PRIORITY_OPTIONS
  const assignedOpts = settings.assignedOptions || ASSIGNED_OPTIONS

  // Filters
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [assignedFilter, setAssignedFilter] = useState('All')

  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  // Only leads with a follow_up_at date
  const followUpLeads = useMemo(() =>
    leads
      .filter(l => l.follow_up_at)
      .map(l => ({ ...l, _cls: classify(l.follow_up_at) }))
      .sort((a, b) => new Date(a.follow_up_at) - new Date(b.follow_up_at)),
    [leads]
  )

  const counts = useMemo(() => ({
    overdue: followUpLeads.filter(l => l._cls === 'overdue' || l._cls === 'overdue-today').length,
    today: followUpLeads.filter(l => l._cls === 'today').length,
    upcoming: followUpLeads.filter(l => l._cls === 'upcoming').length,
    all: followUpLeads.length,
  }), [followUpLeads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return followUpLeads.filter(l => {
      if (view === 'overdue' && l._cls !== 'overdue' && l._cls !== 'overdue-today') return false
      if (view === 'today' && l._cls !== 'today' && l._cls !== 'overdue-today') return false
      if (view === 'upcoming' && l._cls !== 'upcoming') return false
      if (q && !['lead_name', 'company', 'email', 'phone'].some(k => l[k]?.toLowerCase().includes(q))) return false
      if (statusFilter !== 'All' && l.status !== statusFilter) return false
      if (priorityFilter !== 'All') {
        if (priorityFilter === 'Unassigned' && l.priority) return false
        if (priorityFilter !== 'Unassigned' && l.priority !== priorityFilter) return false
      }
      if (assignedFilter !== 'All') {
        if (assignedFilter === 'Unassigned' && l.assigned_to) return false
        if (assignedFilter !== 'Unassigned' && l.assigned_to !== assignedFilter) return false
      }
      return true
    })
  }, [followUpLeads, view, search, statusFilter, priorityFilter, assignedFilter])

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const handleEdit = (lead) => {
    setEditingId(lead.id)
    setEditData({
      status: lead.status || '',
      assigned_to: lead.assigned_to || '',
      priority: lead.priority || '',
      follow_up_at: lead.follow_up_at ? formatToLocalDatetime(lead.follow_up_at) : '',
      feedback: lead.feedback || '',
      remarks: lead.remarks || '',
    })
  }

  const handleSave = async (id) => {
    setSaving(true)
    const payload = {
      status: editData.status ? editData.status : null,
      assigned_to: editData.assigned_to ? editData.assigned_to : null,
      priority: editData.priority ? editData.priority : null,
      follow_up_at: editData.follow_up_at ? toISODatetime(editData.follow_up_at) : null,
      feedback: editData.feedback || null,
      remarks: editData.remarks || null,
    }

    if (dbReady) {
      const { error } = await supabase.from('leads').update(payload).eq('id', id)
      if (error) {
        showToast(`Save failed: ${error.message}`, 'error')
        setSaving(false)
        return
      }
      showToast('Saved ✓  (reflected in Lead Management)')
    } else {
      showToast('Saved locally (DB not connected)', 'error')
    }

    // Update shared leads state — reflects in Lead Management tab instantly
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...payload } : l))
    setEditingId(null)
    setSaving(false)
  }

  const handleCancel = () => { setEditingId(null); setEditData({}) }

  // ── Theme ─────────────────────────────────────────────────────────────────
  const t = darkMode ? {
    card: 'bg-[#1A2035] border-[#2A2F3E]',
    text: 'text-[#E2E8F0]',
    subtext: 'text-[#8892A4]',
    input: 'bg-[#1E2436] border-[#2A2F3E] text-[#E2E8F0] placeholder-[#4A5568]',
    rowHover: 'hover:bg-[#1E2540]',
    editRow: 'bg-[#1E2A40]',
    th: 'bg-[#1E2436] text-[#8892A4]',
    divider: 'border-[#2A2F3E]',
    tag: 'bg-[#2A2F3E] text-[#8892A4]',
  } : {
    card: 'bg-white border-[#E6EBF2]',
    text: 'text-[#2F3542]',
    subtext: 'text-[#9AA5B1]',
    input: 'bg-white border-[#E6EBF2] text-[#2F3542] placeholder-[#9AA5B1]',
    rowHover: 'hover:bg-[#F9FBFF]',
    editRow: 'bg-[#F0F7FF]',
    th: 'bg-[#F8FAFC] text-[#6B778C]',
    divider: 'border-[#EEF2F7]',
    tag: 'bg-[#F4F6F9] text-[#6B778C]',
  }

  const inSelect = `text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2F6BFF] w-28 ${t.input}`
  const inTextarea = `w-full text-xs border-2 border-[#2F6BFF] rounded-lg px-2 py-1.5 focus:outline-none ${darkMode ? 'bg-[#1A2035] text-[#E2E8F0]' : 'bg-white'}`

  const viewBtns = [
    { id: 'all', label: 'All', count: counts.all, active: 'text-[#2F6BFF] border-[#2F6BFF] bg-[#E9F2FF]' },
    { id: 'overdue', label: 'Overdue', count: counts.overdue, active: 'text-red-600 border-red-300 bg-red-50' },
    { id: 'today', label: 'Today', count: counts.today, active: 'text-orange-600 border-orange-300 bg-orange-50' },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming, active: 'text-green-600 border-green-300 bg-green-50' },
  ]

  const selectCls = `px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF] ${t.input}`

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Follow-ups', value: counts.all, icon: CalendarClock, color: '#2F6BFF', bg: 'bg-[#E9F2FF]' },
          { label: 'Overdue', value: counts.overdue, icon: AlertTriangle, color: '#EF4444', bg: 'bg-red-50' },
          { label: "Today's", value: counts.today, icon: Clock, color: '#F97316', bg: 'bg-orange-50' },
          { label: 'Upcoming', value: counts.upcoming, icon: CalendarCheck, color: '#22C55E', bg: 'bg-green-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${t.card} border rounded-xl p-4 flex items-center gap-4 shadow-sm`}>
            <div className={`${bg} w-10 h-10 rounded-full flex items-center justify-center shrink-0`}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${t.subtext}`}>{label}</p>
              <p className={`text-2xl font-black`} style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div className={`${t.card} border rounded-xl shadow-sm overflow-hidden`}>

        {/* Toolbar */}
        <div className={`p-4 border-b ${t.divider} space-y-3`}>
          {/* View toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {viewBtns.map(btn => (
              <button key={btn.id} onClick={() => setView(btn.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                  ${view === btn.id ? btn.active : `${t.tag} border-transparent`}`}>
                {btn.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black
                  ${view === btn.id ? 'bg-white/50' : darkMode ? 'bg-[#1A2035]' : 'bg-white'}`}>
                  {btn.count}
                </span>
              </button>
            ))}
            <span className={`ml-auto text-[10px] ${t.subtext}`}>Click <strong>Edit</strong> on any row to update it — changes sync to Lead Management</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subtext}`} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, company, email..."
                className={`w-full pl-8 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF] ${t.input}`} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="All">All Status</option>
              {statusOpts.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={selectCls}>
              <option value="All">All Priorities</option>
              {priorityOpts.map(p => <option key={p}>{p}</option>)}
              <option value="Unassigned">Unassigned</option>
            </select>
            <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)} className={selectCls}>
              <option value="All">All Owners</option>
              {assignedOpts.map(a => <option key={a}>{a}</option>)}
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className={`py-16 text-center ${t.subtext}`}>
            <CalendarClock size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-sm">No follow-ups found</p>
            <p className="text-xs mt-1 opacity-60">
              {view === 'all' ? 'Schedule follow-ups from the Edit button in Lead Management' : `No ${view} follow-ups match your filters`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${t.th} border-b ${t.divider}`}>
                  {['Lead', 'Company', 'Contact', 'Assigned To', 'Follow-up Time', 'Status', 'Priority', 'Feedback / Remarks', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const fu = new Date(lead.follow_up_at)
                  const cls = lead._cls
                  const isEditing = editingId === lead.id

                  return (
                    <tr key={lead.id}
                      className={`border-b ${t.divider} transition-colors ${isEditing ? t.editRow : t.rowHover}`}>

                      {/* Lead Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[#2F6BFF] font-bold text-xs shrink-0 ${darkMode ? 'bg-[#1E3A5F]' : 'bg-[#E9F2FF]'}`}>
                            {(lead.lead_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={`font-semibold text-xs ${t.text}`}>{lead.lead_name || '—'}</div>
                            <div className={`text-[10px] ${t.subtext}`}>{lead.job_title || ''}</div>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3">
                        {lead.company ? (
                          <div className="flex items-center gap-1.5 text-xs mb-1">
                            <Building2 size={11} className={`shrink-0 ${t.subtext}`} />
                            <span className={`font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${darkMode ? 'bg-[#1E3A5F] text-blue-400 border-blue-800/50' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                              {lead.company}
                            </span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-1.5 text-xs mb-1 ${t.subtext}`}>
                            <Building2 size={11} className="shrink-0" />
                            <span>—</span>
                          </div>
                        )}
                        <div className={`flex items-center gap-1 text-[10px] ${t.subtext}`}>
                          {lead.source === 'Website' ? <Globe size={9} /> : <Facebook size={9} />}
                          {lead.source || '—'}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 text-xs space-y-1">
                        {lead.email && (
                          <div className={`flex items-center gap-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            <Mail size={10} /><span className="truncate max-w-32">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className={`flex items-center gap-1 ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                            <Phone size={10} /><span>{lead.phone}</span>
                          </div>
                        )}
                        {!lead.email && !lead.phone && <span className={t.subtext}>—</span>}
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={editData.assigned_to}
                            onChange={e => setEditData(d => ({ ...d, assigned_to: e.target.value }))}
                            className={inSelect}>
                            <option value="">— None —</option>
                            {assignedOpts.map(a => <option key={a}>{a}</option>)}
                          </select>
                        ) : (
                          <div className={`flex items-center gap-1.5 text-xs font-medium ${lead.assigned_to ? t.text : t.subtext}`}>
                            <User size={11} className="shrink-0" />
                            {lead.assigned_to || <span className="italic">Unassigned</span>}
                          </div>
                        )}
                      </td>

                      {/* Follow-up Time */}
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <ElegantDateTimeInput 
                            value={editData.follow_up_at}
                            onChange={e => setEditData(d => ({ ...d, follow_up_at: e.target.value }))}
                            className="w-44" 
                            darkMode={darkMode} 
                          />
                        ) : (
                          <span className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${classStyle(cls)}`}>
                            <span>{classLabel(cls)}</span>
                            <span className="font-semibold">
                              {fu.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={editData.status}
                            onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}
                            className={inSelect}>
                            <option value="">— Select —</option>
                            {statusOpts.map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : <StatusBadge status={lead.status} />}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={editData.priority}
                            onChange={e => setEditData(d => ({ ...d, priority: e.target.value }))}
                            className={inSelect}>
                            <option value="">— Select —</option>
                            {priorityOpts.map(p => <option key={p}>{p}</option>)}
                          </select>
                        ) : <PriorityBadge priority={lead.priority} />}
                      </td>

                      {/* Feedback / Remarks */}
                      <td className="px-4 py-3 max-w-48" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <textarea value={editData.feedback}
                              onChange={e => setEditData(d => ({ ...d, feedback: e.target.value }))}
                              placeholder="Feedback..." rows={2} className={inTextarea} />
                            <textarea value={editData.remarks}
                              onChange={e => setEditData(d => ({ ...d, remarks: e.target.value }))}
                              placeholder="Remarks..." rows={2} className={inTextarea} />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className={`text-xs ${t.subtext} truncate max-w-44`}>{lead.feedback || <span className="italic opacity-40">—</span>}</p>
                            {lead.remarks && <p className={`text-[10px] ${t.subtext} opacity-70 truncate max-w-44`}>{lead.remarks}</p>}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleSave(lead.id)} disabled={saving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-60">
                              <Save size={11} />{saving ? '...' : 'Save'}
                            </button>
                            <button onClick={handleCancel}
                              className="px-2 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-lg hover:bg-gray-200">
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => handleEdit(lead)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#E9F2FF] text-[#2F6BFF] text-xs font-bold rounded-lg hover:bg-[#2F6BFF] hover:text-white transition-colors">
                            <Edit2 size={11} />Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={`px-5 py-2.5 border-t ${t.divider} flex items-center gap-2 text-xs ${t.subtext}`}>
          <ChevronRight size={11} />
          Showing {filtered.length} of {followUpLeads.length} follow-up leads
          {filtered.length !== followUpLeads.length && ' (filtered)'}
          {' · '}{dbReady ? '🟢 Connected' : '🟠 Demo mode'}
        </div>
      </div>
    </div>
  )
}
