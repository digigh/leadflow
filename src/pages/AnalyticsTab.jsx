import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { STATUS_COLORS } from '../lib/constants'
import { MetricCard } from '../components/UI'
import { Users, TrendingUp, Globe, Activity } from 'lucide-react'
import { useState, useMemo } from 'react'

const DAILY = [{ day: 'Mon', leads: 4 }, { day: 'Tue', leads: 7 }, { day: 'Wed', leads: 5 }, { day: 'Thu', leads: 9 }, { day: 'Fri', leads: 6 }, { day: 'Sat', leads: 3 }, { day: 'Sun', leads: 2 }]
const WEEKLY = [{ week: 'W1', leads: 18 }, { week: 'W2', leads: 24 }, { week: 'W3', leads: 31 }, { week: 'W4', leads: 28 }, { week: 'W5', leads: 35 }, { week: 'W6', leads: 42 }]
const COLORS = ['#2F6BFF', '#2ECC71', '#F5A623', '#E74C3C', '#7B3FFF', '#00BCD4']

export default function AnalyticsTab({ leads, settings = {} }) {
  const colVis = settings.columnVisibility || {}
  const [timeRange, setTimeRange] = useState('monthly')

  // ─── Analytics Date Filter ─────────────────────────────────────────────────
  const [dateType, setDateType] = useState('All Time')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())

  const filteredLeads = useMemo(() => {
    if (dateType === 'All Time') return leads;
    return leads.filter(l => {
      if (!l.date) return false;
      const d = new Date(l.date);
      if (dateType === 'Custom Range') {
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo) { const toD = new Date(dateTo); toD.setHours(23, 59, 59, 999); if (d > toD) return false; }
        return true;
      } else if (dateType === 'Month/Year') {
        if (yearFilter && d.getFullYear().toString() !== yearFilter) return false;
        if (monthFilter && (d.getMonth() + 1).toString().padStart(2, '0') !== monthFilter) return false;
        return true;
      }
      return true;
    });
  }, [leads, dateType, dateFrom, dateTo, monthFilter, yearFilter]);

  const statusData = Object.entries(
    filteredLeads.reduce((a, l) => { if (l.status) a[l.status] = (a[l.status] || 0) + 1; return a }, {})
  ).map(([name, value]) => ({ name, value }))

  const sourceData = [
    { name: 'Website', value: filteredLeads.filter(l => l.source === 'Website').length },
    { name: 'Meta', value: filteredLeads.filter(l => l.source === 'Meta').length },
  ]

  const priorityData = Object.entries(
    filteredLeads.reduce((a, l) => {
      const p = l.priority || 'Unassigned';
      a[p] = (a[p] || 0) + 1;
      return a
    }, {})
  ).map(([name, count]) => ({ name, count }))

  const assignedData = Object.entries(
    filteredLeads.reduce((a, l) => {
      const assignee = l.assigned_to || 'Unassigned';
      if (!a[assignee]) a[assignee] = { name: assignee, total: 0, converted: 0 };
      a[assignee].total += 1;
      if (l.status === 'Converted') a[assignee].converted += 1;
      return a;
    }, {})
  ).map(([, data]) => ({
    ...data,
    conversionRate: Math.round((data.converted / data.total) * 100)
  })).sort((a, b) => b.total - a.total);

  const monthlyData = filteredLeads.reduce((acc, lead) => {
    if (!lead.date) return acc;
    const d = new Date(lead.date);
    const month = d.toLocaleString('default', { month: 'short' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const MONTHLY = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
    .map(m => ({ month: m, leads: monthlyData[m] || 0 }))
    .filter((m, i, arr) => m.leads > 0 || i >= new Date().getMonth() - 2);

  const timeData = timeRange === 'daily' ? DAILY : timeRange === 'weekly' ? WEEKLY : MONTHLY
  const timeKey = timeRange === 'daily' ? 'day' : timeRange === 'weekly' ? 'week' : 'month'

  const convRate = filteredLeads.length
    ? Math.round(filteredLeads.filter(l => l.status === 'Converted').length / filteredLeads.length * 100)
    : 0

  return (
    <div className="space-y-5">

      {/* ─── Date Filter Bar ─── */}
      <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-[#6B778C] whitespace-nowrap">Filter Analytics:</span>
        <select value={dateType} onChange={e => setDateType(e.target.value)}
          className="px-3 py-2 text-sm border border-[#E6EBF2] rounded-lg focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
          <option value="All Time">All Time</option>
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

        <span className="ml-auto text-xs text-[#9AA5B1]">
          {filteredLeads.length} of {leads.length} leads shown
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Leads" value={filteredLeads.length} trend={1} trendVal={18} color="#2F6BFF" />
        {colVis.status !== false && (
          <MetricCard icon={TrendingUp} label="Conversion Rate" value={`${convRate}%`} trend={1} trendVal={3} color="#2ECC71" />
        )}
        {colVis.source !== false && (
          <>
            <MetricCard icon={Globe} label="Website Leads" value={sourceData[0].value} trend={1} trendVal={10} color="#7B3FFF" />
            <MetricCard icon={Activity} label="Meta Leads" value={sourceData[1].value} color="#F5A623" />
          </>
        )}
      </div>

      {/* Line chart + Status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#2F3542]">Leads Over Time</h3>
              <p className="text-xs text-[#9AA5B1]">Acquisition trend</p>
            </div>
            <div className="flex gap-1">
              {['daily', 'weekly', 'monthly'].map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${timeRange === r ? 'bg-[#E9F2FF] text-[#2F6BFF]' : 'text-[#6B778C] hover:bg-[#F4F6F9]'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeData}>
              <XAxis dataKey={timeKey} tick={{ fontSize: 11, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E6EBF2', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="leads" stroke="#2F6BFF" strokeWidth={2.5} dot={{ fill: '#2F6BFF', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {colVis.status !== false && (
          <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2F3542] mb-1">Status Distribution</h3>
            <p className="text-xs text-[#9AA5B1] mb-3">Breakdown by lead status</p>
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                      {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[statusData[i].name] || COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {statusData.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs text-[#6B778C]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.name] || COLORS[i % COLORS.length] }} />
                      {s.name} ({s.value})
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-[#9AA5B1] text-sm text-center px-4">
                No status data yet — start editing leads to see breakdown
              </div>
            )}
          </div>
        )}
      </div>

      {/* Priority bar + Source donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {colVis.priority !== false && (
          <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2F3542] mb-1">Priority Pipeline</h3>
            <p className="text-xs text-[#9AA5B1] mb-4">Leads sorted by importance</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B778C' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }} />
                <Bar dataKey="count" fill="#2ECC71" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {colVis.source !== false && (
          <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2F3542] mb-1">Lead Source Distribution</h3>
            <p className="text-xs text-[#9AA5B1] mb-4">Website vs Meta Ads</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  <Cell fill="#2F6BFF" /><Cell fill="#7B3FFF" />
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              {sourceData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: i === 0 ? '#2F6BFF' : '#7B3FFF' }} />
                  <span className="font-semibold text-[#2F3542]">{s.name}</span>
                  <span className="text-[#9AA5B1]">({s.value})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Team Performance (Assigned To) */}
      {colVis.assigned_to !== false && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Leads per Assignee */}
          <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2F3542] mb-1">Leads by Owner</h3>
            <p className="text-xs text-[#9AA5B1] mb-4">Total lead volume assigned to team members</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={assignedData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B778C' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }} />
                <Bar dataKey="total" fill="#2F6BFF" radius={[0, 4, 4, 0]} name="Total Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion per Assignee */}
          <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2F3542] mb-1">Conversion Performance</h3>
            <p className="text-xs text-[#9AA5B1] mb-4">Converted leads and conversion rate by owner</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={assignedData}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#2ECC71' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }} />
                <Bar yAxisId="left" dataKey="converted" fill="#2ECC71" radius={[4, 4, 0, 0]} name="Converted Leads" />
                <Line yAxisId="right" type="monotone" dataKey="conversionRate" stroke="#F5A623" strokeWidth={2} name="Conversion %" dot={{ fill: '#F5A623', r: 4 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
