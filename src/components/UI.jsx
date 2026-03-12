import { useEffect, useState, useRef } from 'react'
import { TrendingUp, TrendingDown, Check, AlertTriangle, Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react'
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

// ── Helpers ──────────────────────────────────────────────────────────────────
export function formatToLocalDatetime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

export function toISODatetime(localString) {
  if (!localString) return null;
  const d = new Date(localString);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Elegant DateTime Input ─────────────────────────────────────────────────────
export function ElegantDateTimeInput({ value, onChange, className = '', darkMode = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const [view, setView] = useState('date') // 'date', 'hour', 'minute'
  
  const isSelected = !!value
  const initialDate = value ? new Date(value) : new Date()
  if (isNaN(initialDate.getTime())) initialDate.setTime(Date.now())

  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const [draftDate, setDraftDate] = useState(initialDate)
  const [isPM, setIsPM] = useState(draftDate.getHours() >= 12)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const applyChange = (newDate) => {
    if (!newDate) {
      setDraftDate(new Date())
      onChange({ target: { value: '' } })
      setIsOpen(false)
      return
    }
    setDraftDate(newDate)
    const yyyy = newDate.getFullYear()
    const MM = String(newDate.getMonth() + 1).padStart(2, '0')
    const dd = String(newDate.getDate()).padStart(2, '0')
    const hh = String(newDate.getHours()).padStart(2, '0')
    const mm = String(newDate.getMinutes()).padStart(2, '0')
    onChange({ target: { value: `${yyyy}-${MM}-${dd}T${hh}:${mm}` } })
  }

  const handleDateClick = (day) => {
    const newD = new Date(draftDate)
    newD.setFullYear(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    applyChange(newD)
    setTimeout(() => setView('hour'), 250)
  }

  const handleHourPic = (hr) => {
    const newD = new Date(draftDate)
    let newHr = hr
    if (isPM && newHr < 12) newHr += 12
    if (!isPM && newHr === 12) newHr = 0
    newD.setHours(newHr)
    applyChange(newD)
  }

  const handleMinPic = (min) => {
    const newD = new Date(draftDate)
    newD.setMinutes(min)
    applyChange(newD)
  }

  const onClockPointer = (e, finish = false) => {
    if (e.type === 'pointermove' && !isDragging) return
    const clientX = e.clientX
    const clientY = e.clientY
    if (clientX === undefined) return

    const rect = e.currentTarget.getBoundingClientRect()
    const dx = clientX - rect.left - 100
    const dy = clientY - rect.top - 100
    let angle = Math.atan2(dy, dx) * 180 / Math.PI
    angle += 90
    if (angle < 0) angle += 360

    if (view === 'hour') {
      let hr = Math.round(angle / 30)
      if (hr === 0 || hr === 12) hr = 12
      handleHourPic(hr)
      if (finish) setTimeout(() => setView('minute'), 250)
    } else {
      let min = Math.round(angle / 6)
      if (min === 60) min = 0
      handleMinPic(min)
    }
  }

  const togglePM = (pm) => {
    setIsPM(pm)
    const newD = new Date(draftDate)
    let hr = newD.getHours() % 12
    newD.setHours(pm ? hr + 12 : hr)
    applyChange(newD)
  }

  // Header display
  const dispDate = isSelected ? draftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Select Date'
  const dispTime = isSelected ? draftDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Time'

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const calDays = Array.from({length: firstDay}, () => null).concat(Array.from({length: daysInMonth}, (_, i) => i + 1))

  const baseClass = darkMode 
    ? "bg-[#1E2436] border-[#2A2F3E] text-[#E2E8F0] focus:border-[#2F6BFF] focus:ring-1 focus:ring-[#2F6BFF]/50" 
    : "bg-white border-[#E6EBF2] text-[#2F3542] focus:border-[#2F6BFF] focus:ring-2 focus:ring-[#2F6BFF]/20"

  const formattedInput = isSelected 
    ? `${draftDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric'})} ${draftDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
    : ''

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className={`w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border outline-none transition-all shadow-sm cursor-pointer flex items-center min-h-[30px] ${baseClass} ${!isSelected && !darkMode ? 'text-[#9AA5B1]' : ''}`}
      >
        <Calendar size={14} className="absolute left-2.5 text-[#9AA5B1] pointer-events-none" />
        <div className="flex-1 truncate" onClick={() => setIsOpen(!isOpen)}>
          {formattedInput || 'Select date & time...'}
        </div>
        {isSelected && (
          <button 
            onClick={(e) => { e.stopPropagation(); applyChange(null); }}
            className={`absolute right-2 p-1 rounded-md transition-colors ${darkMode ? 'text-[#8892A4] hover:text-red-400 hover:bg-[#2A2F3E]' : 'text-[#9AA5B1] hover:text-red-500 hover:bg-red-50'}`}
            title="Clear date"
          >
            <X size={12} strokeWidth={3} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className={`absolute top-full mt-2 left-0 w-[280px] rounded-2xl shadow-xl border z-50 overflow-hidden select-none ${darkMode ? 'bg-[#1A2035] border-[#2A2F3E]' : 'bg-white border-[#E6EBF2]'}`}>
          {/* Tabs */}
          <div className={`flex items-center text-sm font-bold border-b ${darkMode ? 'border-[#2A2F3E]' : 'border-[#E6EBF2]'}`}>
            <button 
              onClick={() => setView('date')} 
              className={`flex-1 py-3 text-center transition-colors ${view === 'date' ? 'bg-[#2F6BFF] text-white' : darkMode ? 'text-[#8892A4] hover:bg-[#1E2540]' : 'text-[#6B778C] hover:bg-[#F9FBFF]'}`}
            >
              {dispDate}
            </button>
            <button 
              onClick={() => setView('hour')} 
              className={`flex-1 py-3 text-center transition-colors ${(view === 'hour' || view === 'minute') ? 'bg-[#2F6BFF] text-white' : darkMode ? 'text-[#8892A4] hover:bg-[#1E2540]' : 'text-[#6B778C] hover:bg-[#F9FBFF]'}`}
            >
              {dispTime}
            </button>
          </div>

          <div className="p-4">
            {view === 'date' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className={`p-1.5 rounded-full transition-colors ${darkMode ? 'hover:bg-[#2A2F3E]' : 'hover:bg-gray-100'}`}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className={`text-sm font-bold ${darkMode ? 'text-[#E2E8F0]' : 'text-[#2F3542]'}`}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className={`p-1.5 rounded-full transition-colors ${darkMode ? 'hover:bg-[#2A2F3E]' : 'hover:bg-gray-100'}`}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className={`text-center text-[10px] font-bold uppercase ${darkMode ? 'text-[#8892A4]' : 'text-[#9AA5B1]'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calDays.map((d, i) => {
                    const isSelectedDay = isSelected && d === draftDate.getDate() && currentMonth.getMonth() === draftDate.getMonth() && currentMonth.getFullYear() === draftDate.getFullYear()
                    return (
                      <div key={i} className="aspect-square flex items-center justify-center">
                        {d && (
                          <button 
                            onClick={() => handleDateClick(d)}
                            className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${isSelectedDay ? 'bg-[#2F6BFF] text-white shadow-md scale-110' : darkMode ? 'hover:bg-[#2A2F3E] text-[#E2E8F0]' : 'hover:bg-[#F4F6F9] text-[#2F3542]'}`}
                          >
                            {d}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(view === 'hour' || view === 'minute') && (
              <div className="animate-in fade-in slide-in-from-right-2 duration-200 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-5">
                  <span onClick={() => setView('hour')} className={`text-3xl font-black cursor-pointer transition-colors ${view === 'hour' ? (darkMode ? 'text-[#E2E8F0]' : 'text-[#2F3542]') : (darkMode ? 'text-[#8892A4]' : 'text-[#9AA5B1]')}`}>
                    {String(draftDate.getHours() % 12 || 12).padStart(2, '0')}
                  </span>
                  <span className={`text-3xl font-black ${darkMode ? 'text-[#8892A4]' : 'text-[#9AA5B1]'}`}>:</span>
                  <span onClick={() => setView('minute')} className={`text-3xl font-black cursor-pointer transition-colors ${view === 'minute' ? (darkMode ? 'text-[#E2E8F0]' : 'text-[#2F3542]') : (darkMode ? 'text-[#8892A4]' : 'text-[#9AA5B1]')}`}>
                    {String(draftDate.getMinutes()).padStart(2, '0')}
                  </span>
                  
                  <div className={`flex flex-col ml-3 rounded-lg overflow-hidden border ${darkMode ? 'bg-[#1E2436] border-[#2A2F3E]' : 'bg-gray-100 border-gray-200'}`}>
                    <button onClick={() => togglePM(false)} className={`px-2 py-1 text-[10px] font-bold transition-colors ${!isPM ? 'bg-[#2F6BFF] text-white' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-[#2A2F3E]'}`}>AM</button>
                    <button onClick={() => togglePM(true)} className={`px-2 py-1 text-[10px] font-bold transition-colors ${isPM ? 'bg-[#2F6BFF] text-white' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-[#2A2F3E]'}`}>PM</button>
                  </div>
                </div>

                {/* Clock Face */}
                <div 
                  className={`relative w-[200px] h-[200px] rounded-full mx-auto touch-none shadow-inner ${darkMode ? 'bg-[#1E2436]' : 'bg-[#F4F6F9]'}`}
                  onPointerDown={(e) => { setIsDragging(true); onClockPointer(e, false) }}
                  onPointerMove={(e) => isDragging && onClockPointer(e, false)}
                  onPointerUp={(e) => { setIsDragging(false); onClockPointer(e, true) }}
                  onPointerLeave={() => { setIsDragging(false) }}
                >
                  <div className="absolute w-2 h-2 rounded-full bg-[#2F6BFF] left-[96px] top-[96px] z-10" />
                  
                  {(() => {
                    const max = view === 'hour' ? 12 : 60
                    const val = view === 'hour' ? (draftDate.getHours() % 12 || 12) : draftDate.getMinutes()
                    const angle = (val / max) * 360
                    return (
                      <div 
                        className="absolute bg-[#2F6BFF] origin-bottom z-0 rounded-full transition-transform duration-100" 
                        style={{ width: 2, height: 80, left: 99, top: 20, transform: `rotate(${angle}deg)`, transformOrigin: '50% 100%' }} 
                      >
                        <div className="absolute -left-3.5 -top-3 -mt-0.5 w-8 h-8 rounded-full bg-[#2F6BFF]/20 border-[2px] border-[#2F6BFF]" />
                      </div>
                    )
                  })()}

                  <div className="pointer-events-none">
                    {Array.from({length: 12}).map((_, i) => {
                      const num = view === 'hour' ? (i === 0 ? 12 : i) : i * 5
                      const angle = (view === 'hour' ? num * 30 : num * 6) - 90
                      const rad = angle * Math.PI / 180
                      const x = 100 + 80 * Math.cos(rad)
                      const y = 100 + 80 * Math.sin(rad)
                      
                      const isActive = view === 'hour' ? (draftDate.getHours() % 12 || 12) === num : Math.round(draftDate.getMinutes() / 5) * 5 % 60 === num

                      return (
                        <div 
                          key={num}
                          className={`absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center rounded-full text-xs font-semibold z-10 transition-colors
                            ${isActive ? 'text-[#2F6BFF]' : darkMode ? 'text-[#E2E8F0]' : 'text-[#2F3542]'}`
                          }
                          style={{ left: x, top: y }}
                        >
                          {String(num).padStart(view === 'minute' ? 2 : 1, '0')}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-5 flex w-full justify-between items-center px-1">
                  <span className={`text-[10px] ${darkMode ? 'text-[#8892A4]' : 'text-[#9AA5B1]'}`}>Tap or drag to select</span>
                  <button onClick={() => setIsOpen(false)} className="px-5 py-1.5 bg-[#2F6BFF] text-white rounded-lg text-xs font-bold hover:bg-[#1A4FCC] transition-colors shadow-sm">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

