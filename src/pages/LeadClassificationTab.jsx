import { useState, useMemo } from 'react'
import { Filter, Calendar, Users, Building2, Flame, Sun, Snowflake, Edit2, Save, X, Mail, Phone, Globe, Facebook, MessageSquare, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS_OPTIONS, PRIORITY_OPTIONS, ASSIGNED_OPTIONS } from '../lib/constants'
import { Toast, ElegantDateTimeInput, formatToLocalDatetime, toISODatetime } from '../components/UI'


// Generic filter options (would be dynamically generated in a real scenario)
const SOURCES = ['Website', 'Meta', 'Landing Page 2', 'New Meta Leads March', 'Direct']
const INDUSTRIES = ['All', 'Agriculture', 'Retail', 'Tech', 'Manufacturing', 'Logistics', 'Other']
const DATE_RANGES = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' }
]

export default function LeadClassificationTab({ leads, setLeads, dbReady, darkMode, onAddNotification }) {
  const [filterSource, setFilterSource] = useState('All')
  const [filterOwner, setFilterOwner] = useState('All')
  const [filterIndustry, setFilterIndustry] = useState('All')
  const [filterDate, setFilterDate] = useState('all')
  const [minScore, setMinScore] = useState(0)

  // Edit / Qualify Modal State
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const handleEdit = (lead) => {
    setEditingId(lead.id)
    const qual = lead.lead_qualifications && lead.lead_qualifications[0] ? lead.lead_qualifications[0] : {}
    let role = qual.role || ''
    let customRole = ''
    if (role && !['Decision Maker', 'Manager', 'Other'].includes(role)) {
       customRole = role
       role = 'Other'
    }

    const initEditData = {
      message: lead.message || '',
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      status: lead.status || '',
      feedback: lead.feedback || '',
      remarks: lead.remarks || '',
      assigned_to: lead.assigned_to || '',
      priority: lead.priority || '',
      business_type: lead.business_type || '',
      looking_for: lead.looking_for || '',
      website: lead.website || '',
      follow_up_at: lead.follow_up_at ? formatToLocalDatetime(lead.follow_up_at) : '',
      qual_role: role,
      qual_role_custom: customRole,
      qual_industry: qual.industry || '',
      qual_use_case: qual.use_case || '',
      qual_scale: qual.scale || '',
      qual_geography: qual.geography || '',
      qual_timeline: qual.timeline || '',
      qual_experience: qual.experience !== undefined ? (qual.experience ? 'Yes' : 'No') : '',
    }
    setEditData(initEditData)
  }

  const handleSave = async (id) => {
    setSaving(true)
    const leadTarget = leads.find(l => l.id === id)
    const corePayload = {
      status: editData.status ? editData.status : null,
      feedback: editData.feedback || null,
      remarks: editData.remarks || null,
      assigned_to: editData.assigned_to ? editData.assigned_to : null,
      priority: editData.priority ? editData.priority : null,
      business_type: editData.business_type || null,
      looking_for: editData.looking_for || null,
      website: editData.website || null,
      company: editData.company || null,
    }
    const fullPayload = {
      ...corePayload,
      follow_up_at: editData.follow_up_at ? toISODatetime(editData.follow_up_at) : null,
    }

    const isExp = editData.qual_experience === 'Yes'
    const finalRole = editData.qual_role === 'Other' ? editData.qual_role_custom : editData.qual_role
    
    let score = 0
    score += finalRole === 'Decision Maker' ? 3 : 1
    score += editData.qual_timeline === 'Immediate' ? 3 : 1
    score += editData.qual_scale === '1000+' ? 2 : 1
    score += isExp ? 2 : 0
    score += editData.qual_use_case && editData.qual_use_case.trim() !== '' ? 3 : 1
    
    let category = 'Cold'
    let action_plan = 'Do not pass'
    if (score >= 10) { category = 'Hot'; action_plan = 'Immediate sales handoff' } 
    else if (score >= 6) { category = 'Warm'; action_plan = 'Nurture + schedule call' }

    const qualPayload = {
      lead_id: id,
      company_name: editData.company || leadTarget?.company || null,
      role: finalRole || null,
      industry: editData.qual_industry || null,
      use_case: editData.qual_use_case || null,
      scale: editData.qual_scale || null,
      geography: editData.qual_geography || null,
      timeline: editData.qual_timeline || null,
      experience: isExp,
      score,
      category,
      action_plan
    }

    let newQual = null
    if (dbReady) {
      let { error } = await supabase.from('leads').update(fullPayload).eq('id', id)
      if (error && (error.message?.includes('follow_up_at') || error.code === '42703')) {
        const retry = await supabase.from('leads').update(corePayload).eq('id', id)
        error = retry.error
        if (!error) {
          let qError = null
          try {
            const qRes = await supabase.from('lead_qualifications').upsert(qualPayload, { onConflict: 'lead_id' }).select().single()
            if (qRes.error) qError = qRes.error
            if (qRes.data) newQual = qRes.data
          } catch(e) { qError = e }
          
          if (qError) {
            showToast('Saved ✓ (scoring failed)', 'warning')
          } else {
            showToast('Saved ✓ (migration needed for followups)', 'warning')
          }
          if (setLeads) {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, ...corePayload, lead_qualifications: newQual ? [newQual] : l.lead_qualifications } : l))
          }
          setEditingId(null)
          setSaving(false)
          return
        }
      }

      if (error) {
        showToast(`Save failed: ${error.message}`, 'error')
        setSaving(false)
        return
      }

      let qError = null
      try {
        const qRes = await supabase.from('lead_qualifications').upsert(qualPayload, { onConflict: 'lead_id' }).select().single()
        if (qRes.error) qError = qRes.error
        if (qRes.data) newQual = qRes.data
      } catch(e) { qError = e }

      if (qError) {
        showToast('Lead saved, scoring failed', 'error')
      } else {
        showToast('Saved to Cloud DB ✓')
      }
    } else {
      showToast('Saved locally (Demo Mode)', 'success')
      newQual = qualPayload
      if (onAddNotification) {
        onAddNotification({
          title: 'Lead Updated Locally',
          message: `CRM details for "${leadTarget?.lead_name || 'Lead'}" updated locally.`,
          tab: 'classification'
        })
      }
    }

    if (setLeads) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...fullPayload, lead_qualifications: newQual ? [newQual] : l.lead_qualifications } : l))
    }
    setEditingId(null)
    setSaving(false)
  }

  const TEAM_MEMBERS = useMemo(() => {
    return ['Unassigned', ...new Set((leads || []).map(l => l.assigned_to).filter(Boolean))].sort()
  }, [leads])


  const t = darkMode ? {
    bg: 'bg-[#161B27]',
    card: 'bg-[#1A2035]',
    border: 'border-[#2A2F3E]',
    text: 'text-[#E2E8F0]',
    subtext: 'text-[#8892A4]',
    input: 'bg-[#161B27] border-[#2A2F3E] text-[#E2E8F0] focus:border-[#2F6BFF]',
  } : {
    bg: 'bg-[#F6F8FB]',
    card: 'bg-white',
    border: 'border-[#E6EBF2]',
    text: 'text-[#2F3542]',
    subtext: 'text-[#6B778C]',
    input: 'bg-white border-[#E6EBF2] text-[#2F3542] focus:border-[#2F6BFF]',
  }

  // Retrieve only assessed leads and apply filters
  const filteredAndAssessedLeads = useMemo(() => {
    return leads.filter(l => {
      // Must be assessed
      if (!l.lead_qualifications || l.lead_qualifications.length === 0) return false
      
      const qual = l.lead_qualifications[0]
      if (!qual) return false

      if (filterSource !== 'All' && l.source !== filterSource) return false
      if (filterOwner !== 'All') {
        const owner = l.assigned_to || 'Unassigned'
        if (owner !== filterOwner) return false
      }
      if (filterIndustry !== 'All' && qual.industry !== filterIndustry) return false
      if (qual.score < minScore) return false
      
      if (filterDate !== 'all' && l.date) {
        const d = new Date(l.date)
        const now = new Date()
        if (filterDate === 'today' && d.toDateString() !== now.toDateString()) return false
        if (filterDate === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (d < weekAgo) return false
        }
        if (filterDate === 'month') {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
        }
      }

      return true
    })
  }, [leads, filterSource, filterOwner, filterIndustry, filterDate])

  const hotLeads = filteredAndAssessedLeads.filter(l => l.lead_qualifications[0]?.category === 'Hot').sort((a,b) => (b.lead_qualifications[0]?.score || 0) - (a.lead_qualifications[0]?.score || 0))
  const warmLeads = filteredAndAssessedLeads.filter(l => l.lead_qualifications[0]?.category === 'Warm').sort((a,b) => (b.lead_qualifications[0]?.score || 0) - (a.lead_qualifications[0]?.score || 0))
  const coldLeads = filteredAndAssessedLeads.filter(l => l.lead_qualifications[0]?.category === 'Cold').sort((a,b) => (b.lead_qualifications[0]?.score || 0) - (a.lead_qualifications[0]?.score || 0))

  const LeadCard = ({ lead, type, onClick }) => {
    const qual = lead.lead_qualifications[0]
    const dateObj = lead.date ? new Date(lead.date) : null
    
    // Dynamic styles based on type
    const s = type === 'hot' ? {
      border: 'border-red-200 dark:border-red-900/50',
      bg: 'bg-red-50 dark:bg-red-500/10',
      badge: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border dark:border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.05)]',
      accent: 'text-red-600 dark:text-red-400'
    } : type === 'warm' ? {
      border: 'border-orange-200 dark:border-orange-900/50',
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 dark:border dark:border-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.05)]',
      accent: 'text-orange-600 dark:text-orange-400'
    } : {
      border: 'border-blue-200 dark:border-blue-900/50',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border dark:border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.05)]',
      accent: 'text-blue-600 dark:text-blue-400'
    }

    return (
      <div 
        onClick={onClick}
        className={`rounded-xl border p-4 mb-4 ${t.card} ${s.border} shadow-sm transition-transform hover:-translate-y-1 cursor-pointer hover:shadow-md`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className={`font-bold text-sm ${t.text}`}>{lead.lead_name || 'Unknown Lead'}</h4>
            <p className={`text-[10px] ${t.subtext} mt-0.5 uppercase tracking-wide font-semibold flex items-center gap-1`}>
              <Building2 size={10} /> {qual.company_name || lead.company || 'No Company'}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${s.badge}`}>
              {type === 'hot' ? <Flame size={10} /> : type === 'warm' ? <Sun size={10} /> : <Snowflake size={10} />}
              {qual.score} PTS
            </div>
          </div>
        </div>

        <div className={`p-2.5 rounded-lg text-xs font-semibold ${s.bg} ${s.accent} mb-4 flex items-start gap-2`}>
          <span className="shrink-0 mt-0.5">⚡</span>
          {qual.action_plan}
        </div>

        <div className={`grid grid-cols-2 gap-y-3 text-[10px] ${t.subtext}`}>
          <div>
            <span className="block opacity-60 mb-0.5">Submitted On</span>
            <span className={`font-semibold ${t.text}`}>
              {dateObj ? `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="block opacity-60 mb-0.5">Assigned To</span>
            <span className={`font-semibold ${t.text} flex items-center gap-1`}>
              <Users size={10} /> {lead.assigned_to || 'Unassigned'}
            </span>
          </div>
          <div>
            <span className="block opacity-60 mb-0.5">Role</span>
            <span className={`font-semibold ${t.text}`}>{qual.role || '—'}</span>
          </div>
          <div>
            <span className="block opacity-60 mb-0.5">Industry</span>
            <span className={`font-semibold ${t.text}`}>{qual.industry || '—'}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="shrink-0 mb-6">
        <h2 className={`text-xl font-bold ${t.text}`}>Lead Classification</h2>
        <p className={`text-sm ${t.subtext}`}>Auto-scored queues based on your Lead Qualification assessments.</p>
        
        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <div className="flex items-center gap-2">
            <Filter size={14} className={t.subtext} />
            <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className={`text-xs px-3 py-2 rounded-lg border ${t.input} font-medium`}>
              {DATE_RANGES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={`text-xs px-3 py-2 rounded-lg border ${t.input} font-medium`}>
            <option value="All">All Sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className={`text-xs px-3 py-2 rounded-lg border ${t.input} font-medium`}>
            <option value="All">All Owners</option>
            {TEAM_MEMBERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} className={`text-xs px-3 py-2 rounded-lg border ${t.input} font-medium`}>
            {INDUSTRIES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Industries' : s}</option>)}
          </select>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${t.input}`}>
            <span className="text-xs font-bold whitespace-nowrap">Min Score: {minScore}</span>
            <input type="range" min="0" max="20" value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="w-24 accent-[#2F6BFF]" />
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* HOT LEADS */}
        <div className={`flex flex-col rounded-2xl border ${t.border} overflow-hidden ${darkMode ? 'bg-[#161B27]/50' : 'bg-gray-50/50'}`}>
          <div className="p-4 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                <Flame size={16} /> HOT LEADS
              </h3>
              <span className="bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-200 text-[10px] font-black px-2 py-0.5 rounded-full">{hotLeads.length}</span>
            </div>
            <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-1 uppercase font-bold tracking-wider">Score 10+ • Immediate Action</p>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {hotLeads.length === 0 ? (
              <div className={`text-center text-xs py-10 opacity-50 ${t.subtext}`}>No hot leads in this view.</div>
            ) : (
              hotLeads.map(l => <LeadCard key={l.id} lead={l} type="hot" onClick={() => handleEdit(l)} />)
            )}
          </div>
        </div>

        {/* WARM LEADS */}
        <div className={`flex flex-col rounded-2xl border ${t.border} overflow-hidden ${darkMode ? 'bg-[#161B27]/50' : 'bg-gray-50/50'}`}>
          <div className="p-4 border-b border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Sun size={16} /> WARM LEADS
              </h3>
              <span className="bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200 text-[10px] font-black px-2 py-0.5 rounded-full">{warmLeads.length}</span>
            </div>
            <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 mt-1 uppercase font-bold tracking-wider">Score 6-9 • Nurture Queue</p>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {warmLeads.length === 0 ? (
              <div className={`text-center text-xs py-10 opacity-50 ${t.subtext}`}>No warm leads in this view.</div>
            ) : (
              warmLeads.map(l => <LeadCard key={l.id} lead={l} type="warm" onClick={() => handleEdit(l)} />)
            )}
          </div>
        </div>

        {/* COLD LEADS */}
        <div className={`flex flex-col rounded-2xl border ${t.border} overflow-hidden ${darkMode ? 'bg-[#161B27]/50' : 'bg-gray-50/50'}`}>
          <div className="p-4 border-b border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Snowflake size={16} /> COLD LEADS
              </h3>
              <span className="bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200 text-[10px] font-black px-2 py-0.5 rounded-full">{coldLeads.length}</span>
            </div>
            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-1 uppercase font-bold tracking-wider">Score &lt;6 • Do Not Pass</p>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {coldLeads.length === 0 ? (
              <div className={`text-center text-xs py-10 opacity-50 ${t.subtext}`}>No cold leads in this view.</div>
            ) : (
              coldLeads.map(l => <LeadCard key={l.id} lead={l} type="cold" onClick={() => handleEdit(l)} />)
            )}
          </div>
        </div>
      </div>
    </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Edit Lead Modal ─────────────────────────────────────────────── */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`${darkMode ? 'bg-[#1A2035] border-[#2A2F3E]' : 'bg-white border-[#E6EBF2]'} border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-[#2A2F3E] bg-[#1E2436]' : 'border-[#E6EBF2] bg-[#F9FBFF]'} shrink-0`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2F6BFF]/10 flex items-center justify-center">
                  <Edit2 size={20} className="text-[#2F6BFF]" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${t.text}`}>Edit / Qualify Lead</h3>
                  <p className={`text-xs ${t.subtext}`}>Update CRM details and lead scoring factors simultaneously.</p>
                </div>
              </div>
              <button onClick={() => !saving && setEditingId(null)} className={`p-2 rounded-lg ${t.subtext} hover:bg-red-500/10 hover:text-red-500 transition-colors`}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
              {/* Lead Identity & Context */}
              <section className={`border ${darkMode ? 'border-[#2A2F3E] bg-[#161B27]/40' : 'border-[#E6EBF2] bg-white'} rounded-xl p-5 shadow-sm`}>
                <h4 className={`text-xs font-bold ${t.text} uppercase tracking-wider mb-4 border-b ${darkMode ? 'border-[#2A2F3E]' : 'border-[#EEF2F7]'} pb-2`}>Lead Information</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div>
                    <label className={`block text-[10px] font-bold ${t.subtext} uppercase mb-1`}>Phone Number</label>
                    <div className={`flex items-center gap-2 px-3 py-2 ${darkMode ? 'bg-[#1E2436]/50 border-[#2A2F3E]' : 'bg-gray-50 border-gray-100'} text-sm font-medium rounded-lg border`}>
                      <Phone size={14} className={t.subtext} />
                      <span className={t.text}>{editData.phone || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold ${t.subtext} uppercase mb-1`}>Email</label>
                    <div className={`flex items-center gap-2 px-3 py-2 ${darkMode ? 'bg-[#1E2436]/50 border-[#2A2F3E]' : 'bg-gray-50 border-gray-100'} text-sm font-medium rounded-lg border overflow-hidden`}>
                      <Mail size={14} className={`${t.subtext} shrink-0`} />
                      <span className={`truncate ${t.text}`}>{editData.email || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold ${t.subtext} uppercase mb-1`}>Source</label>
                    <div className={`flex items-center gap-2 px-3 py-2 ${darkMode ? 'bg-[#1E2436]/50 border-[#2A2F3E]' : 'bg-gray-50 border-gray-100'} text-sm font-medium rounded-lg border`}>
                      <Globe size={14} className="text-[#2F6BFF]" />
                      <span className={t.text}>{editData.source || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold ${t.subtext} uppercase mb-1 flex justify-between`}>
                      Company Name <span className="text-[#2F6BFF] normal-case tracking-normal">editable</span>
                    </label>
                    <input 
                      type="text" 
                      value={editData.company || ''} 
                      onChange={e => setEditData(d => ({ ...d, company: e.target.value }))} 
                      className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none transition-colors ${darkMode ? 'bg-[#161B27] border-[#2A2F3E] text-white focus:border-[#2F6BFF]' : 'bg-white border-blue-100 focus:border-[#2F6BFF]'}`} 
                      placeholder="Enter company name..." 
                    />
                  </div>
                  <div className="md:col-span-4 mt-2">
                    <label className={`block text-[10px] font-bold ${t.subtext} uppercase mb-1`}>Original Lead Message</label>
                    <div className={`border rounded-lg p-3.5 flex gap-3 items-start ${darkMode ? 'bg-[#1E2436]/30 border-[#2A2F3E]' : 'bg-blue-50/40 border-blue-100'}`}>
                      <MessageSquare size={16} className="text-[#2F6BFF] shrink-0 mt-0.5" />
                      <p className={`text-sm leading-relaxed ${editData.message ? (darkMode ? 'text-[#E2E8F0] italic font-medium' : 'text-[#2F3542] italic font-medium') : 'text-gray-400 italic'}`}>
                        {editData.message ? `"${editData.message}"` : 'No message provided by this lead.'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Core CRM Information */}
              <section>
                <h4 className="text-xs font-bold text-[#2F6BFF] uppercase tracking-wider mb-4 border-b border-blue-100 pb-2">Core CRM Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Status</label>
                    <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${t.input}`}>
                      <option value="">— Select —</option>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Priority</label>
                    <select value={editData.priority} onChange={e => setEditData(d => ({ ...d, priority: e.target.value }))} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${t.input}`}>
                      <option value="">— Select —</option>
                      {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Assigned To</label>
                    <select value={editData.assigned_to} onChange={e => setEditData(d => ({ ...d, assigned_to: e.target.value }))} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${t.input}`}>
                      <option value="">— Unassigned —</option>
                      {ASSIGNED_OPTIONS.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Follow-up Time</label>
                    <ElegantDateTimeInput value={editData.follow_up_at || ''} onChange={e => setEditData(d => ({ ...d, follow_up_at: e.target.value }))} className="w-full" darkMode={darkMode} />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Business Type</label>
                    <input type="text" value={editData.business_type || ''} onChange={e => setEditData(d => ({ ...d, business_type: e.target.value }))} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${t.input}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Looking For</label>
                    <input type="text" value={editData.looking_for || ''} onChange={e => setEditData(d => ({ ...d, looking_for: e.target.value }))} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${t.input}`} />
                  </div>
                  <div className="col-span-2">
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Website</label>
                    <input type="text" value={editData.website || ''} onChange={e => setEditData(d => ({ ...d, website: e.target.value }))} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${t.input}`} />
                  </div>
                </div>
              </section>

              {/* Notes & Feedback */}
              <section>
                <h4 className="text-xs font-bold text-[#20C997] uppercase tracking-wider mb-4 border-b border-emerald-100 pb-2">Notes & Remarks</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Feedback / Updates</label>
                    <textarea value={editData.feedback || ''} onChange={e => setEditData(d => ({ ...d, feedback: e.target.value }))} rows={3} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none resize-none ${t.input}`} placeholder="Sales feedback..."></textarea>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.subtext} mb-1`}>Internal Remarks</label>
                    <textarea value={editData.remarks || ''} onChange={e => setEditData(d => ({ ...d, remarks: e.target.value }))} rows={3} className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none resize-none ${t.input}`} placeholder="Internal context..."></textarea>
                  </div>
                </div>
              </section>

              {/* Qualification Engine */}
              <section className={`p-5 rounded-xl border ${darkMode ? 'bg-gradient-to-br from-blue-900/10 to-indigo-900/10 border-blue-900/30' : 'bg-gradient-to-br from-indigo-50 to-blue-50/50 border-blue-100'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Star size={16} className="text-[#2F6BFF]" />
                  <h4 className={`text-sm font-black uppercase tracking-wider ${darkMode ? 'text-blue-400' : 'text-blue-900'}`}>Qualification Engine</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Role</label>
                    <select value={editData.qual_role} onChange={e => setEditData(d => ({ ...d, qual_role: e.target.value }))} className={`w-full text-xs border rounded-lg px-2 py-2 outline-none ${darkMode ? 'bg-[#161B27] border-blue-900/40 text-white' : 'bg-white border-blue-200 text-gray-700'}`}>
                      <option value="">— Select —</option><option value="Decision Maker">Decision Maker</option><option value="Manager">Manager</option><option value="Other">Other</option>
                    </select>
                    {editData.qual_role === 'Other' && (
                      <input type="text" value={editData.qual_role_custom} onChange={e => setEditData(d => ({ ...d, qual_role_custom: e.target.value }))} placeholder="Specify Expected Role..." className="w-full mt-2 text-xs border rounded-lg px-2 py-2 outline-none bg-blue-50/20 dark:bg-[#161B27] border-blue-400" />
                    )}
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Industry</label>
                    <select value={editData.qual_industry} onChange={e => setEditData(d => ({ ...d, qual_industry: e.target.value }))} className={`w-full text-xs border rounded-lg px-2 py-2 outline-none ${darkMode ? 'bg-[#161B27] border-blue-900/40 text-white' : 'bg-white border-blue-200 text-gray-700'}`}>
                      <option value="">— Select —</option>
                      <option value="Agriculture">Agriculture</option><option value="Retail">Retail</option>
                      <option value="Tech">Tech</option><option value="Manufacturing">Manufacturing</option>
                      <option value="Logistics">Logistics</option><option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Use Case</label>
                    <select value={editData.qual_use_case} onChange={e => setEditData(d => ({ ...d, qual_use_case: e.target.value }))} className={`w-full text-xs border rounded-lg px-2 py-2 outline-none ${darkMode ? 'bg-[#161B27] border-blue-900/40 text-white' : 'bg-white border-blue-200 text-gray-700'}`}>
                      <option value="">— Select —</option>
                      <option value="Rabi">Rabi</option><option value="Kharif">Kharif</option>
                      <option value="Retail">Retail</option><option value="QR">QR</option>
                      <option value="Cashback">Cashback</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Scale</label>
                    <select value={editData.qual_scale} onChange={e => setEditData(d => ({ ...d, qual_scale: e.target.value }))} className={`w-full text-xs border rounded-lg px-2 py-2 outline-none ${darkMode ? 'bg-[#161B27] border-blue-900/40 text-white' : 'bg-white border-blue-200 text-gray-700'}`}>
                      <option value="">— Select —</option>
                      <option value="<100">&lt;100</option><option value="100–1000">100–1000</option><option value="1000+">1000+</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Timeline</label>
                    <select value={editData.qual_timeline} onChange={e => setEditData(d => ({ ...d, qual_timeline: e.target.value }))} className={`w-full text-xs border rounded-lg px-2 py-2 outline-none ${darkMode ? 'bg-[#161B27] border-blue-900/40 text-white' : 'bg-white border-blue-200 text-gray-700'}`}>
                      <option value="">— Select —</option>
                      <option value="Immediate">Immediate</option><option value="1–2 months">1–2 months</option><option value="Exploring">Exploring</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Prior Experience</label>
                    <select value={editData.qual_experience} onChange={e => setEditData(d => ({ ...d, qual_experience: e.target.value }))} className={`w-full text-xs border rounded-lg px-2 py-2 outline-none ${darkMode ? 'bg-[#161B27] border-blue-900/40 text-white' : 'bg-white border-blue-200 text-gray-700'}`}>
                      <option value="">— Select —</option><option value="Yes">Yes</option><option value="No">No</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Geography / Location</label>
                    <input type="text" value={editData.qual_geography || ''} onChange={e => setEditData(d => ({ ...d, qual_geography: e.target.value }))} placeholder="E.g. Mumbai, MH" className={`w-full text-xs border rounded-lg px-2 py-2 outline-none ${darkMode ? 'bg-[#161B27] border-blue-900/40 text-white focus:border-blue-500' : 'bg-white border-blue-200 text-gray-700 focus:border-blue-500'}`} />
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${darkMode ? 'border-[#2A2F3E] bg-[#161B27]' : 'border-[#E6EBF2] bg-gray-50'} flex items-center justify-end gap-3 shrink-0 rounded-b-2xl`}>
              <button onClick={() => !saving && setEditingId(null)} className={`px-5 py-2 text-sm font-bold transition-colors ${t.subtext} hover:text-red-500`}>
                Cancel
              </button>
              <button onClick={() => handleSave(editingId)} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[#2F6BFF] text-white text-sm font-bold rounded-xl hover:bg-[#1A4FCC] transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50">
                <Save size={16} />{saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
