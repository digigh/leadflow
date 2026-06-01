import React, { useState, useMemo } from 'react'
import { MetricCard } from '../components/UI'
import { 
  Users, Clock, Target, Flame, PhoneCall, TrendingUp, Star, BarChart2, Filter, 
  Award, Globe, Compass, ArrowUpRight, Zap, CheckCircle2, ChevronRight, PieChart, ShieldAlert
} from 'lucide-react'

// Upgraded Pipeline Funnel Component
const FunnelChart = ({ data, darkMode = false }) => {
  const maxVal = data[0]?.value || 1;
  return (
    <div className="flex flex-col items-center gap-2.5 py-4 relative h-full justify-center">
      {data.map((item, index) => {
        const percentage = ((item.value / maxVal) * 100).toFixed(1);
        const nextVal = index < data.length - 1 ? data[index+1].value : null;
        const dropoff = nextVal !== null && item.value > 0 ? (((item.value - nextVal) / item.value) * 100).toFixed(0) : 0;
        
        return (
          <React.Fragment key={item.label}>
            <div className="relative w-full flex flex-col items-center z-10 group">
              {/* Funnel Bar */}
              <div 
                className="h-12 font-bold text-white flex items-center justify-between px-6 rounded-xl shadow-sm transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                style={{ 
                  width: `${Math.max(percentage, 25)}%`, 
                  minWidth: '220px',
                  backgroundColor: item.color,
                  boxShadow: `0 4px 14px 0 ${item.color}35`,
                }}
              >
                <span className="text-xs tracking-wide uppercase font-black">{item.label}</span>
                <span className="text-lg font-black">{item.value.toLocaleString()}</span>
              </div>
              <div className="absolute top-1/2 -right-24 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-md shadow border border-blue-100 dark:border-blue-800/40 whitespace-nowrap">
                  {percentage}% of Pool
                </span>
              </div>
            </div>

            {/* Connecting visual for Drop-off */}
            {index < data.length - 1 && (
              <div className="flex flex-col items-center py-1 z-0">
                <div className={`w-[1px] h-6 relative ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                  {dropoff > 0 && (
                    <div className="absolute top-1/2 left-3 -translate-y-1/2">
                      <span className="text-[9px] font-black text-red-500 bg-red-50 dark:bg-red-950/20 dark:text-red-400 px-2 py-0.5 rounded border border-red-100/50 dark:border-red-900/20 whitespace-nowrap">
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

export default function AnalyticsTab({ leads = [], settings = {}, darkMode = false }) {
  // ─── Analytics Filters ───
  const [dateRange, setDateRange] = useState('All Time')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [assignedFilter, setAssignedFilter] = useState('All')

  // Theme configuration
  const t = darkMode ? {
    card: 'bg-[#1A2035] border-[#2A2F3E] text-[#E2E8F0]',
    text: 'text-[#E2E8F0]',
    subtext: 'text-[#8892A4]',
    border: 'border-[#2A2F3E]',
    input: 'bg-[#161B27] border-[#2A2F3E] text-[#E2E8F0] focus:border-[#2F6BFF]',
    tag: 'bg-[#2A2F3E] text-[#8892A4]',
    rowHover: 'hover:bg-[#1E2540]',
    th: 'bg-[#1E2436] text-[#8892A4]',
    tr: 'border-[#2A2F3E]',
    bg: 'bg-[#161B27]',
    funnelBg: 'bg-[#1E2436]/50 border-[#2A2F3E]',
  } : {
    card: 'bg-white border-[#E6EBF2] text-[#2F3542]',
    text: 'text-[#2F3542]',
    subtext: 'text-[#6B778C]',
    border: 'border-[#E6EBF2]',
    input: 'bg-white border-[#E6EBF2] text-[#2F3542] focus:border-[#2F6BFF]',
    tag: 'bg-[#F4F6F9] text-[#6B778C]',
    rowHover: 'hover:bg-[#F9FAFC]',
    th: 'bg-[#F4F6F9] text-[#6B778C]',
    tr: 'border-[#EEF2F7]',
    bg: 'bg-white',
    funnelBg: 'bg-gray-50/50 border-gray-100/50',
  }

  // Derive unique options dynamically
  const sourceOpts = useMemo(() => ['All', ...new Set((leads || []).map(l => l.source).filter(Boolean))].sort(), [leads])
  const assignedOpts = useMemo(() => ['All', 'Unassigned', ...new Set((leads || []).map(l => l.assigned_to).filter(Boolean))].sort(), [leads])

  // Filter leads based on current scope settings
  const filteredLeads = useMemo(() => {
    return (leads || []).filter(l => {
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

  // ─── DATA ENGINE FOR ADVANCED METRICS ───
  
  // Daily / General volumes
  const totalLeads = filteredLeads.length;

  // % contacted: Average SLA Response Indicator
  const contactedCount = filteredLeads.filter(l => ['Interested', 'Follow Up', 'Meeting Scheduled', 'Converted', 'Not Interested'].includes(l.status)).length;
  const contactedPct = totalLeads ? Math.round((contactedCount / totalLeads) * 100) : 0;

  // % qualified
  const qualifiedLeads = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications.length > 0);
  const qualifiedPct = totalLeads ? Math.round((qualifiedLeads.length / totalLeads) * 100) : 0;

  // Hot leads generated
  const hotLeads = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Hot').length;

  // Calls booked (Scheduled Follow-ups)
  const callsBooked = filteredLeads.filter(l => !!l.follow_up_at || l.status === 'Follow Up').length;

  // Conversion rate
  const convertedCount = filteredLeads.filter(l => l.status === 'Converted').length;
  const conversionRate = totalLeads ? Math.round((convertedCount / totalLeads) * 100) : 0;

  // Average qualification assessment points score
  const scoredLeads = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.score !== undefined && l.lead_qualifications[0]?.score !== null);
  const avgFeedbackScore = scoredLeads.length > 0 
    ? (scoredLeads.reduce((sum, current) => sum + Number(current.lead_qualifications[0].score), 0) / scoredLeads.length).toFixed(1)
    : '—';

  // ─── AGENT PERFORMANCE LEADERBOARD QUERY ───
  const agentPerformance = useMemo(() => {
    // Collect all unique agents present in the current filtered scope
    const agents = [...new Set(filteredLeads.map(l => l.assigned_to).filter(Boolean))].sort();
    return agents.map(agent => {
      const agentLeads = filteredLeads.filter(l => l.assigned_to === agent);
      const total = agentLeads.length;
      
      const contacted = agentLeads.filter(l => ['Interested', 'Follow Up', 'Meeting Scheduled', 'Converted', 'Not Interested'].includes(l.status)).length;
      const contactedPct = total ? Math.round((contacted / total) * 100) : 0;
      
      const converted = agentLeads.filter(l => l.status === 'Converted').length;
      const conversionRate = total ? Math.round((converted / total) * 100) : 0;
      
      const scoredList = agentLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.score !== undefined);
      const avgScore = scoredList.length > 0 
        ? Math.round(scoredList.reduce((sum, curr) => sum + Number(curr.lead_qualifications[0].score), 0) / scoredList.length)
        : 0;

      const hotCount = agentLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Hot').length;
      
      return {
        name: agent,
        total,
        contactedPct,
        conversionRate,
        avgScore,
        hotCount
      };
    }).sort((a, b) => b.conversionRate - a.conversionRate || b.total - a.total);
  }, [filteredLeads]);

  // ─── SOURCE-WISE PERFORMANCE MATRIX QUERY ───
  const sourcePerformance = useMemo(() => {
    const sources = [...new Set(filteredLeads.map(l => l.source).filter(Boolean))].sort();
    return sources.map(source => {
      const sourceLeads = filteredLeads.filter(l => l.source === source);
      const total = sourceLeads.length;
      
      const converted = sourceLeads.filter(l => l.status === 'Converted').length;
      const conversionRate = total ? Math.round((converted / total) * 100) : 0;
      
      const qualified = sourceLeads.filter(l => l.lead_qualifications && l.lead_qualifications.length > 0).length;
      const qualifiedPct = total ? Math.round((qualified / total) * 100) : 0;
      
      const hotCount = sourceLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Hot').length;
      const hotPct = total ? Math.round((hotCount / total) * 100) : 0;
      
      return {
        source,
        total,
        conversionRate,
        qualifiedPct,
        hotPct
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredLeads]);

  // ─── LEAD QUALITY DISTRIBUTION MIX (Heat Index) ───
  const qualityMix = useMemo(() => {
    const unassessed = filteredLeads.filter(l => !l.lead_qualifications || l.lead_qualifications.length === 0).length;
    const hot = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Hot').length;
    const warm = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Warm').length;
    const cold = filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Cold').length;

    return {
      hot: { count: hot, pct: totalLeads ? Math.round((hot / totalLeads) * 100) : 0, color: '#EF4444', label: 'Hot Profile' },
      warm: { count: warm, pct: totalLeads ? Math.round((warm / totalLeads) * 100) : 0, color: '#F97316', label: 'Warm Profile' },
      cold: { count: cold, pct: totalLeads ? Math.round((cold / totalLeads) * 100) : 0, color: '#3B82F6', label: 'Cold Profile' },
      unassessed: { count: unassessed, pct: totalLeads ? Math.round((unassessed / totalLeads) * 100) : 0, color: '#94A3B8', label: 'Unassessed' }
    };
  }, [filteredLeads, totalLeads]);

  // ─── PIPELINE DROP-OFF FUNNEL DATA ───
  const funnelData = useMemo(() => [
    { label: 'Total Leads Received', value: totalLeads, color: '#2F6BFF' },
    { label: 'Qualified Leads', value: qualifiedLeads.length, color: '#7B3FFF' },
    { label: 'Hot Leads Generated', value: hotLeads, color: '#EF4444' },
    { label: 'Closed / Converted', value: convertedCount, color: '#2ECC71' }
  ], [totalLeads, qualifiedLeads.length, hotLeads, convertedCount]);

  // ─── TIME PROGRESSION SPARKLINES ───
  const getSparklinePoints = (leadsList) => {
    if (!leadsList || leadsList.length === 0) return [0, 0, 0, 0, 0];
    const sorted = [...leadsList]
      .map(l => l.date ? new Date(l.date).getTime() : 0)
      .filter(t => t > 0)
      .sort((a, b) => a - b);
    
    if (sorted.length < 5) {
      const count = leadsList.length;
      return [Math.floor(count * 0.4), Math.floor(count * 0.6), Math.floor(count * 0.5), Math.floor(count * 0.8), count];
    }
    const bucketSize = Math.max(1, Math.floor(sorted.length / 5));
    const buckets = [0, 0, 0, 0, 0];
    for (let i = 0; i < sorted.length; i++) {
      const bucketIdx = Math.min(4, Math.floor(i / bucketSize));
      buckets[bucketIdx]++;
    }
    return buckets;
  };

  const renderSparkline = (points, strokeColor, id) => {
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;
    const width = 120;
    const height = 30;
    
    const mapped = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - 3 - ((val - min) / range) * (height - 6);
      return `${x},${y}`;
    });
    
    const linePath = `M ${mapped.map(p => p.split(',').join(' ')).join(' L ')}`;
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return (
      <svg className="w-[120px] h-[30px] overflow-visible shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <defs>
          <linearGradient id={`grad-anal-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-anal-${id})`} />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={width} cy={parseFloat(mapped[mapped.length - 1]?.split(',')[1] || height / 2)} r={2} fill={strokeColor} />
      </svg>
    );
  };

  return (
    <div className="space-y-6 pb-6 overflow-y-auto max-h-[calc(100vh-112px)] pr-2 relative">
      
      {/* ─── Global Filter Bar ─── */}
      <div className={`rounded-xl border ${t.border} shadow-sm flex flex-col md:flex-row gap-4 p-4 ${t.bg}`}>
        <div className={`flex items-center gap-2 ${t.text} shrink-0 md:border-r ${t.border} md:pr-5`}>
          <Filter size={16} className="text-[#2F6BFF]" />
          <span className="font-extrabold text-sm tracking-tight">Scope Dashboard</span>
        </div>
        
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-lg p-1 pr-2 border ${t.border} hover:border-gray-300 dark:hover:border-gray-700 transition-colors ${darkMode ? 'bg-[#1E2436]/30' : 'bg-gray-50'}`}>
            <span className={`text-[9px] uppercase font-black ${t.subtext} ml-2`}>Timeframe</span>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              className={`px-2 py-0.5 text-xs font-bold border-none bg-transparent ${t.text} focus:outline-none cursor-pointer`}>
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
            <div className={`flex items-center gap-2 rounded-lg px-2 py-1 border ${t.border} shadow-sm transition-colors ${t.bg}`}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className={`text-[10px] font-semibold ${t.text} border-none focus:outline-none bg-transparent cursor-pointer`} />
              <span className="text-gray-300 text-xs">→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className={`text-[10px] font-semibold ${t.text} border-none focus:outline-none bg-transparent cursor-pointer`} />
            </div>
          )}

          <div className={`flex items-center gap-1.5 rounded-lg p-1 pr-2 border ${t.border} hover:border-gray-300 dark:hover:border-gray-700 transition-colors ${darkMode ? 'bg-[#1E2436]/30' : 'bg-gray-50'}`}>
            <span className={`text-[9px] uppercase font-black ${t.subtext} ml-2`}>Source</span>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className={`px-2 py-0.5 text-xs font-bold border-none bg-transparent ${t.text} focus:outline-none cursor-pointer`}>
              {sourceOpts.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>)}
            </select>
          </div>

          <div className={`flex items-center gap-1.5 rounded-lg p-1 pr-2 border ${t.border} hover:border-gray-300 dark:hover:border-gray-700 transition-colors ${darkMode ? 'bg-[#1E2436]/30' : 'bg-gray-50'}`}>
            <span className={`text-[9px] uppercase font-black ${t.subtext} ml-2`}>Team</span>
            <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
              className={`px-2 py-0.5 text-xs font-bold border-none bg-transparent ${t.text} focus:outline-none cursor-pointer`}>
              {assignedOpts.map(s => <option key={s} value={s}>{s === 'All' ? 'Everyone' : s}</option>)}
            </select>
          </div>
        </div>

        <div className={`md:ml-auto flex items-center border ${t.border} px-3.5 py-1.5 rounded-lg shrink-0 ${darkMode ? 'bg-[#1E2436]/40' : 'bg-gray-50'}`}>
          <span className={`text-base font-black ${t.text}`}>{totalLeads.toLocaleString()}</span>
          <span className={`text-[9px] font-bold ${t.subtext} uppercase ml-1.5 tracking-wider mt-0.5`}>Leads in Scope</span>
        </div>
      </div>

      {/* ─── REAL-TIME VELOCITY METRICS PANEL ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
        {[
          { label: 'Leads Received', value: totalLeads, points: getSparklinePoints(filteredLeads), color: '#2F6BFF', icon: Users, desc: 'Overall acquisition' },
          { label: 'Avg Contact SLA', value: `${contactedPct}%`, points: getSparklinePoints(filteredLeads.filter(l => ['Interested', 'Follow Up', 'Meeting Scheduled', 'Converted', 'Not Interested'].includes(l.status))), color: '#F5A623', icon: Clock, desc: 'Response SLA contacted' },
          { label: 'Qualified Ratio', value: `${qualifiedPct}%`, points: getSparklinePoints(qualifiedLeads), color: '#7B3FFF', icon: Target, desc: 'Scored lead threshold' },
          { label: 'Hot Leads Generated', value: hotLeads, points: getSparklinePoints(filteredLeads.filter(l => l.lead_qualifications && l.lead_qualifications[0]?.category === 'Hot')), color: '#EF4444', icon: Flame, desc: 'High intent profiles' },
          { label: 'Calls Booked', value: callsBooked, points: getSparklinePoints(filteredLeads.filter(l => !!l.follow_up_at || l.status === 'Follow Up')), color: '#20C997', icon: PhoneCall, desc: 'Scheduled follow-ups' }
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div 
              key={c.label} 
              className={`rounded-2xl border p-4 flex flex-col justify-between shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group ${t.card}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${t.subtext}`}>{c.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${c.color}15` }}>
                  <Icon size={14} style={{ color: c.color }} />
                </div>
              </div>
              
              <div className="flex items-end justify-between w-full mt-4">
                <div className="flex flex-col">
                  <span className={`text-2xl font-black tracking-tight leading-none ${t.text}`}>{c.value}</span>
                  <span className={`text-[9px] mt-1 font-semibold ${t.subtext}`}>{c.desc}</span>
                </div>
                {renderSparkline(c.points, c.color, i)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── AGENT PERFORMANCE LEADERBOARD & PIPELINE DROP-OFF ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Agent Leaderboard */}
        <div className={`lg:col-span-2 border ${t.border} rounded-2xl p-5 shadow-sm flex flex-col min-w-0 ${t.card}`}>
          <div className="flex items-center justify-between border-b ${t.border} pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-[#F5A623]" />
              <h3 className={`font-extrabold text-sm tracking-tight ${t.text}`}>Agent Performance Leaderboard</h3>
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ranked by Conversion</span>
          </div>

          {agentPerformance.length === 0 ? (
            <div className="py-12 text-center flex-1 flex flex-col items-center justify-center">
              <ShieldAlert size={28} className="opacity-20 text-[#6B778C] mb-2" />
              <p className={`text-xs font-bold ${t.subtext}`}>No agent allocations found in standard scope.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead>
                  <tr className={`${t.th} font-bold rounded-lg border-b ${t.border}`}>
                    <th className="px-4 py-2.5 rounded-l-lg">Agent Rank</th>
                    <th className="px-4 py-2.5">Total Leads</th>
                    <th className="px-4 py-2.5">Contact SLA</th>
                    <th className="px-4 py-2.5">Avg Score</th>
                    <th className="px-4 py-2.5 rounded-r-lg">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerformance.map((agent, index) => {
                    const colors = ['bg-[#FFDF00]/20 text-[#FFD700]', 'bg-gray-300/30 text-gray-500', 'bg-amber-600/10 text-amber-600'];
                    const badgeClass = index < 3 ? colors[index] : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
                    return (
                      <tr key={agent.name} className={`border-b ${t.tr} ${t.rowHover} transition-colors`}>
                        <td className="px-4 py-3 font-semibold flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-inner shrink-0 ${badgeClass}`}>
                            {index + 1}
                          </span>
                          <span className={`font-bold ${t.text}`}>{agent.name}</span>
                        </td>
                        <td className={`px-4 py-3 font-bold ${t.text}`}>{agent.total.toLocaleString()} leads</td>
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${agent.contactedPct >= 75 ? 'text-green-500' : 'text-amber-500'}`}>{agent.contactedPct}%</span>
                            <div className="w-12 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shrink-0">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${agent.contactedPct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold">
                          <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-md font-extrabold border border-purple-100/50 dark:border-purple-900/10">
                            {agent.avgScore} Pts
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-emerald-500">{agent.conversionRate}%</span>
                            <div className="flex-1 w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${agent.conversionRate}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drop-off Funnel Analysis */}
        <div className={`border ${t.border} rounded-2xl p-5 shadow-sm flex flex-col ${t.card}`}>
          <div className="flex items-center gap-2 border-b ${t.border} pb-3 mb-3 shrink-0">
            <BarChart2 className="text-[#2F6BFF]" size={18} />
            <h3 className={`font-extrabold text-sm tracking-tight ${t.text}`}>Drop-off Funnel Analysis</h3>
          </div>
          
          <div className={`flex-1 rounded-xl p-3 flex flex-col justify-center ${t.funnelBg}`}>
            {totalLeads > 0 ? (
              <FunnelChart data={funnelData} darkMode={darkMode} />
            ) : (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                <BarChart2 size={24} className="opacity-20 mb-2" />
                <span className="text-xs font-bold text-gray-400">No scoped drop-off metrics.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─── LEAD CHANNELS MATRIX & LEAD QUALITY HEAT INDEX ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 shrink-0">
        
        {/* Source Matrix */}
        <div className={`lg:col-span-2 border ${t.border} rounded-2xl p-5 shadow-sm ${t.card}`}>
          <div className="flex items-center justify-between border-b ${t.border} pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-[#7B3FFF]" />
              <h3 className={`font-extrabold text-sm tracking-tight ${t.text}`}>Lead Acquisition Source Matrix</h3>
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Channels</span>
          </div>

          {sourcePerformance.length === 0 ? (
            <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center">
              <ShieldAlert size={28} className="opacity-20 mb-2" />
              <span className="text-xs font-bold">No active sources scope found.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sourcePerformance.map(item => (
                <div 
                  key={item.source} 
                  className={`p-3.5 rounded-xl border ${t.border} transition-all duration-300 hover:shadow shadow-sm flex flex-col justify-between ${darkMode ? 'bg-[#1E2436]/30' : 'bg-gray-50/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-extrabold text-xs flex items-center gap-1.5 ${t.text}`}>
                      <Compass size={12} className="text-[#2F6BFF]" />
                      {item.source}
                    </span>
                    <span className={`text-[10px] font-black ${t.subtext}`}>
                      {item.total.toLocaleString()} leads
                    </span>
                  </div>

                  <div className="space-y-2 mt-4">
                    {/* Conversion bar */}
                    <div>
                      <div className="flex justify-between text-[9px] font-bold mb-1">
                        <span className={t.subtext}>Conversion Rate</span>
                        <span className="text-emerald-500 font-extrabold">{item.conversionRate}%</span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.conversionRate}%` }} />
                      </div>
                    </div>

                    {/* Quality score bar */}
                    <div>
                      <div className="flex justify-between text-[9px] font-bold mb-1">
                        <span className={t.subtext}>Qualified Leads Ratio</span>
                        <span className="text-purple-600 dark:text-purple-400 font-extrabold">{item.qualifiedPct}%</span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#7B3FFF] rounded-full" style={{ width: `${item.qualifiedPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Quality Heat Index */}
        <div className={`border ${t.border} rounded-2xl p-5 shadow-sm flex flex-col justify-between ${t.card}`}>
          <div className="flex items-center gap-2 border-b ${t.border} pb-3 mb-3 shrink-0">
            <PieChart className="text-[#EF4444]" size={18} />
            <h3 className={`font-extrabold text-sm tracking-tight ${t.text}`}>Lead Quality Heat Index</h3>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-4 py-2">
            {totalLeads === 0 ? (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center">
                <ShieldAlert size={24} className="opacity-20 mb-2" />
                <span className="text-xs font-bold">No assessments scoped.</span>
              </div>
            ) : (
              <>
                {/* Visual mixed distribution bar */}
                <div className="w-full h-4 rounded-full overflow-hidden flex shadow-inner">
                  {Object.values(qualityMix).map(c => c.count > 0 && (
                    <div 
                      key={c.label} 
                      className="h-full transition-all duration-300" 
                      style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                      title={`${c.label}: ${c.count} (${c.pct}%)`}
                    />
                  ))}
                </div>

                {/* List items */}
                <div className="space-y-2 mt-2">
                  {Object.values(qualityMix).map(c => (
                    <div key={c.label} className="flex items-center justify-between text-[11px] font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className={t.subtext}>{c.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${t.text}`}>{c.count}</span>
                        <span className="text-gray-400 text-[9px] font-black">({c.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <div className={`border-t ${t.border} pt-3 mt-3 flex items-center justify-between text-[10px] ${t.subtext} font-bold shrink-0`}>
            <span>Conversion Target</span>
            <div className="flex items-center gap-1 text-emerald-500">
              <TrendingUp size={11} />
              <span>{conversionRate}% Rate</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
