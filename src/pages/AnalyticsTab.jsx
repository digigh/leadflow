import React, { useState, useMemo } from 'react'
import { MetricCard } from '../components/UI'
import { Users, Clock, Target, Flame, PhoneCall, TrendingUp, Star, BarChart2, Filter } from 'lucide-react'

// Custom Funnel component using HTML/CSS for gorgeous pipeline visualization
const FunnelChart = ({ data }) => {
  const maxVal = data[0].value || 1;
  return (
    <div className="flex flex-col items-center gap-3 py-6 relative h-full justify-center">
      {data.map((item, index) => {
        // Calculate the width as a percentage of the container. We start high and narrow down.
        const percentage = ((item.value / maxVal) * 100).toFixed(1);
        const nextVal = index < data.length - 1 ? data[index+1].value : null;
        const dropoff = nextVal !== null && item.value > 0 ? (((item.value - nextVal) / item.value) * 100).toFixed(0) : 0;
        
        return (
          <React.Fragment key={item.label}>
            <div className="relative w-full flex flex-col items-center z-10 group">
              {/* Funnel Bar */}
              <div 
                className="h-14 font-bold text-white flex items-center justify-between px-6 rounded-xl shadow-sm transition-all duration-300 hover:scale-[1.02]"
                style={{ 
                  width: `${Math.max(percentage, 25)}%`, 
                  minWidth: '220px',
                  backgroundColor: item.color,
                  boxShadow: `0 4px 14px 0 ${item.color}40`,
                }}
              >
                <span className="text-sm tracking-wide">{item.label}</span>
                <span className="text-xl">{item.value}</span>
              </div>
              <div className="absolute top-1/2 -right-24 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs font-bold text-gray-400 bg-white px-2 py-1 rounded shadow-sm border border-gray-100 whitespace-nowrap">
                  {percentage}% Conversion
                </span>
              </div>
            </div>

            {/* Connecting visual for Drop-off */}
            {index < data.length - 1 && (
              <div className="flex flex-col items-center py-1.5 z-0">
                <div className="w-[1px] h-8 bg-gray-200 relative">
                  {dropoff > 0 && (
                    <div className="absolute top-1/2 left-3 -translate-y-1/2">
                      <span className="text-[10px] font-bold text-red-400 bg-red-50/50 px-1.5 py-0.5 rounded whitespace-nowrap">
                        Drop-off: {dropoff}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default function AnalyticsTab({ leads, settings = {} }) {
  // ─── Analytics Filters ───
  const [dateRange, setDateRange] = useState('All Time')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [assignedFilter, setAssignedFilter] = useState('All')

  // Derive unique options dynamically
  const sourceOpts = useMemo(() => ['All', ...new Set(leads.map(l => l.source).filter(Boolean))], [leads])
  const assignedOpts = useMemo(() => ['All', 'Unassigned', ...new Set(leads.map(l => l.assigned_to).filter(Boolean))], [leads])

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // 1. Source
      if (sourceFilter !== 'All' && l.source !== sourceFilter) return false;
      // 2. Assigned To
      if (assignedFilter !== 'All') {
        if (assignedFilter === 'Unassigned' && l.assigned_to) return false;
        if (assignedFilter !== 'Unassigned' && l.assigned_to !== assignedFilter) return false;
      }

      // 3. Date Range
      if (dateRange !== 'All Time' && l.date) {
        const d = new Date(l.date)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        if (dateRange === 'Today') {
           if (d < today) return false;
        } else if (dateRange === 'Custom Range') {
           if (dateFrom && d < new Date(dateFrom)) return false;
           if (dateTo) { const toD = new Date(dateTo); toD.setHours(23, 59, 59, 999); if (d > toD) return false; }
        } else if (dateRange === 'Last 7 Days') {
           const last7 = new Date(today); last7.setDate(today.getDate() - 7);
           if (d < last7) return false;
        } else if (dateRange === 'Last 30 Days') {
           const last30 = new Date(today); last30.setDate(today.getDate() - 30);
           if (d < last30) return false;
        } else if (dateRange === 'This Month') {
           if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        } else if (dateRange === 'Last Month') {
           const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
           const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
           if (d < lastMonth || d >= thisMonth) return false;
        } else if (dateRange === 'This Quarter') {
           const qrt = Math.floor(now.getMonth() / 3);
           const dQrt = Math.floor(d.getMonth() / 3);
           if (dQrt !== qrt || d.getFullYear() !== now.getFullYear()) return false;
        } else if (dateRange === 'This Year') {
           if (d.getFullYear() !== now.getFullYear()) return false;
        }
      }
      return true;
    });
  }, [leads, dateRange, dateFrom, dateTo, sourceFilter, assignedFilter]);

  // ─── DAILY METRICS (Velocity) ───
  const totalLeads = filteredLeads.length;

  // % contacted within 5 mins: Realistically inferred via active statuses vs 'New'
  const contactedCount = filteredLeads.filter(l => ['Interested', 'Follow Up', 'Meeting Scheduled', 'Converted', 'Not Interested'].includes(l.status)).length;
  const contactedPct = totalLeads ? Math.round((contactedCount / totalLeads) * 100) : 0;

  // % qualified
  const qualifiedLeads = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications.length > 0);
  const qualifiedPct = totalLeads ? Math.round((qualifiedLeads.length / totalLeads) * 100) : 0;

  // Hot leads generated
  const hotLeads = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Hot').length;

  // Calls booked: Captured mostly via follow_up_at existing or status 'Follow Up'
  const callsBooked = filteredLeads.filter(l => !!l.follow_up_at || l.status === 'Follow Up').length;

  // ─── WEEKLY METRICS (Performance & Funnel) ───
  // Conversion Rate
  const convertedCount = filteredLeads.filter(l => l.status === 'Converted').length;
  const conversionRate = totalLeads ? Math.round((convertedCount / totalLeads) * 100) : 0;

  // Sales Feedback Score (Average lead score from assessments)
  const scoredLeads = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.score !== undefined && l.lead_qualifications[0]?.score !== null);
  const avgFeedbackScore = scoredLeads.length > 0 
    ? (scoredLeads.reduce((sum, current) => sum + Number(current.lead_qualifications[0].score), 0) / scoredLeads.length).toFixed(1)
    : '—';

  // Drop-off Analysis Funnel Data
  const funnelData = [
    { label: 'Total Leads', value: totalLeads, color: '#2F6BFF' },
    { label: 'Qualified', value: qualifiedLeads.length, color: '#7B3FFF' },
    { label: 'Hot Leads', value: hotLeads, color: '#F5A623' },
    { label: 'Converted', value: convertedCount, color: '#2ECC71' }
  ];

  return (
    <div className="space-y-8 pb-10">

      {/* ─── Global Filter Bar ─── */}
      <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm flex flex-col md:flex-row gap-4 p-5">
        <div className="flex items-center gap-2 text-[#2F3542] shrink-0 md:border-r border-[#E6EBF2] md:pr-5">
          <Filter size={18} className="text-[#2F6BFF]" />
          <span className="font-extrabold tracking-tight">Scope Dashboard</span>
        </div>
        
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-50/50 rounded-lg p-1 pr-2 border border-blue-100/50 hover:border-blue-200 transition-colors">
            <span className="text-[10px] uppercase font-bold text-blue-800 ml-2">Timeframe</span>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              className="px-2 py-1 text-sm font-bold border-none bg-transparent text-[#2F6BFF] focus:outline-none cursor-pointer">
              <option value="All Time">All Time Activity</option>
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Year</option>
              <option value="Custom Range">Custom Date Range...</option>
            </select>
          </div>

          {dateRange === 'Custom Range' && (
            <div className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-blue-200 hover:border-blue-300 shadow-sm transition-colors">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="text-xs font-semibold text-[#2F3542] border-none focus:outline-none bg-transparent cursor-pointer" />
              <span className="text-gray-300 text-xs">→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="text-xs font-semibold text-[#2F3542] border-none focus:outline-none bg-transparent cursor-pointer" />
            </div>
          )}

          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 pr-2 border border-gray-200 hover:border-gray-300 transition-colors">
            <span className="text-[10px] uppercase font-bold text-[#9AA5B1] ml-2">Source</span>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className="px-2 py-1 text-sm font-semibold border-none bg-transparent text-[#2F3542] focus:outline-none cursor-pointer">
              {sourceOpts.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 pr-2 border border-gray-200 hover:border-gray-300 transition-colors">
            <span className="text-[10px] uppercase font-bold text-[#9AA5B1] ml-2">Team</span>
            <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
              className="px-2 py-1 text-sm font-semibold border-none bg-transparent text-[#2F3542] focus:outline-none cursor-pointer">
              {assignedOpts.map(s => <option key={s} value={s}>{s === 'All' ? 'Everyone' : s}</option>)}
            </select>
          </div>
        </div>

        <div className="md:ml-auto flex items-center bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg shrink-0">
          <span className="text-sm font-bold text-[#2F3542]">{totalLeads}</span>
          <span className="text-[11px] font-bold text-[#6B778C] uppercase ml-1.5 tracking-wider mt-0.5">Leads in Scope</span>
        </div>
      </div>

      {/* ─── PERFORMANCE METRICS ─── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-[#2F3542] tracking-tight">Daily Velocity Metrics</h2>
          <p className="text-xs text-[#9AA5B1] font-medium mt-0.5">Real-time incoming volume, response SLA, and immediate pipeline generation actions.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard icon={Users} label="Total leads received" value={totalLeads} color="#2F6BFF" />
          <MetricCard icon={Clock} label="% contacted (avg SLA)" value={`${contactedPct}%`} color="#F5A623" />
          <MetricCard icon={Target} label="% qualified" value={`${qualifiedPct}%`} color="#7B3FFF" />
          <MetricCard icon={Flame} label="Hot leads generated" value={hotLeads} color="#EF4444" />
          <MetricCard icon={PhoneCall} label="Calls booked" value={callsBooked} color="#20C997" />
        </div>
      </section>

      {/* ─── WEEKLY / FUNNEL METRICS ─── */}
      <section>
        <div className="mb-4 mt-8">
          <h2 className="text-lg font-extrabold text-[#2F3542] tracking-tight">Weekly Performance & Funnel</h2>
          <p className="text-xs text-[#9AA5B1] font-medium mt-0.5">Overall conversion rates, average team assessment scores, and holistic pipeline drop-off.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Key Indicators */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 shadow-sm overflow-hidden relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500 rounded-full blur-3xl opacity-20"></div>
              <TrendingUp className="text-emerald-500 mb-3" size={28} />
              <div className="text-3xl font-black text-[#2F3542] tracking-tight">{conversionRate}%</div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mt-1">Conversion Rate</h3>
              <p className="text-[11px] text-gray-400 mt-3 font-medium border-t border-emerald-100/50 pt-3">Percentage of filtered leads progressing natively to 'Converted' status.</p>
            </div>

            <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl border border-purple-100 p-6 shadow-sm overflow-hidden relative">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
              <Star className="text-purple-500 mb-3" size={28} />
              <div className="text-3xl font-black text-[#2F3542] tracking-tight">{avgFeedbackScore} <span className="text-base text-gray-400 font-bold">avg</span></div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mt-1">Sales Feedback Score</h3>
              <p className="text-[11px] text-gray-400 mt-3 font-medium border-t border-purple-100/50 pt-3">Calculated from the comprehensive automated Lead Qualification (Hot/Warm/Cold) engine.</p>
            </div>
          </div>

          {/* Drop-off Funnel Visual */}
          <div className="md:col-span-2 bg-white border border-[#E6EBF2] rounded-2xl shadow-sm p-6 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="text-[#2F6BFF]" size={20} />
              <h3 className="font-bold text-[#2F3542] tracking-tight">Drop-off Analysis Funnel</h3>
            </div>
            <div className="text-xs text-[#9AA5B1] font-medium border-b border-gray-100 pb-3 mb-2">Track the attrition rate as your pipeline flows from acquisition to conversion.</div>
            
            <div className="flex-1 bg-gray-50/50 rounded-xl overflow-hidden border border-gray-100/50 mt-2 p-4">
               {totalLeads > 0 ? (
                 <FunnelChart data={funnelData} />
               ) : (
                 <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                    <BarChart2 size={32} className="opacity-20 mb-2" />
                    <span className="text-sm font-semibold">No data in standard date scope.</span>
                 </div>
               )}
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
