import { useState, useMemo } from 'react'
import { Search, Filter, ClipboardList, TrendingUp, Edit2, Save, X, Mail, Phone, Globe, Facebook, MessageSquare, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS_OPTIONS, PRIORITY_OPTIONS, ASSIGNED_OPTIONS } from '../lib/constants'
import { Toast, ElegantDateTimeInput, formatToLocalDatetime, toISODatetime } from '../components/UI'


const INDUSTRIES = ['All', 'Agriculture', 'Retail', 'Tech', 'Manufacturing', 'Logistics', 'Other']

export default function LeadQualificationTab({ leads, setLeads, dbReady, darkMode, onAddNotification }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOwner, setFilterOwner] = useState('All')
  const [filterIndustry, setFilterIndustry] = useState('All')

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
          tab: 'qualification'
        })
      }
    }

    if (setLeads) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...fullPayload, lead_qualifications: newQual ? [newQual] : l.lead_qualifications } : l))
    }
    setEditingId(null)
    setSaving(false)
  }
  
  // Dynamic Team Members
  const TEAM_MEMBERS = useMemo(() => {
    const list = (leads || []).map(l => l.assigned_to).filter(Boolean)
    return ['Unassigned', ...new Set(list)].sort()
  }, [leads])

  const t = darkMode ? {
    bg: 'bg-[#161B27]',
    card: 'bg-[#1A2035] border-[#2A2F3E]',
    text: 'text-[#E2E8F0]',
    subtext: 'text-[#8892A4]',
    border: 'border-[#2A2F3E]',
    input: 'bg-[#161B27] border-[#2A2F3E] text-[#E2E8F0] focus:border-[#2F6BFF]',
    th: 'bg-[#1A2035] text-[#8892A4]',
    trHover: 'hover:bg-[#1A2035]',
  } : {
    bg: 'bg-white',
    card: 'bg-white border-[#E6EBF2]',
    text: 'text-[#2F3542]',
    subtext: 'text-[#6B778C]',
    border: 'border-[#E6EBF2]',
    input: 'bg-white border-[#E6EBF2] text-[#2F3542] focus:border-[#2F6BFF]',
    th: 'bg-[#F4F6F9] text-[#6B778C]',
    trHover: 'hover:bg-[#F9FAFC]',
  }

  const qualifiedLeads = useMemo(() => {
    return leads.filter(l => {
      if (!l.lead_qualifications || l.lead_qualifications.length === 0) return false
      
      const qual = l.lead_qualifications[0]
      if (!qual) return false

      if (filterOwner !== 'All' && (l.assigned_to || 'Unassigned') !== filterOwner) return false
      if (filterIndustry !== 'All' && qual.industry !== filterIndustry) return false
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        if (![l.lead_name, l.company, qual.company_name].some(v => v?.toLowerCase().includes(term))) return false
      }
      return true
    }).sort((a,b) => (b.lead_qualifications[0]?.score || 0) - (a.lead_qualifications[0]?.score || 0))
  }, [leads, filterOwner, filterIndustry, searchTerm])

  return (
    <>
      <div className="flex flex-col overflow-hidden space-y-5 max-w-7xl mx-auto" style={{ height: 'calc(100vh - 112px)' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className={`text-xl font-bold ${t.text}`}>Qualified Lead Data</h2>
          <p className={`text-sm ${t.subtext}`}>High-level overview of scored leads and attributes, ranked by potential.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subtext}`} size={16} />
            <input
              type="text"
              placeholder="Search qualified..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`pl-9 pr-4 py-2 text-sm rounded-lg border ${t.input} outline-none w-48`}
            />
          </div>
          <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className={`text-sm px-3 py-2 rounded-lg border ${t.input}`}>
            <option value="All">All Owners</option>
            {TEAM_MEMBERS.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} className={`text-sm px-3 py-2 rounded-lg border ${t.input}`}>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i === 'All' ? 'All Industries' : i}</option>)}
          </select>
        </div>
      </div>

      <div className={`rounded-xl border ${t.border} overflow-hidden ${t.card} flex-1 flex flex-col min-h-0`}>
        <div className="overflow-auto flex-1 min-h-0 relative">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className={`text-[10px] uppercase font-bold tracking-wider ${t.th} border-b ${t.border} sticky top-0 z-10 shadow-sm`}>
              <tr>
                <th className={`px-5 py-4 ${darkMode ? 'bg-[#1A2035]' : 'bg-[#F4F6F9]'}`}>Ranking</th>
                <th className={`px-5 py-4 ${darkMode ? 'bg-[#1A2035]' : 'bg-[#F4F6F9]'}`}>Lead Profile</th>
                <th className={`px-5 py-4 ${darkMode ? 'bg-[#1A2035]' : 'bg-[#F4F6F9]'}`}>Qualification Data</th>
                <th className={`px-5 py-4 ${darkMode ? 'bg-[#1A2035]' : 'bg-[#F4F6F9]'}`}>Timeline / Scale</th>
                <th className={`px-5 py-4 ${darkMode ? 'bg-[#1A2035]' : 'bg-[#F4F6F9]'}`}>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {qualifiedLeads.map((lead, idx) => {
                const qual = lead.lead_qualifications[0]
                return (
                  <tr 
                    key={lead.id} 
                    onClick={() => handleEdit(lead)}
                    className={`border-b border-dashed ${t.border} ${t.trHover} transition-colors cursor-pointer`}
                  >
                    <td className="px-5 py-3 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black
                          ${qual.category === 'Hot' 
                            ? (darkMode ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]' : 'bg-red-50 text-red-600 border border-red-200') 
                            : qual.category === 'Warm' 
                            ? (darkMode ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.1)]' : 'bg-orange-50 text-orange-600 border border-orange-200') 
                            : (darkMode ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.1)]' : 'bg-blue-50 text-blue-600 border border-blue-200')}`}>
                          #{(idx+1).toString().padStart(2, '0')} · {qual.category}
                        </span>
                        <span className={`text-[11px] font-bold ${qual.category === 'Hot' ? 'text-red-500' : qual.category === 'Warm' ? 'text-orange-500' : 'text-blue-500'}`}>{qual.score} Points</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className={`font-bold ${t.text}`}>{lead.lead_name}</div>
                      <div className={`text-[11px] font-semibold text-[#2F6BFF] uppercase mt-0.5`}>{qual.company_name || lead.company || '—'}</div>
                      <div className={`text-[11px] ${t.subtext} mt-1`}>{lead.source}</div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="grid grid-cols-1 gap-1.5 text-xs">
                        <div><span className={`opacity-60 text-[10px] uppercase font-bold pr-2`}>Role:</span> <span className={`font-semibold ${t.text}`}>{qual.role || '—'}</span></div>
                        <div><span className={`opacity-60 text-[10px] uppercase font-bold pr-2`}>Ind:</span> <span className={`font-semibold ${t.text}`}>{qual.industry || '—'}</span></div>
                        <div><span className={`opacity-60 text-[10px] uppercase font-bold pr-2`}>Use:</span> <span className={`font-semibold ${t.text}`}>{qual.use_case || '—'}</span></div>
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="grid grid-cols-1 gap-1.5 text-xs">
                        <div><span className={`opacity-60 text-[10px] uppercase font-bold pr-2`}>Timeline:</span> <span className={`font-semibold ${t.text}`}>{qual.timeline || '—'}</span></div>
                        <div><span className={`opacity-60 text-[10px] uppercase font-bold pr-2`}>Scale:</span> <span className={`font-semibold ${t.text}`}>{qual.scale || '—'}</span></div>
                        <div><span className={`opacity-60 text-[10px] uppercase font-bold pr-2`}>Prior Exp:</span> <span className={`font-semibold ${qual.experience ? 'text-green-600' : t.text}`}>{qual.experience ? 'Yes' : 'No'}</span></div>
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className={`font-semibold ${t.text} text-xs`}>{lead.assigned_to || 'Unassigned'}</div>
                      <div className={`text-[10px] font-bold ${t.subtext} mt-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded inline-block`}>{qual.action_plan}</div>
                    </td>
                  </tr>
                )
              })}
              {qualifiedLeads.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-6 py-12 text-center ${t.subtext}`}>
                    No qualified leads match your filters. Assess leads from the Lead Management tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
