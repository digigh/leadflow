import { useState, useRef, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { Toast } from '../components/UI'
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, AlertTriangle,
  ChevronDown, RefreshCw, Info, Download, Search, SkipForward, Copy, CheckCircle
} from 'lucide-react'

// ── DB field definitions ──────────────────────────────────────────────────────
const DB_FIELDS = [
  { key: 'lead_name', label: 'Lead Name', required: true },
  { key: 'company', label: 'Company', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'job_title', label: 'Job Title', required: false },
  { key: 'message', label: 'Message / Notes', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'assigned_to', label: 'Assigned To', required: false },
  { key: 'follow_up_at', label: 'Follow-up Date', required: false },
  { key: '__skip__', label: '— Skip this column —', required: false },
]

// Fuzzy auto-mapper
const ALIASES = {
  lead_name: ['name', 'lead name', 'full name', 'lead_name', 'contact name', 'customer name', 'client name', 'prospect'],
  company: ['company', 'company name', 'organization', 'org', 'business', 'firm', 'employer', 'account'],
  email: ['email', 'email address', 'e-mail', 'mail', 'email id', 'e mail'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'tel', 'telephone', 'cell', 'whatsapp', 'ph no'],
  job_title: ['job title', 'title', 'designation', 'position', 'role', 'job role', 'profile'],
  message: ['message', 'notes', 'note', 'comment', 'remarks', 'description', 'query', 'requirement', 'interest'],
  status: ['status', 'lead status', 'stage', 'deal stage'],
  priority: ['priority', 'lead priority', 'urgency', 'importance'],
  assigned_to: ['assigned to', 'assigned', 'owner', 'sales rep', 'agent', 'salesperson', 'representative', 'team member', 'handled by'],
  follow_up_at: ['follow up', 'follow-up', 'follow up date', 'followup', 'follow_up_at', 'next follow up', 'callback', 'callback date', 'next call'],
}

function guessMapping(colHeader) {
  const h = colHeader.toLowerCase().trim()
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.some(a => h.includes(a) || a.includes(h))) return field
  }
  return '__skip__'
}

// Parse date strings leniently
function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0).toISOString()
  }
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

const VALID_STATUSES = ['New', 'Contacted', 'Interested', 'Follow Up', 'Converted', 'Not Interested']
const VALID_PRIORITIES = ['High', 'Medium', 'Low']

function mapRow(row, mapping, source) {
  const lead = { source }
  for (const [colKey, dbField] of Object.entries(mapping)) {
    if (dbField === '__skip__') continue
    const val = row[colKey]?.toString().trim() || null
    if (dbField === 'follow_up_at') { lead[dbField] = parseDate(val) }
    else if (dbField === 'status') { lead[dbField] = VALID_STATUSES.includes(val) ? val : null }
    else if (dbField === 'priority') { lead[dbField] = VALID_PRIORITIES.includes(val) ? val : null }
    else { lead[dbField] = val }
  }
  lead.date = new Date().toISOString()
  return lead
}

// Steps
const STEPS = ['Upload File', 'Set Source', 'Map Columns', 'Handle Duplicates', 'Preview & Import']

