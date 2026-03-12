import React, { useState, useEffect, useCallback, Fragment, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { MOCK_LEADS, STATUS_OPTIONS, PRIORITY_OPTIONS, ASSIGNED_OPTIONS } from '../lib/constants'
import { StatusBadge, PriorityBadge, MetricCard, Toast, ElegantDateTimeInput, formatToLocalDatetime, toISODatetime } from '../components/UI'
import {
  Users, CheckCircle, Star, Clock, Search, RefreshCw,
  Globe, Facebook, Building2, Mail, Phone, Edit2, Save, X, AlertTriangle,
  ChevronLeft, ChevronRight, Calendar, Plus
} from 'lucide-react'

import { syncGoogleSheets } from '../lib/sheets'
import { DEFAULT_COLUMNS } from '../lib/settings'

export default function LeadsTab({ leads, setLeads, loading, dbReady, onSync, darkMode, newLeadIds = new Set(), settings = {} }) {
  const statusOpts = settings.statusOptions || STATUS_OPTIONS
  const priorityOpts = settings.priorityOptions || PRIORITY_OPTIONS
  const assignedOpts = settings.assignedOptions || ASSIGNED_OPTIONS
  const colVis = settings.columnVisibility || Object.fromEntries(DEFAULT_COLUMNS.map(c => [c.key, true]))
  const customCols = settings.customColumns || []

  // Dynamic source filter — derived from actual lead data (incl. any custom sources from imports)
  const availableSources = useMemo(() => {
    const fromLeads = [...new Set((leads || []).map(l => l.source).filter(Boolean))]
    const base = ['Website', 'Meta']
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
    follow_up_at: '',
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
    const corePayload = {
      status: editData.status ? editData.status : null,
      feedback: editData.feedback || null,
      remarks: editData.remarks || null,
      assigned_to: editData.assigned_to ? editData.assigned_to : null,
      priority: editData.priority ? editData.priority : null,
    }
    customCols.forEach(col => {
      corePayload[col.key] = (col.type === 'date' && editData[col.key]) ? toISODatetime(editData[col.key]) : (editData[col.key] || null)
    })
    const fullPayload = {
      ...corePayload,
      follow_up_at: editData.follow_up_at ? toISODatetime(editData.follow_up_at) : null,
    }

    if (dbReady) {
      // Try full payload first (includes follow_up_at)
      let { error } = await supabase.from('leads').update(fullPayload).eq('id', id)

      // If follow_up_at column is missing, retry with core fields only
      if (error && (error.message?.includes('follow_up_at') || error.code === '42703')) {
        console.warn('follow_up_at column missing — run migration SQL. Retrying without it…', error.message)
        const retry = await supabase.from('leads').update(corePayload).eq('id', id)
        error = retry.error
        if (!error) {
          showToast('Saved ✓  (run migration SQL to enable Follow-up field)', 'warning')
          setLeads(prev => prev.map(l => l.id === id ? { ...l, ...corePayload } : l))
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
      showToast('Saved to Cloud DB ✓')
    } else {
      showToast('Saved locally (DB not connected yet)', 'error')
    }

    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...fullPayload } : l))
    setEditingId(null)
    setSaving(false)
  }

  const handleEdit = (lead, e) => {
    e.stopPropagation()
    setEditingId(lead.id)
    const initEditData = {
      status: lead.status || '',
      feedback: lead.feedback || '',
      remarks: lead.remarks || '',
      assigned_to: lead.assigned_to || '',
      priority: lead.priority || '',
      follow_up_at: lead.follow_up_at ? formatToLocalDatetime(lead.follow_up_at) : '',
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
  })

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedLeads = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // If filter changes make current page out of bounds, reset it
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [filtered.length, currentPage, totalPages])

  const stats = {
    total: leads.length,
    needsAction: leads.filter(l => !l.status).length,
    hot: leads.filter(l => l.status === 'Interested' || l.status === 'Follow Up').length,
    converted: leads.filter(l => l.status === 'Converted').length,
  }

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

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

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Total Leads" value={stats.total} trend={1} trendVal={12} color="#2F6BFF" />
        <MetricCard icon={Clock} label="Needs Action" value={stats.needsAction} color="#F5A623" />
        <MetricCard icon={Star} label="Hot Leads" value={stats.hot} trend={1} trendVal={5} color="#7B3FFF" />
        <MetricCard icon={CheckCircle} label="Converted" value={stats.converted} trend={1} trendVal={3} color="#2ECC71" />
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
                          <div className="flex items-center gap-1.5 text-xs text-[#6B778C]">
                            <Building2 size={11} /><span className="max-w-28 truncate">{lead.company}</span>
                          </div>
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
                      {/* Date */}
                      {isColVisible('date') && (
                        <td className="px-4 py-3 text-xs text-[#9AA5B1] whitespace-nowrap">
                          {lead.date ? new Date(lead.date).toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true
                          }) : '—'}
                        </td>
                      )}
                      {/* Follow-up */}
                      {isColVisible('follow_up_at') && (
                        <td className="px-4 py-3" onClick={e => editingId === lead.id && e.stopPropagation()}>
                          {editingId === lead.id
                            ? <ElegantDateTimeInput
                              value={editData.follow_up_at}
                              onChange={e => setEditData(d => ({ ...d, follow_up_at: e.target.value }))}
                              className="w-44"
                              darkMode={darkMode}
                            />
                            : lead.follow_up_at ? (() => {
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
                            })()
                              : <span className="text-[#C5CDD8] text-xs">—</span>
                          }
                        </td>
                      )}
                      {/* Status */}
                      {isColVisible('status') && (
                        <td className="px-4 py-3" onClick={e => editingId === lead.id && e.stopPropagation()}>
                          {editingId === lead.id
                            ? <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}
                              className="text-xs border border-[#E6EBF2] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2F6BFF] w-32">
                              <option value="">— Select —</option>
                              {statusOpts.map(s => <option key={s}>{s}</option>)}
                            </select>
                            : <StatusBadge status={lead.status} />
                          }
                        </td>
                      )}
                      {/* Priority */}
                      {isColVisible('priority') && (
                        <td className="px-4 py-3" onClick={e => editingId === lead.id && e.stopPropagation()}>
                          {editingId === lead.id
                            ? <select value={editData.priority} onChange={e => setEditData(d => ({ ...d, priority: e.target.value }))}
                              className="text-xs border border-[#E6EBF2] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2F6BFF] w-28">
                              <option value="">— Select —</option>
                              {priorityOpts.map(p => <option key={p}>{p}</option>)}
                            </select>
                            : <PriorityBadge priority={lead.priority} />
                          }
                        </td>
                      )}
                      {/* Assigned To */}
                      {isColVisible('assigned_to') && (
                        <td className="px-4 py-3" onClick={e => editingId === lead.id && e.stopPropagation()}>
                          {editingId === lead.id
                            ? <select value={editData.assigned_to} onChange={e => setEditData(d => ({ ...d, assigned_to: e.target.value }))}
                              className="text-xs border border-[#E6EBF2] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2F6BFF] w-24">
                              <option value="">— Select —</option>
                              {assignedOpts.map(a => <option key={a}>{a}</option>)}
                            </select>
                            : <span className={`text-xs font-medium ${lead.assigned_to ? 'text-[#2F3542]' : 'text-gray-400 italic'}`}>
                              {lead.assigned_to || '—'}
                            </span>
                          }
                        </td>
                      )}

                      {/* Custom Columns */}
                      {customCols.filter(col => isColVisible(col.key)).map(col => (
                        <td key={col.key} className="px-4 py-3 text-xs text-[#2F3542]" onClick={e => editingId === lead.id && e.stopPropagation()}>
                          {editingId === lead.id ? (
                            col.type === 'date' ? (
                              <ElegantDateTimeInput
                                value={editData[col.key] || ''}
                                onChange={e => setEditData(d => ({ ...d, [col.key]: e.target.value }))}
                                className="w-40"
                                darkMode={darkMode}
                              />
                            ) : (
                              <input
                                type={col.type === 'number' ? 'number' : 'text'}
                                value={editData[col.key] || ''}
                                onChange={e => setEditData(d => ({ ...d, [col.key]: e.target.value }))}
                                className="w-24 text-xs border border-[#E6EBF2] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2F6BFF]"
                              />
                            )
                          ) : (
                            <span className="truncate max-w-28 block">
                              {col.type === 'date' && lead[col.key] ? new Date(lead[col.key]).toLocaleDateString() : (lead[col.key] || '—')}
                            </span>
                          )}
                        </td>
                      ))}

                      {/* Actions */}
                      {isColVisible('actions') && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {editingId === lead.id
                            ? <div className="flex gap-1.5">
                              <button onClick={() => handleSave(lead.id)} disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-60">
                                <Save size={11} />{saving ? '...' : 'Save'}
                              </button>
                              <button onClick={e => { e.stopPropagation(); setEditingId(null) }}
                                className="px-2 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-lg hover:bg-gray-200">
                                <X size={11} />
                              </button>
                            </div>
                            : <button onClick={e => handleEdit(lead, e)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#E9F2FF] text-[#2F6BFF] text-xs font-bold rounded-lg hover:bg-[#2F6BFF] hover:text-white transition-colors">
                              <Edit2 size={11} />Edit
                            </button>
                          }
                        </td>
                      )}
                    </tr>

                    {/* Expanded row — message, feedback, remarks, follow-up */}
                    {expandedRow === lead.id && (
                      <tr key={`exp-${lead.id}`} className="bg-[#F9FBFF] border-b border-[#EEF2F7]">
                        <td colSpan={visibleColumns.length} className="px-6 py-4">
                          <div className="grid grid-cols-4 gap-5">
                            <div>
                              <p className="text-xs font-bold text-[#9AA5B1] uppercase tracking-wide mb-1.5">Message</p>
                              <p className="text-sm text-[#2F3542] leading-relaxed">{lead.message || <span className="text-gray-400 italic">No message</span>}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#9AA5B1] uppercase tracking-wide mb-1.5">
                                Feedback {editingId === lead.id && <span className="text-[#2F6BFF] normal-case ml-1 text-[10px]">✎ editing</span>}
                              </p>
                              {editingId === lead.id
                                ? <textarea value={editData.feedback} onChange={e => setEditData(d => ({ ...d, feedback: e.target.value }))}
                                  placeholder="Add feedback..."
                                  rows={2}
                                  className="w-full text-sm border-2 border-[#2F6BFF] rounded-lg px-2.5 py-1.5 focus:outline-none bg-white" />
                                : <p className="text-sm text-[#2F3542]">{lead.feedback || <span className="text-gray-400 italic">—</span>}</p>
                              }
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#9AA5B1] uppercase tracking-wide mb-1.5">
                                Remarks {editingId === lead.id && <span className="text-[#2F6BFF] normal-case ml-1 text-[10px]">✎ editing</span>}
                              </p>
                              {editingId === lead.id
                                ? <textarea value={editData.remarks} onChange={e => setEditData(d => ({ ...d, remarks: e.target.value }))}
                                  placeholder="Add remarks..."
                                  rows={2}
                                  className="w-full text-sm border-2 border-[#2F6BFF] rounded-lg px-2.5 py-1.5 focus:outline-none bg-white" />
                                : <p className="text-sm text-[#2F3542]">{lead.remarks || <span className="text-gray-400 italic">—</span>}</p>
                              }
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
