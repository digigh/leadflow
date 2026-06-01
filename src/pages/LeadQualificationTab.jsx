import { useState, useMemo } from 'react'
import { Search, Filter, ClipboardList, TrendingUp } from 'lucide-react'

const INDUSTRIES = ['All', 'Agriculture', 'Retail', 'Tech', 'Manufacturing', 'Logistics', 'Other']

export default function LeadQualificationTab({ leads, darkMode }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOwner, setFilterOwner] = useState('All')
  const [filterIndustry, setFilterIndustry] = useState('All')
  
  // Dynamic Team Members
  const TEAM_MEMBERS = useMemo(() => {
    const list = leads.map(l => l.assigned_to).filter(Boolean)
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
                  <tr key={lead.id} className={`border-b border-dashed ${t.border} ${t.trHover} transition-colors`}>
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
  )
}
