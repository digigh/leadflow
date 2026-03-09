import { useEffect } from 'react'
import { TrendingUp, TrendingDown, Check, AlertTriangle } from 'lucide-react'
import { STATUS_STYLES, PRIORITY_COLORS_CLASS } from '../lib/constants'

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-gray-400 italic">—</span>
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

// ── Priority Badge ─────────────────────────────────────────────────────────────
export function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-xs text-gray-400 italic">—</span>
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PRIORITY_COLORS_CLASS[priority] || 'bg-gray-100 text-gray-500'}`}>
      {priority}
    </span>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────
export function MetricCard({ icon: Icon, label, value, trend, trendVal, color = '#2F6BFF' }) {
  return (
    <div className="bg-white rounded-xl border border-[#E6EBF2] shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#6B778C]">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-[#2F3542]">{value}</span>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(trendVal)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── Toast Notification ─────────────────────────────────────────────────────────
export function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all ${type === 'success' ? 'bg-green-500' : 'bg-orange-500'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
      {msg}
    </div>
  )
}