// ── Component ──────────────────────────────────────────────────────────────────
export default function ImportTab({ leads = [], setLeads, dbReady = false, darkMode = false, settings = {} }) {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [rawRows, setRawRows] = useState([])       // parsed rows from file
  const [headers, setHeaders] = useState([])        // column headers from file
  const [source, setSource] = useState('')
  const [customSource, setCustomSource] = useState('')
  const [mapping, setMapping] = useState({})        // { colHeader: dbField }
  const [duplicateMap, setDuplicateMap] = useState({}) // { rowIndex: 'skip'|'overwrite'|'add_new' }
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)        // { inserted, updated, skipped }
  const [toast, setToast] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const showToast = (msg, type = 'success') => setToast({ msg, type })
  const assignedOpts = settings.assignedOptions || []
  const knownSources = useMemo(() => {
    const fromLeads = [...new Set(leads.map(l => l.source).filter(Boolean))]
    const base = ['Website', 'Meta', 'Landing Page 2']
    return [...new Set([...base, ...fromLeads])]
  }, [leads])

  const effectiveSource = source === '__custom__' ? customSource.trim() : source

  // ── File parsing ─────────────────────────────────────────────────────────────
  const parseFile = useCallback((f) => {
    if (!f) return
    const name = f.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      showToast('Only .csv, .xlsx, .xls files are supported', 'error'); return
    }
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (json.length === 0) { showToast('File appears to be empty', 'error'); return }
        const hdrs = Object.keys(json[0])
        const autoMap = {}
        hdrs.forEach(h => { autoMap[h] = guessMapping(h) })
        setHeaders(hdrs)
        setRawRows(json)
        setMapping(autoMap)
        setStep(1)
      } catch (err) {
        showToast('Failed to parse file: ' + err.message, 'error')
      }
    }
    reader.readAsArrayBuffer(f)
  }, [])

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────
  const { mappedRows, duplicates } = useMemo(() => {
    if (step < 3) return { mappedRows: [], duplicates: [] }
    const src = effectiveSource || 'Unknown'
    const rows = rawRows.map(r => mapRow(r, mapping, src)).filter(r => r.lead_name)
    const dups = []
    const dm = {}
    rows.forEach((row, i) => {
      const existing = leads.find(l =>
        (row.email && l.email && row.email.toLowerCase() === l.email.toLowerCase()) ||
        (row.phone && l.phone && row.phone.replace(/\D/g, '') === l.phone.replace(/\D/g, ''))
      )
      if (existing) { dups.push({ rowIndex: i, row, existing }); dm[i] = 'overwrite' }
    })
    return { mappedRows: rows, duplicates: dups }
  }, [step, rawRows, mapping, effectiveSource, leads])

  // ── Import ───────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!effectiveSource) { showToast('Source is required', 'error'); return }
    setImporting(true); setProgress(0)
    const toInsert = [], toUpdate = []
    mappedRows.forEach((row, i) => {
      const dup = duplicates.find(d => d.rowIndex === i)
      if (dup) {
        const choice = duplicateMap[i] ?? 'overwrite'
        if (choice === 'skip') return
        if (choice === 'overwrite') toUpdate.push({ ...row, id: dup.existing.id })
        else toInsert.push(row)   // add_new
      } else {
        toInsert.push(row)
      }
    })

    let inserted = 0, updated = 0, skipped = mappedRows.length - toInsert.length - toUpdate.length

    try {
      // Insert in batches of 100
      const BATCH = 100
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH)
        if (dbReady) {
          const { data, error } = await supabase.from('leads').insert(batch).select()
          if (error) throw error
          setLeads(prev => [...(data || []), ...prev])
          inserted += data?.length || 0
        } else {
          const fakes = batch.map((r, j) => ({ ...r, id: Date.now() + j }))
          setLeads(prev => [...fakes, ...prev])
          inserted += fakes.length
        }
        setProgress(Math.round(((i + batch.length) / (toInsert.length + toUpdate.length)) * 90))
      }

      // Updates
      for (let i = 0; i < toUpdate.length; i++) {
        const { id, ...payload } = toUpdate[i]
        if (dbReady) {
          const { error } = await supabase.from('leads').update(payload).eq('id', id)
          if (!error) {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, ...payload } : l))
            updated++
          }
        } else { updated++ }
        setProgress(Math.round(((toInsert.length + i + 1) / (toInsert.length + toUpdate.length)) * 100))
      }

      setProgress(100)
      setResult({ inserted, updated, skipped })
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error')
    }
    setImporting(false)
  }

  const resetAll = () => {
    setStep(0); setFile(null); setRawRows([]); setHeaders([])
    setSource(''); setCustomSource(''); setMapping({})
    setDuplicateMap({}); setResult(null); setProgress(0)
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  const t = darkMode ? {
    card: 'bg-[#1A2035] border-[#2A2F3E]',
    text: 'text-[#E2E8F0]', subtext: 'text-[#8892A4]',
    input: 'bg-[#1E2436] border-[#2A2F3E] text-[#E2E8F0]',
    th: 'bg-[#1E2436] text-[#8892A4]', divider: 'border-[#2A2F3E]',
    row: 'hover:bg-[#1E2540]', tag: 'bg-[#2A2F3E] text-[#9AA5B1]',
  } : {
    card: 'bg-white border-[#E6EBF2]',
    text: 'text-[#2F3542]', subtext: 'text-[#9AA5B1]',
    input: 'bg-white border-[#E6EBF2] text-[#2F3542]',
    th: 'bg-[#F8FAFC] text-[#6B778C]', divider: 'border-[#EEF2F7]',
    row: 'hover:bg-[#F9FBFF]', tag: 'bg-[#F4F6F9] text-[#6B778C]',
  }
  const selCls = `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-[#2F6BFF] ${t.input}`
  const inCls = `px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-[#2F6BFF] ${t.input}`

  // ── Preview rows (first 5) ──────────────────────────────────────────────────
  const previewRows = mappedRows.slice(0, 5)
  const visibleFields = DB_FIELDS.filter(f => f.key !== '__skip__' && Object.values(mapping).includes(f.key))

  // ── Render steps ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Step indicator */}
      <div className={`${t.card} border rounded-xl p-4`}>
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-[#2F6BFF] text-white' : `${t.tag}`}`}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${i === step ? t.text : t.subtext}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-green-400' : darkMode ? 'bg-[#2A2F3E]' : 'bg-[#E6EBF2]'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 0: Upload ── */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Drop zone */}
          <div className={`${t.card} border rounded-xl p-6 flex flex-col`}>
            <h3 className={`text-sm font-bold ${t.text} mb-1`}>Upload CSV or Excel File</h3>
            <p className={`text-xs ${t.subtext} mb-4`}>Drag & drop or click to select a .csv, .xlsx or .xls file</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex-1 min-h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                ${dragOver
                  ? 'border-[#2F6BFF] bg-[#E9F2FF]'
                  : darkMode ? 'border-[#2A2F3E] hover:border-[#2F6BFF]' : 'border-[#D0D7E2] hover:border-[#2F6BFF] hover:bg-[#F9FBFF]'}`}>
              <Upload size={32} className={`mb-3 ${dragOver ? 'text-[#2F6BFF]' : t.subtext}`} />
              <p className={`text-sm font-semibold ${dragOver ? 'text-[#2F6BFF]' : t.text}`}>
                {dragOver ? 'Drop it here!' : 'Drag & drop your file'}
              </p>
              <p className={`text-xs ${t.subtext} mt-1`}>or click to browse</p>
              <p className={`text-[10px] ${t.subtext} mt-3 opacity-60`}>.csv · .xlsx · .xls supported</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => parseFile(e.target.files[0])} />
          </div>

          {/* Column guide */}
          <div className={`${t.card} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-[#2F6BFF]" />
              <h3 className={`text-sm font-bold ${t.text}`}>Column Guide</h3>
            </div>
            <p className={`text-[11px] ${t.subtext} mb-3`}>
              Your file can have any column names — we'll auto-map them. <strong>Source</strong> is set separately, not in the file.
            </p>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`${t.th} border-b ${t.divider}`}>
                    <th className="px-2 py-1.5 text-left font-semibold">Column Name</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Required</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Accepted Values</th>
                  </tr>
                </thead>
                <tbody className={t.text}>
                  {[
                    { col: 'Lead Name / Name', req: true, val: 'Any text' },
                    { col: 'Company', req: false, val: 'Any text' },
                    { col: 'Email', req: false, val: 'email@domain.com' },
                    { col: 'Phone', req: false, val: '+91 XXXXX XXXXX' },
                    { col: 'Job Title', req: false, val: 'Any text' },
                    { col: 'Message / Notes', req: false, val: 'Any text' },
                    { col: 'Status', req: false, val: 'New · Contacted · Interested · Follow Up · Converted · Not Interested' },
                    { col: 'Priority', req: false, val: 'High · Medium · Low' },
                    { col: 'Assigned To', req: false, val: 'Team member name' },
                    { col: 'Follow Up Date', req: false, val: 'YYYY-MM-DD or DD/MM/YYYY' },
                  ].map(({ col, req, val }) => (
                    <tr key={col} className={`border-b ${t.divider}`}>
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{col}</td>
                      <td className="px-2 py-1.5">{req ? <span className="text-red-500 font-bold">✓ Yes</span> : <span className={t.subtext}>—</span>}</td>
                      <td className={`px-2 py-1.5 ${t.subtext}`}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 1: Source ── */}
      {step === 1 && (
        <div className={`${t.card} border rounded-xl p-6 max-w-md`}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle size={14} className="text-orange-500" />
            </div>
            <h3 className={`text-sm font-bold ${t.text}`}>Set Source for All Rows</h3>
          </div>
          <p className={`text-xs ${t.subtext} mb-5`}>
            This source will be applied to <strong>all {rawRows.length} rows</strong> in your file. You can use an existing source or type a custom one.
          </p>

          <label className={`block text-xs font-semibold ${t.subtext} mb-1.5`}>Source <span className="text-red-500">*</span></label>
          <select value={source} onChange={e => setSource(e.target.value)} className={selCls}>
            <option value="">— Select or type custom —</option>
            {knownSources.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__custom__">✏️ Type a custom source…</option>
          </select>

          {source === '__custom__' && (
            <div className="mt-3">
              <label className={`block text-xs font-semibold ${t.subtext} mb-1.5`}>Custom Source Name</label>
              <input value={customSource} onChange={e => setCustomSource(e.target.value)}
                placeholder="e.g. Referral, Cold Call, LinkedIn…"
                className={`w-full ${inCls}`} />
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
            <strong>File:</strong> {file?.name} · <strong>Rows:</strong> {rawRows.length}
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={() => setStep(0)} className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-semibold ${t.tag}`}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => { if (!effectiveSource) { showToast('Source is required', 'error'); return }; setStep(2) }}
              disabled={!effectiveSource}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-[#2F6BFF] text-white font-bold rounded-lg hover:bg-[#1A4FCC] disabled:opacity-50">
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Map Columns ── */}
      {step === 2 && (
        <div className={`${t.card} border rounded-xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${t.divider} flex items-center justify-between`}>
            <div>
              <h3 className={`text-sm font-bold ${t.text}`}>Map Columns</h3>
              <p className={`text-xs ${t.subtext} mt-0.5`}>We auto-mapped your columns. Adjust if needed. Unmapped columns will be skipped.</p>
            </div>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
              {Object.values(mapping).filter(v => v !== '__skip__').length} / {headers.length} mapped
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${t.th} border-b ${t.divider}`}>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Your File Column</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Sample Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Maps To</th>
                </tr>
              </thead>
              <tbody>
                {headers.map(h => (
                  <tr key={h} className={`border-b ${t.divider} ${t.row}`}>
                    <td className={`px-4 py-2.5 text-xs font-semibold ${t.text}`}>{h}</td>
                    <td className={`px-4 py-2.5 text-xs ${t.subtext} max-w-xs truncate`}>
                      {rawRows[0]?.[h]?.toString() || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={mapping[h] || '__skip__'}
                        onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                        className={`text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2F6BFF] w-48 ${t.input}
                          ${mapping[h] && mapping[h] !== '__skip__' ? 'border-green-400' : ''}`}>
                        {DB_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`px-5 py-3 border-t ${t.divider} flex gap-2`}>
            <button onClick={() => setStep(1)} className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-semibold ${t.tag}`}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => {
                const mappedToName = Object.values(mapping).includes('lead_name')
                if (!mappedToName) { showToast('Please map at least one column to "Lead Name"', 'error'); return }
                setStep(3)
              }}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-[#2F6BFF] text-white font-bold rounded-lg hover:bg-[#1A4FCC]">
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Duplicates ── */}
      {step === 3 && (
        <div className={`${t.card} border rounded-xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${t.divider}`}>
            <h3 className={`text-sm font-bold ${t.text}`}>Duplicate Detection</h3>
            <p className={`text-xs ${t.subtext} mt-0.5`}>
              Leads are matched by email or phone against your existing {leads.length} leads.
            </p>
          </div>

          {duplicates.length === 0 ? (
            <div className={`py-10 text-center ${t.subtext}`}>
              <CheckCircle size={28} className="mx-auto mb-2 text-green-500" />
              <p className="text-sm font-semibold text-green-600">No duplicates found!</p>
              <p className="text-xs mt-1 opacity-70">{mappedRows.length} rows are all new leads.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-semibold px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full`}>
                  {duplicates.length} duplicate{duplicates.length > 1 ? 's' : ''} found
                </span>
                <span className={`text-xs ${t.subtext}`}>Set action for each, or:</span>
                <button onClick={() => { const d = {}; duplicates.forEach(dd => d[dd.rowIndex] = 'overwrite'); setDuplicateMap(d) }}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full font-semibold hover:bg-blue-100">
                  Overwrite All
                </button>
                <button onClick={() => { const d = {}; duplicates.forEach(dd => d[dd.rowIndex] = 'skip'); setDuplicateMap(d) }}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full font-semibold hover:bg-gray-200">
                  Skip All
                </button>
                <button onClick={() => { const d = {}; duplicates.forEach(dd => d[dd.rowIndex] = 'add_new'); setDuplicateMap(d) }}
                  className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-full font-semibold hover:bg-green-100">
                  Add All as New
                </button>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`${t.th} border-b ${t.divider}`}>
                      <th className="px-4 py-2 text-left font-semibold">Incoming Lead</th>
                      <th className="px-4 py-2 text-left font-semibold">Existing Lead</th>
                      <th className="px-4 py-2 text-left font-semibold">Match</th>
                      <th className="px-4 py-2 text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.map(({ rowIndex, row, existing }) => (
                      <tr key={rowIndex} className={`border-b ${t.divider} ${t.row}`}>
                        <td className="px-4 py-2">
                          <div className={`font-semibold ${t.text}`}>{row.lead_name || '—'}</div>
                          <div className={t.subtext}>{row.email || row.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className={`font-semibold ${t.text}`}>{existing.lead_name || '—'}</div>
                          <div className={t.subtext}>{existing.email || existing.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-2">
                          {row.email && existing.email && row.email.toLowerCase() === existing.email.toLowerCase()
                            ? <span className="text-blue-600 font-semibold">Email</span>
                            : <span className="text-purple-600 font-semibold">Phone</span>}
                        </td>
                        <td className="px-4 py-2">
                          <select value={duplicateMap[rowIndex] ?? 'overwrite'}
                            onChange={e => setDuplicateMap(m => ({ ...m, [rowIndex]: e.target.value }))}
                            className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:border-[#2F6BFF] ${t.input}`}>
                            <option value="overwrite">Overwrite existing</option>
                            <option value="add_new">Add as new lead</option>
                            <option value="skip">Skip (don't import)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className={`px-5 py-3 border-t ${t.divider} flex gap-2`}>
            <button onClick={() => setStep(2)} className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-semibold ${t.tag}`}>
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={() => setStep(4)}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-[#2F6BFF] text-white font-bold rounded-lg hover:bg-[#1A4FCC]">
              Preview & Import <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Preview + Import ── */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Rows', value: rawRows.length, color: '#2F6BFF', bg: 'bg-blue-50' },
              { label: 'Valid Leads', value: mappedRows.length, color: '#22C55E', bg: 'bg-green-50' },
              { label: 'Duplicates', value: duplicates.length, color: '#F97316', bg: 'bg-orange-50' },
              { label: 'Skipped Rows', value: rawRows.length - mappedRows.length, color: '#9AA5B1', bg: darkMode ? 'bg-[#2A2F3E]' : 'bg-gray-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${t.card} border rounded-xl p-4 flex items-center gap-3`}>
                <div className={`${bg} w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black`}
                  style={{ color }}>{value}</div>
                <span className={`text-xs font-semibold ${t.subtext}`}>{label}</span>
              </div>
            ))}
          </div>

          {/* Preview table */}
          {!result && (
            <div className={`${t.card} border rounded-xl overflow-hidden`}>
              <div className={`px-5 py-3 border-b ${t.divider} flex items-center justify-between`}>
                <h3 className={`text-sm font-bold ${t.text}`}>Preview (first 5 rows)</h3>
                <span className={`text-xs ${t.subtext}`}>Source: <strong>{effectiveSource}</strong></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`${t.th} border-b ${t.divider}`}>
                      {visibleFields.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className={`border-b ${t.divider} ${t.row}`}>
                        {visibleFields.map(f => (
                          <td key={f.key} className={`px-3 py-2 ${t.text} max-w-36 truncate`}>
                            {row[f.key]?.toString() || <span className={`${t.subtext} italic`}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className={`${t.card} border rounded-xl p-6`}>
              <p className={`text-sm font-bold ${t.text} mb-3`}>Importing leads…</p>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="h-3 bg-[#2F6BFF] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className={`text-xs ${t.subtext} mt-2`}>{progress}% complete</p>
            </div>
          )}

          {/* Success */}
          {result && (
            <div className={`${t.card} border rounded-xl p-8 flex flex-col items-center text-center`}>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle size={36} className="text-green-500" />
              </div>
              <h3 className={`text-lg font-bold ${t.text} mb-2`}>Import Complete!</h3>
              <div className="flex gap-6 mb-5">
                <div><p className="text-2xl font-black text-green-500">{result.inserted}</p><p className={`text-xs ${t.subtext}`}>New leads added</p></div>
                <div><p className="text-2xl font-black text-blue-500">{result.updated}</p><p className={`text-xs ${t.subtext}`}>Updated</p></div>
                <div><p className="text-2xl font-black text-gray-400">{result.skipped}</p><p className={`text-xs ${t.subtext}`}>Skipped</p></div>
              </div>
              <p className={`text-xs ${t.subtext} mb-6`}>All new leads are now visible in Lead Management, Follow-ups, and Analytics.</p>
              <button onClick={resetAll}
                className="px-6 py-2.5 bg-[#2F6BFF] text-white text-sm font-bold rounded-lg hover:bg-[#1A4FCC]">
                Import Another File
              </button>
            </div>
          )}

          {!importing && !result && (
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-semibold ${t.tag}`}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleImport}
                className="flex items-center gap-2 px-6 py-2.5 text-sm bg-green-500 text-white font-bold rounded-lg hover:bg-green-600">
                <Upload size={14} /> Import {mappedRows.length} Leads
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
