import React, { useState, useEffect, useCallback, Fragment, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { MOCK_LEADS, STATUS_OPTIONS, PRIORITY_OPTIONS, ASSIGNED_OPTIONS } from '../lib/constants'
import { StatusBadge, PriorityBadge, MetricCard, Toast, ElegantDateTimeInput, formatToLocalDatetime, toISODatetime } from '../components/UI'
import {
  Users, CheckCircle, Star, Clock, Search, RefreshCw,
  Globe, Facebook, Building2, Mail, Phone, Edit2, Save, X, AlertTriangle,
  ChevronLeft, ChevronRight, Calendar, Plus, MessageSquare
} from 'lucide-react'

import { syncGoogleSheets } from '../lib/sheets'
import { DEFAULT_COLUMNS } from '../lib/settings'

export default function LeadsTab({ leads, setLeads, loading, dbReady, onSync, darkMode, newLeadIds = new Set(), settings = {} }) {
  const statusOpts = settings.statusOptions || STATUS_OPTIONS
  const priorityOpts = settings.priorityOptions || PRIORITY_OPTIONS
  
  const assignedOpts = useMemo(() => {
    const baseOpts = settings.assignedOptions || ASSIGNED_OPTIONS
    const fromLeads = (leads || []).map(l => l.assigned_to).filter(Boolean)
    return [...new Set([...baseOpts, ...fromLeads])].sort()
  }, [settings.assignedOptions, leads])

  const colVis = settings.columnVisibility || Object.fromEntries(DEFAULT_COLUMNS.map(c => [c.key, true]))
  const customCols = settings.customColumns || []

  // Dynamic source filter — derived from actual lead data (incl. any custom sources from imports)
  const availableSources = useMemo(() => {
    const fromLeads = [...new Set((leads || []).map(l => l.source).filter(Boolean))]
    const base = ['Website', 'Meta', 'Landing Page 2']
    return [...new Set([...base, ...fromLeads])].sort()
  }, [leads])

  const baseCols = DEFAULT_COLUMNS.filter(c => c.key !== 'actions')
  const actionCol = DEFAULT_COLUMNS.find(c => c.key === 'actions')
  const visibleColumns = [...baseCols, ...customCols, actionCol].filter(c => colVis[c.key] !== false)
  const isColVisible = (key) => visibleColumns.some(c => c.key === key)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [assignedFilter, setAssignedFilter] = useState('All')

  // Date Filtering
  const [dateType, setDateType] = useState('All Time') // All Time, Custom Range, Month/Year
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [expandedRow, setExpandedRow] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // ── Add Lead modal state ──────────────────────────────────────────────────
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({})
  const [adding, setAdding] = useState(false)
  const [successLead, setSuccessLead] = useState(null)  // holds name of last-added lead
  const [addCustomSource, setAddCustomSource] = useState('')  // for custom source entry

  const emptyAddForm = () => ({
    lead_name: '', company: '', email: '', phone: '',
    job_title: '', source: 'Website', message: '',
    status: '', priority: '', assigned_to: '',
    follow_up_at: '', business_type: '', looking_for: '', website: '',
  })

  // Effective source: if user typed custom, use that; otherwise use dropdown value
  const addEffectiveSource = addForm.source === '__custom__'
    ? addCustomSource.trim()
    : addForm.source

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  // ── Add Lead to Supabase + shared state ───────────────────────────────────
  const handleAddLead = async () => {
    if (!addForm.lead_name?.trim()) { showToast('Lead name is required', 'error'); return }
    if (!addEffectiveSource) { showToast('Source is required', 'error'); return }
    setAdding(true)
    const payload = {
      lead_name: addForm.lead_name.trim(),
      company: addForm.company || null,
      email: addForm.email || null,
      phone: addForm.phone || null,
      job_title: addForm.job_title || null,
      source: addEffectiveSource || null,          // custom or selected value
      message: addForm.message || null,
      business_type: addForm.business_type || null,
      looking_for: addForm.looking_for || null,
      website: addForm.website || null,
      status: addForm.status ? addForm.status : null,
      priority: addForm.priority ? addForm.priority : null,
      assigned_to: addForm.assigned_to ? addForm.assigned_to : null,
      follow_up_at: addForm.follow_up_at ? toISODatetime(addForm.follow_up_at) : null,
      date: new Date().toISOString(),
    }
    if (dbReady) {
      const { data, error } = await supabase.from('leads').insert([payload]).select().single()
      if (error) {
        showToast(`Add failed: ${error.message}`, 'error')
        setAdding(false)
        return
      }
      setLeads(prev => [data, ...prev])
      setSuccessLead(data.lead_name)          // show confirmation screen
    } else {
      const newLead = { ...payload, id: Date.now() }
      setLeads(prev => [newLead, ...prev])
      setSuccessLead(newLead.lead_name)
    }
    setAddForm(emptyAddForm())
    setAddCustomSource('')
    setAdding(false)
  }

  // ── Save edits to Cloud Database ─────────────────────────────────────────────────
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
    customCols.forEach(col => {
      corePayload[col.key] = (col.type === 'date' && editData[col.key]) ? toISODatetime(editData[col.key]) : (editData[col.key] || null)
    })
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
      company_name: leadTarget?.company || null,
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
      // Try full payload first (includes follow_up_at)
      let { error } = await supabase.from('leads').update(fullPayload).eq('id', id)

      // If follow_up_at column is missing, retry with core fields only
      if (error && (error.message?.includes('follow_up_at') || error.code === '42703')) {
        console.warn('follow_up_at column missing — run migration SQL. Retrying without it…', error.message)
        const retry = await supabase.from('leads').update(corePayload).eq('id', id)
        error = retry.error
        if (!error) {
          try {
            const qRes = await supabase.from('lead_qualifications').upsert(qualPayload, { onConflict: 'lead_id' }).select().single()
            if (qRes.data) newQual = qRes.data
          } catch(e) {}
          showToast('Saved ✓  (run migration SQL to enable Follow-up field)', 'warning')
          setLeads(prev => prev.map(l => l.id === id ? { ...l, ...corePayload, lead_qualifications: newQual ? [newQual] : l.lead_qualifications } : l))
          setEditingId(null)
          setSaving(false)
          return
        }
      }

      if (error) {
        console.error('Supabase save error:', error)
        showToast(`Save failed: ${error.message || 'check console'}`, 'error')
        setSaving(false)
        return
      }

      // Upsert qualifications
      try {
        const qRes = await supabase.from('lead_qualifications').upsert(qualPayload, { onConflict: 'lead_id' }).select().single()
        if (qRes.data) newQual = qRes.data
      } catch(e) {}

      showToast('Saved to Cloud DB ✓')
    } else {
      showToast('Saved locally (DB not connected yet)', 'error')
      newQual = qualPayload
    }

    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...fullPayload, lead_qualifications: newQual ? [newQual] : l.lead_qualifications } : l))
    setEditingId(null)
    setSaving(false)
  }

  const handleEdit = (lead, e) => {
    e.stopPropagation()
    setEditingId(lead.id)
    
    const qual = lead.lead_qualifications && lead.lead_qualifications[0] ? lead.lead_qualifications[0] : {}
    let role = qual.role || ''
    let customRole = ''
    if (role && !['Decision Maker', 'Manager', 'Other'].includes(role)) {
       customRole = role
       role = 'Other'
    }

    const initEditData = {
      // Core Lead Identity
      message: lead.message || '',
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      
      // Operational CRM Fields
      status: lead.status || '',
      feedback: lead.feedback || '',
      remarks: lead.remarks || '',
      assigned_to: lead.assigned_to || '',
      priority: lead.priority || '',
      business_type: lead.business_type || '',
      looking_for: lead.looking_for || '',
      website: lead.website || '',
      follow_up_at: lead.follow_up_at ? formatToLocalDatetime(lead.follow_up_at) : '',
      
      // Qualifications
      qual_role: role,
      qual_role_custom: customRole,
      qual_industry: qual.industry || '',
      qual_use_case: qual.use_case || '',
      qual_scale: qual.scale || '',
      qual_geography: qual.geography || '',
      qual_timeline: qual.timeline || '',
      qual_experience: qual.experience !== undefined ? (qual.experience ? 'Yes' : 'No') : '',
    }
    customCols.forEach(c => {
      initEditData[c.key] = (c.type === 'date' && lead[c.key]) ? formatToLocalDatetime(lead[c.key]) : (lead[c.key] || '')
    })
    setEditData(initEditData)
    setExpandedRow(lead.id) // auto-expand so feedback/remarks are visible
  }

  const handleSyncButton = async () => {
    setSyncing(true)
    try {
      const result = await onSync()
      showToast(`Synced with Google Sheets ✓ (${result.count} new)`)
    } catch (err) {
      console.error(err)
      showToast('Sync failed', 'error')
    }
    setSyncing(false)
  }


  // ── Filter leads ───────────────────────────────────────────────────────────
  const filtered = leads.filter(l => {
    const q = search.toLowerCase()

    const s1 = (!q || [l.lead_name, l.company, l.email, l.phone].some(v => v?.toLowerCase().includes(q)))
    const s2 = (sourceFilter === 'All' || l.source === sourceFilter)
    const s3 = (statusFilter === 'All' || l.status === statusFilter)
    const s4 = (priorityFilter === 'All' || l.priority === priorityFilter || (priorityFilter === 'Unassigned' && !l.priority))
    const s5 = (assignedFilter === 'All' || l.assigned_to === assignedFilter || (assignedFilter === 'Unassigned' && !l.assigned_to))

    let sDate = true;
    if (l.date && dateType !== 'All Time') {
      const d = new Date(l.date);
      if (dateType === 'Custom Range') {
        if (dateFrom) sDate = sDate && d >= new Date(dateFrom);
        if (dateTo) {
          const toD = new Date(dateTo);
          toD.setHours(23, 59, 59, 999);
          sDate = sDate && d <= toD;
        }
      } else if (dateType === 'Month/Year') {
        if (yearFilter) sDate = sDate && d.getFullYear().toString() === yearFilter;
        if (monthFilter) sDate = sDate && (d.getMonth() + 1).toString().padStart(2, '0') === monthFilter;
      }
    }

    return s1 && s2 && s3 && s4 && s5 && sDate
  }).sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  })

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedLeads = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // If filter changes make current page out of bounds, reset it
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [filtered.length, currentPage, totalPages])

  const stats = {
    total: filtered.length,
    needsAction: filtered.filter(l => !l.status || l.status === 'New').length,
    interested: filtered.filter(l => l.status === 'Interested').length,
    followUp: filtered.filter(l => l.status === 'Follow Up' || !!l.follow_up_at).length,
    converted: filtered.filter(l => l.status === 'Converted').length,
    qualified: filtered.filter(l => l.lead_qualifications && l.lead_qualifications.length > 0).length,
    hot: filtered.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Hot').length,
  }

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Edit Lead Modal ─────────────────────────────────────────────── */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6EBF2] bg-[#F9FBFF] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2F6BFF]/10 flex items-center justify-center">
                  <Edit2 size={20} className="text-[#2F6BFF]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#2F3542]">Edit / Qualify Lead</h3>
                  <p className="text-xs text-[#9AA5B1]">Update CRM details and lead scoring factors simultaneously.</p>
                </div>
              </div>
              <button onClick={() => !saving && setEditingId(null)} className="p-2 rounded-lg text-[#9AA5B1] hover:bg-red-50 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
              {/* Lead Identity & Context */}
              <section className="bg-white border border-[#E6EBF2] rounded-xl p-5 shadow-sm">
                <h4 className="text-xs font-bold text-[#2F3542] uppercase tracking-wider mb-4 border-b border-[#EEF2F7] pb-2">Lead Information</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-[#9AA5B1] uppercase mb-1">Phone Number</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 rounded-lg border border-gray-100">
                      <Phone size={14} className="text-gray-400" />
                      {editData.phone || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#9AA5B1] uppercase mb-1">Email</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 rounded-lg border border-gray-100 overflow-hidden">
                      <Mail size={14} className="text-gray-400 shrink-0" />
                      <span className="truncate">{editData.email || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#9AA5B1] uppercase mb-1">Source</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 rounded-lg border border-gray-100">
                      {editData.source === 'Website' ? <Globe size={14} className="text-blue-500" /> : <Facebook size={14} className="text-purple-500" />}
                      {editData.source || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#9AA5B1] uppercase mb-1 flex justify-between">
                      Company Name <span className="text-[#2F6BFF] normal-case tracking-normal">editable</span>
                    </label>
                    <input type="text" value={editData.company || ''} onChange={e => setEditData(d => ({ ...d, company: e.target.value }))} className="w-full px-3 py-2 text-sm border-2 border-blue-100 hover:border-blue-300 rounded-lg focus:outline-none focus:border-[#2F6BFF] bg-white transition-colors" placeholder="Enter company name..." />
                  </div>
                  <div className="md:col-span-4 mt-2">
                    <label className="block text-[10px] font-bold text-[#9AA5B1] uppercase mb-1">Original Lead Message</label>
                    <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-3.5 flex gap-3 items-start">
                      <MessageSquare size={16} className="text-blue-500 shrink-0 mt-0.5" />
                      <p className={`text-sm leading-relaxed ${editData.message ? 'text-[#2F3542] italic font-medium' : 'text-gray-400 italic'}`}>
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
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Status</label>
                    <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF]">
                      <option value="">— Select —</option>
                      {statusOpts.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Priority</label>
                    <select value={editData.priority} onChange={e => setEditData(d => ({ ...d, priority: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF]">
                      <option value="">— Select —</option>
                      {priorityOpts.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Assigned To</label>
                    <select value={editData.assigned_to} onChange={e => setEditData(d => ({ ...d, assigned_to: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF]">
                      <option value="">— Unassigned —</option>
                      {assignedOpts.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Follow-up Time</label>
                    <ElegantDateTimeInput value={editData.follow_up_at || ''} onChange={e => setEditData(d => ({ ...d, follow_up_at: e.target.value }))} className="w-full" darkMode={darkMode} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Business Type</label>
                    <input type="text" value={editData.business_type || ''} onChange={e => setEditData(d => ({ ...d, business_type: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Looking For</label>
                    <input type="text" value={editData.looking_for || ''} onChange={e => setEditData(d => ({ ...d, looking_for: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF]" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Website</label>
                    <input type="text" value={editData.website} onChange={e => setEditData(d => ({ ...d, website: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF]" />
                  </div>
                </div>
              </section>

              {/* Notes & Feedback */}
              <section>
                <h4 className="text-xs font-bold text-[#20C997] uppercase tracking-wider mb-4 border-b border-emerald-100 pb-2">Notes & Remarks</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Feedback / Updates</label>
                    <textarea value={editData.feedback} onChange={e => setEditData(d => ({ ...d, feedback: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#20C997] resize-none" placeholder="Sales feedback..."></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6B778C] mb-1">Internal Remarks</label>
                    <textarea value={editData.remarks} onChange={e => setEditData(d => ({ ...d, remarks: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#20C997] resize-none" placeholder="Internal context..."></textarea>
                  </div>
                </div>
              </section>

              {/* Qualification Engine */}
              <section className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-5 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-4">
                  <Star size={16} className="text-blue-500" />
                  <h4 className="text-sm font-black text-blue-900 uppercase tracking-wider">Qualification Engine</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">Role</label>
                    <select value={editData.qual_role} onChange={e => setEditData(d => ({ ...d, qual_role: e.target.value }))} className="w-full text-xs border border-blue-200 rounded-lg px-2 py-2 focus:border-blue-500 outline-none bg-white">
                      <option value="">— Select —</option><option value="Decision Maker">Decision Maker</option><option value="Manager">Manager</option><option value="Other">Other</option>
                    </select>
                    {editData.qual_role === 'Other' && (
                      <input type="text" value={editData.qual_role_custom} onChange={e => setEditData(d => ({ ...d, qual_role_custom: e.target.value }))} placeholder="Specify Expected Role..." className="w-full mt-2 text-xs border border-blue-400 rounded-lg px-2 py-2 outline-none bg-blue-50 focus:border-blue-600" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">Industry</label>
                    <select value={editData.qual_industry} onChange={e => setEditData(d => ({ ...d, qual_industry: e.target.value }))} className="w-full text-xs border border-blue-200 rounded-lg px-2 py-2 focus:border-blue-500 outline-none bg-white">
                      <option value="">— Select —</option>
                      <option value="Agriculture">Agriculture</option><option value="Retail">Retail</option>
                      <option value="Tech">Tech</option><option value="Manufacturing">Manufacturing</option>
                      <option value="Logistics">Logistics</option><option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">Use Case</label>
                    <select value={editData.qual_use_case} onChange={e => setEditData(d => ({ ...d, qual_use_case: e.target.value }))} className="w-full text-xs border border-blue-200 rounded-lg px-2 py-2 focus:border-blue-500 outline-none bg-white">
                      <option value="">— Select —</option>
                      <option value="Rabi">Rabi</option><option value="Kharif">Kharif</option>
                      <option value="Retail">Retail</option><option value="QR">QR</option>
                      <option value="Cashback">Cashback</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">Scale</label>
                    <select value={editData.qual_scale} onChange={e => setEditData(d => ({ ...d, qual_scale: e.target.value }))} className="w-full text-xs border border-blue-200 rounded-lg px-2 py-2 focus:border-blue-500 outline-none bg-white">
                      <option value="">— Select —</option>
                      <option value="<100">&lt;100</option><option value="100–1000">100–1000</option><option value="1000+">1000+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">Timeline</label>
                    <select value={editData.qual_timeline} onChange={e => setEditData(d => ({ ...d, qual_timeline: e.target.value }))} className="w-full text-xs border border-blue-200 rounded-lg px-2 py-2 focus:border-blue-500 outline-none bg-white">
                      <option value="">— Select —</option>
                      <option value="Immediate">Immediate</option><option value="1–2 months">1–2 months</option><option value="Exploring">Exploring</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">Prior Experience</label>
                    <select value={editData.qual_experience} onChange={e => setEditData(d => ({ ...d, qual_experience: e.target.value }))} className="w-full text-xs border border-blue-200 rounded-lg px-2 py-2 focus:border-blue-500 outline-none bg-white">
                      <option value="">— Select —</option><option value="Yes">Yes</option><option value="No">No</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-blue-800 mb-1">Geography / Location</label>
                    <input type="text" value={editData.qual_geography} onChange={e => setEditData(d => ({ ...d, qual_geography: e.target.value }))} placeholder="E.g. Mumbai, MH" className="w-full text-xs border border-blue-200 rounded-lg px-2 py-2 focus:border-blue-500 outline-none bg-white" />
                  </div>
                </div>
              </section>

              {/* Custom Columns (if any) */}
              {customCols.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold text-[#F5A623] uppercase tracking-wider mb-4 border-b border-orange-100 pb-2">Custom Fields</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {customCols.map(col => (
                      <div key={col.key}>
                        <label className="block text-xs font-semibold text-[#6B778C] mb-1 capitalize">{col.label}</label>
                        {col.type === 'date' ? (
                          <ElegantDateTimeInput value={editData[col.key] || ''} onChange={e => setEditData(d => ({ ...d, [col.key]: e.target.value }))} className="w-full" darkMode={darkMode} />
                        ) : (
                          <input type={col.type === 'number' ? 'number' : 'text'} value={editData[col.key] || ''} onChange={e => setEditData(d => ({ ...d, [col.key]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-orange-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#E6EBF2] bg-gray-50 flex items-center justify-end gap-3 shrink-0 rounded-b-2xl">
              <button onClick={() => !saving && setEditingId(null)} className="px-5 py-2 text-sm text-[#6B778C] hover:text-[#2F3542] font-bold transition-colors">
                Cancel
              </button>
              <button onClick={() => handleSave(editingId)} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[#2F6BFF] text-white text-sm font-bold rounded-xl hover:bg-[#1A4FCC] transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50">
                <Save size={16} />{saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Lead Modal ─────────────────────────────────────────────── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">

            {/* ──── SUCCESS SCREEN ──── */}
            {successLead ? (
              <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle size={36} className="text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-[#2F3542] mb-1">Lead Added Successfully!</h3>
                <p className="text-sm text-[#9AA5B1] mb-1">
                  <span className="font-semibold text-[#2F3542]">{successLead}</span> has been added to Lead Management.
                </p>
                <p className="text-xs text-[#9AA5B1] mb-6">They will also appear in Follow-ups if a follow-up date was set.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setSuccessLead(null); setAddForm(emptyAddForm()); setAddCustomSource('') }}
                    className="px-5 py-2 text-sm bg-[#2F6BFF] text-white font-bold rounded-lg hover:bg-[#1A4FCC] transition-colors">
                    + Add Another Lead
                  </button>
                  <button
                    onClick={() => { setSuccessLead(null); setAddModalOpen(false); setAddCustomSource('') }}
                    className="px-5 py-2 text-sm bg-[#F4F6F9] text-[#6B778C] font-semibold rounded-lg hover:bg-[#E6EBF2] transition-colors">
                    Done
                  </button>
                </div>
              </div>
            ) : (
            <>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6EBF2]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                  <Plus size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#2F3542]">Add Manual Lead</h3>
                  <p className="text-[11px] text-[#9AA5B1]">Fill in the details below to create a new lead</p>
                </div>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-[#9AA5B1] hover:text-[#2F3542] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              {/* Left col */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Lead Name <span className="text-red-500">*</span></label>
                  <input value={addForm.lead_name || ''} onChange={e => setAddForm(f => ({ ...f, lead_name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Company</label>
                  <input value={addForm.company || ''} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}
                    placeholder="Company name"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Email</label>
                  <input type="email" value={addForm.email || ''} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Phone</label>
                  <input value={addForm.phone || ''} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Job Title</label>
                  <input value={addForm.job_title || ''} onChange={e => setAddForm(f => ({ ...f, job_title: e.target.value }))}
                    placeholder="e.g. CEO, Director"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Business Type</label>
                  <input value={addForm.business_type || ''} onChange={e => setAddForm(f => ({ ...f, business_type: e.target.value }))}
                    placeholder="e.g. Agri input brand"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Looking For</label>
                  <input value={addForm.looking_for || ''} onChange={e => setAddForm(f => ({ ...f, looking_for: e.target.value }))}
                    placeholder="e.g. Lead generation"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400" />
                </div>
              </div>

              {/* Right col */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Source <span className="text-red-500">*</span></label>
                  <select value={addForm.source || 'Website'} onChange={e => setAddForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400">
                    {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__custom__">✏️ Type a custom source…</option>
                  </select>
                  {addForm.source === '__custom__' && (
                    <div className="mt-2">
                      <input
                        value={addCustomSource}
                        onChange={e => setAddCustomSource(e.target.value)}
                        placeholder="e.g. Referral, LinkedIn, Cold Call…"
                        className="w-full px-3 py-2 text-sm border border-green-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/30" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Status</label>
                  <select value={addForm.status || ''} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400">
                    <option value="">— Select —</option>
                    {statusOpts.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Priority</label>
                  <select value={addForm.priority || ''} onChange={e => setAddForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400">
                    <option value="">— Select —</option>
                    {priorityOpts.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Assigned To</label>
                  <select value={addForm.assigned_to || ''} onChange={e => setAddForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400">
                    <option value="">— Unassigned —</option>
                    {assignedOpts.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Website</label>
                  <input value={addForm.website || ''} onChange={e => setAddForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="e.g. https://agrisheild.com"
                    className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B778C] mb-1">Follow-up Date</label>
                  <ElegantDateTimeInput value={addForm.follow_up_at || ''} onChange={e => setAddForm(f => ({ ...f, follow_up_at: e.target.value }))} className="w-full" darkMode={darkMode} />
                </div>
              </div>

              {/* Message full width */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#6B778C] mb-1">Message / Notes</label>
                <textarea value={addForm.message || ''} onChange={e => setAddForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Any notes about this lead..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-green-400 resize-none" />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-[#E6EBF2] flex items-center justify-end gap-3">
              <button onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 text-sm text-[#6B778C] hover:text-[#2F3542] font-semibold transition-colors">
                Cancel
              </button>
              <button onClick={handleAddLead} disabled={adding}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-60 transition-colors">
                <Plus size={14} />{adding ? 'Adding...' : 'Add Lead'}
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* DB warning */}
      {!dbReady && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <AlertTriangle size={17} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-700">Database not connected — showing demo data</p>
            <p className="text-amber-600 text-xs mt-0.5">Run the SQL schema in your database SQL Editor to enable real persistence.</p>
          </div>
        </div>
      )}

      {/* Metrics — reactive to current filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Leads in View" value={stats.total} color="#2F6BFF" />
        <MetricCard icon={Clock} label="Needs Action" value={stats.needsAction} color="#F5A623" />
        <MetricCard icon={Star} label="Qualified" value={stats.qualified} color="#7B3FFF" />
        <MetricCard icon={CheckCircle} label="Follow-ups Scheduled" value={stats.followUp} color="#2ECC71" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-[#E6EBF2] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-44">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA5B1]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, company, or phone..."
              className="w-full pl-8 pr-4 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
            />
          </div>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
            <option value="All">All Sources</option>
            {availableSources.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
            <option value="All">All Status</option>
            {statusOpts.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
            <option value="All">All Priorities</option>
            {priorityOpts.map(p => <option key={p}>{p}</option>)}
            <option value="Unassigned">Unassigned Priority</option>
          </select>
          <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
            <option value="All">All Owners</option>
            {assignedOpts.map(a => <option key={a}>{a}</option>)}
            <option value="Unassigned">Unassigned Owner</option>
          </select>
          <select value={dateType} onChange={e => setDateType(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
            <option value="All Time">All Time Log</option>
            <option value="Custom Range">Date Range</option>
            <option value="Month/Year">Month/Year</option>
          </select>

          {dateType === 'Custom Range' && (
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]" />
              <span className="text-[#9AA5B1] text-sm">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]" />
            </div>
          )}

          {dateType === 'Month/Year' && (
            <div className="flex items-center gap-2">
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
                <option value="">All Months</option>
                <option value="01">January</option><option value="02">February</option><option value="03">March</option>
                <option value="04">April</option><option value="05">May</option><option value="06">June</option>
                <option value="07">July</option><option value="08">August</option><option value="09">September</option>
                <option value="10">October</option><option value="11">November</option><option value="12">December</option>
              </select>
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </div>
          )}

          <button onClick={handleSyncButton}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#2F6BFF] text-white font-bold rounded-lg hover:bg-[#1A4FCC] transition-colors ml-auto">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Sheets'}
          </button>
          <button
            onClick={() => { setAddForm(emptyAddForm()); setAddModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus size={14} /> Add Lead
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#9AA5B1]">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-[#2F6BFF]" />
            <p className="text-sm">Loading leads from database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#EEF2F7]">
                  {visibleColumns.map(c => (
                    <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-[#6B778C] whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map(lead => (
                  <Fragment key={lead.id}>
                    <tr
                      onClick={() => setExpandedRow(expandedRow === lead.id ? null : lead.id)}
                      className={`border-b border-[#EEF2F7] hover:bg-[#F9FBFF] transition-colors cursor-pointer ${newLeadIds.has(lead.id) ? 'lead-live' : ''}`}
                    >
                      {/* Lead Name */}
                      {isColVisible('lead_name') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#E9F2FF] flex items-center justify-center text-[#2F6BFF] font-bold text-xs shrink-0">
                              {(lead.lead_name || '?').charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-[#2F3542] text-xs">{lead.lead_name}</div>
                              <div className="text-[#9AA5B1] text-xs">{lead.job_title || '—'}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      {/* Company */}
                      {isColVisible('company') && (
                        <td className="px-4 py-3">
                          {lead.company ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Building2 size={11} className="text-[#6B778C] dark:text-[#9AA5B1] shrink-0" />
                              <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                                {lead.company}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#C5CDD8] dark:text-[#6B778C] text-xs">—</span>
                          )}
                        </td>
                      )}
                      {/* Contact */}
                      {isColVisible('contact') && (
                        <td className="px-4 py-3">
                          <div className="text-xs space-y-1.5 pl-1">
                            {lead.email && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-md font-medium w-fit border border-blue-100/50 dark:border-blue-500/20 shadow-sm">
                                <Mail size={11} className="shrink-0" />
                                <span>{lead.email}</span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-md font-medium w-fit border border-green-100/50 dark:border-green-500/20 shadow-sm">
                                <Phone size={11} className="shrink-0" />
                                <span>{lead.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      {/* Source */}
                      {isColVisible('source') && (
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${lead.source === 'Website' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {lead.source === 'Website' ? <Globe size={10} /> : <Facebook size={10} />}
                            {lead.source}
                          </span>
                        </td>
                      )}
                      
                      {/* Business Type */}
                      {isColVisible('business_type') && (
                        <td className="px-4 py-3 text-xs w-32 truncate max-w-[8rem]">{lead.business_type || '—'}</td>
                      )}

                      {/* Looking For */}
                      {isColVisible('looking_for') && (
                        <td className="px-4 py-3 text-xs w-32 truncate max-w-[8rem]">{lead.looking_for || '—'}</td>
                      )}

                      {/* Website */}
                      {isColVisible('website') && (
                        <td className="px-4 py-3 text-xs w-32 truncate max-w-[8rem]">{lead.website || '—'}</td>
                      )}
                      
                      {/* Date */}
                      {isColVisible('date') && (
                        <td className="px-4 py-3 text-xs text-[#9AA5B1] whitespace-nowrap">
                          {lead.date ? (() => {
                            const d = new Date(lead.date)
                            return isNaN(d) ? '—' : (
                              <div className="flex flex-col">
                                <span className="font-semibold text-[#2F3542]">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <span className="text-[10px]">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                              </div>
                            )
                          })() : '—'}
                        </td>
                      )}
                      
                      {/* Follow-up */}
                      {isColVisible('follow_up_at') && (
                        <td className="px-4 py-3">
                          {lead.follow_up_at ? (() => {
                            const fu = new Date(lead.follow_up_at)
                            const now = new Date()
                            const isToday = fu.toDateString() === now.toDateString()
                            const isOverdue = fu < now
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${isOverdue ? 'bg-red-50 text-red-600 border border-red-200'
                                : isToday ? 'bg-orange-50 text-orange-600 border border-orange-200'
                                : 'bg-green-50 text-green-600 border border-green-200'
                              }`}>
                                <Calendar size={9} />
                                {fu.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            )
                          })() : <span className="text-[#C5CDD8] text-xs">—</span>}
                        </td>
                      )}
                      
                      {/* Status */}
                      {isColVisible('status') && (
                        <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                      )}
                      
                      {/* Priority */}
                      {isColVisible('priority') && (
                        <td className="px-4 py-3"><PriorityBadge priority={lead.priority} /></td>
                      )}
                      
                      {/* Assigned To */}
                      {isColVisible('assigned_to') && (
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${lead.assigned_to ? 'text-[#2F3542]' : 'text-gray-400 italic'}`}>
                            {lead.assigned_to || '—'}
                          </span>
                        </td>
                      )}
                      
                      {/* Custom Columns */}
                      {customCols.filter(col => isColVisible(col.key)).map(col => (
                        <td key={col.key} className="px-4 py-3 text-xs text-[#2F3542]">
                           <span className="truncate max-w-28 block">
                              {col.type === 'date' && lead[col.key] ? new Date(lead[col.key]).toLocaleDateString() : (lead[col.key] || '—')}
                           </span>
                        </td>
                      ))}

                      {/* Actions */}
                      {isColVisible('actions') && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <button onClick={e => handleEdit(lead, e)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#E9F2FF] text-[#2F6BFF] text-xs font-bold rounded-lg hover:bg-[#2F6BFF] hover:text-white transition-colors">
                            <Edit2 size={11} />Edit
                          </button>
                        </td>
                      )}
                    </tr>

                    {/* Expanded row — strictly View Only for Expanded Info! */}
                    {expandedRow === lead.id && (
                      <tr key={`exp-${lead.id}`} className="bg-[#F9FBFF] border-b border-[#EEF2F7]">
                        <td colSpan={visibleColumns.length} className="px-6 py-4">
                          <div className="grid grid-cols-4 gap-5">
                            <div>
                              <p className="text-xs font-bold text-[#9AA5B1] uppercase tracking-wide mb-1.5">Message</p>
                              <p className="text-sm text-[#2F3542] leading-relaxed">{lead.message || <span className="text-gray-400 italic">No message</span>}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#9AA5B1] uppercase tracking-wide mb-1.5">Feedback</p>
                              <p className="text-sm text-[#2F3542]">{lead.feedback || <span className="text-gray-400 italic">—</span>}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#9AA5B1] uppercase tracking-wide mb-1.5">Remarks</p>
                              <p className="text-sm text-[#2F3542]">{lead.remarks || <span className="text-gray-400 italic">—</span>}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#9AA5B1] uppercase tracking-wide mb-1.5">Follow-up Scheduled</p>
                              {lead.follow_up_at
                                ? <p className="text-sm font-semibold text-[#2F3542]">
                                  {new Date(lead.follow_up_at).toLocaleString('en-IN', {
                                    weekday: 'short', year: 'numeric', month: 'short',
                                    day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                                  })}
                                </p>
                                : <p className="text-sm text-gray-400 italic">Not scheduled</p>
                              }
                            </div>
                            
                            {/* Qualification / Scoring Module inside Expanded Row */}
                            <div className="col-span-4 mt-2 pt-5 border-t border-[#EEF2F7]">
                              <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 rounded-md bg-[#2F6BFF]/10">
                                  <Star size={14} className="text-[#2F6BFF]" />
                                </div>
                                <h4 className="text-sm font-bold text-[#2F3542]">Lead Qualification Profile</h4>
                              </div>
                              
                              {lead.lead_qualifications && lead.lead_qualifications.length > 0 ? (
                                (() => {
                                  const qual = lead.lead_qualifications[0]
                                  return (
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-[#EEF2F7] relative overflow-hidden shadow-sm">
                                      <div className={`absolute right-0 top-0 bottom-0 w-1 flex flex-col ${
                                        qual.category === 'Hot' ? 'bg-red-500' : qual.category === 'Warm' ? 'bg-orange-500' : 'bg-blue-500'
                                      }`} />
                                      <div><p className="text-[10px] text-[#9AA5B1] uppercase">Category</p><p className={`font-black text-sm ${qual.category === 'Hot' ? 'text-red-500' : qual.category === 'Warm' ? 'text-orange-500' : 'text-blue-500'}`}>{qual.category} ({qual.score} Pt)</p></div>
                                      <div><p className="text-[10px] text-[#9AA5B1] uppercase">Role</p><p className="font-semibold text-xs text-[#2F3542]">{qual.role || '—'}</p></div>
                                      <div><p className="text-[10px] text-[#9AA5B1] uppercase">Industry</p><p className="font-semibold text-xs text-[#2F3542]">{qual.industry || '—'}</p></div>
                                      <div><p className="text-[10px] text-[#9AA5B1] uppercase">Use Case</p><p className="font-semibold text-xs text-[#2F3542]">{qual.use_case || '—'}</p></div>
                                      <div><p className="text-[10px] text-[#9AA5B1] uppercase">Scale & Timeline</p><p className="font-semibold text-xs text-[#2F3542]">{qual.scale || '—'} / {qual.timeline || '—'}</p></div>
                                      <div className="col-span-5 pt-2 mt-1 border-t border-dashed border-[#EEF2F7]">
                                         <span className="text-[10px] text-[#9AA5B1] mr-2 uppercase">Action Plan:</span>
                                         <span className="text-xs font-bold text-[#2F3542]">{qual.action_plan}</span>
                                      </div>
                                    </div>
                                  )
                                })()
                              ) : (
                                <div className="bg-[#F9FBFF] border border-dashed border-[#C5CDD8] rounded-xl p-4 flex items-center justify-between text-left">
                                  <div>
                                    <p className="text-sm font-semibold text-[#2F3542]">No qualification profile yet.</p>
                                    <p className="text-xs text-[#6B778C] mt-0.5">Click the 'Edit' button on this lead to assess and score them.</p>
                                  </div>
                                  <button onClick={(e) => handleEdit(lead, e)} className="px-4 py-1.5 text-xs font-bold bg-white text-[#2F6BFF] border border-[#2F6BFF]/30 rounded-lg hover:bg-[#E9F2FF] transition-colors shadow-sm">
                                    Assess Lead
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-12 text-center text-[#9AA5B1]">
                <Users size={30} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No leads match your filters</p>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 border-t border-[#EEF2F7] flex items-center justify-between text-xs text-[#9AA5B1]">
          <span>
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filtered.length)}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} leads
            {filtered.length !== leads.length && ` (filtered from ${leads.length})`}
            {' · '}{dbReady ? '🟢 Connected' : '🟠 Demo mode'}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-[#F4F6F9] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page;
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (currentPage <= 4) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-6 h-6 rounded text-xs font-semibold transition-colors ${currentPage === page ? 'bg-[#2F6BFF] text-white' : 'hover:bg-[#F4F6F9] text-[#6B778C]'}`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-[#F4F6F9] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div >
  )
}
