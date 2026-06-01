import { useState, useMemo } from 'react'
import { Filter, Calendar, Users, Building2, Flame, Sun, Snowflake } from 'lucide-react'

// Generic filter options (would be dynamically generated in a real scenario)
const SOURCES = ['Website', 'Meta', 'Landing Page 2', 'New Meta Leads March', 'Direct']
const INDUSTRIES = ['All', 'Agriculture', 'Retail', 'Tech', 'Manufacturing', 'Logistics', 'Other']
const DATE_RANGES = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' }
]

export default function LeadClassificationTab({ leads, darkMode }) {
  const [filterSource, setFilterSource] = useState('All')
  const [filterOwner, setFilterOwner] = useState('All')
  const [filterIndustry, setFilterIndustry] = useState('All')
  const [filterDate, setFilterDate] = useState('all')
  const [minScore, setMinScore] = useState(0)

  const TEAM_MEMBERS = useMemo(() => {
    return ['Unassigned', ...new Set(leads.map(l => l.assigned_to).filter(Boolean))].sort()
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

  const LeadCard = ({ lead, type }) => {
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
      <div className={`rounded-xl border p-4 mb-4 ${t.card} ${s.border} shadow-sm transition-transform hover:-translate-y-1`}>
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
              hotLeads.map(l => <LeadCard key={l.id} lead={l} type="hot" />)
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
              warmLeads.map(l => <LeadCard key={l.id} lead={l} type="warm" />)
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
              coldLeads.map(l => <LeadCard key={l.id} lead={l} type="cold" />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
