import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Target, Users, BarChart2, LogOut, Menu, Moon, Sun, Bell, X, RefreshCw, Sparkles, CalendarClock, Settings, CalendarCheck, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MOCK_LEADS } from '../lib/constants'
import { syncGoogleSheets } from '../lib/sheets'
import { loadSettings, saveSettings } from '../lib/settings'
import LeadsTab from './LeadsTab'
import AnalyticsTab from './AnalyticsTab'
import SettingsTab from './SettingsTab'
import FollowUpsTab from './FollowUpsTab'
import ImportTab from './ImportTab'

const POLL_INTERVAL_MS = 5 * 60 * 1000   // auto-poll every 5 minutes
const LIVE_HIGHLIGHT_MS = 60 * 1000       // highlight new leads for 1 minute

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('leads')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lf-dark') === 'true')
  const [settings, setSettings] = useState(() => loadSettings())

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbReady, setDbReady] = useState(false)

  // ── Notification Bell ──────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([])     // { id, count, time, leads[] }
  const [bellOpen, setBellOpen] = useState(false)
  const [polling, setPolling] = useState(false)
  const bellRef = useRef(null)
  const followUpBellRef = useRef(null)
  const [followUpBellOpen, setFollowUpBellOpen] = useState(false)
  const knownIdsRef = useRef(new Set())                       // IDs already seen

  // ── Live Lead Highlighting ─────────────────────────────────────────────────
  const [newLeadIds, setNewLeadIds] = useState(new Set())     // IDs to highlight
  const highlightTimerRef = useRef(null)

  const clearHighlights = () => {
    clearTimeout(highlightTimerRef.current)
    setNewLeadIds(new Set())
  }

  // Persist dark mode
  useEffect(() => {
    localStorage.setItem('lf-dark', darkMode)
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Close bell dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
      if (followUpBellRef.current && !followUpBellRef.current.contains(e.target)) setFollowUpBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Load leads from DB ─────────────────────────────────────────────────────
  const loadLeads = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        // Detect brand-new IDs if this is a refresh (not first load)
        if (opts.trackNew && knownIdsRef.current.size > 0) {
          const incoming = new Set(data.map(l => l.id))
          const fresh = [...incoming].filter(id => !knownIdsRef.current.has(id))
          if (fresh.length > 0) {
            const freshLeads = data.filter(l => fresh.includes(l.id))
            const notif = {
              id: Date.now(),
              count: fresh.length,
              time: new Date(),
              leads: freshLeads,
            }
            setNotifications(prev => [notif, ...prev].slice(0, 20))

            // Highlight new leads for 60 seconds
            setNewLeadIds(new Set(fresh))
            clearTimeout(highlightTimerRef.current)
            highlightTimerRef.current = setTimeout(clearHighlights, LIVE_HIGHLIGHT_MS)
          }
        }
        // Update known IDs
        knownIdsRef.current = new Set(data.map(l => l.id))
        setLeads(data)
        setDbReady(true)
      } else {
        setLeads(MOCK_LEADS)
        setDbReady(false)
      }
    } catch {
      setLeads(MOCK_LEADS)
      setDbReady(false)
    }
    if (!opts.silent) setLoading(false)
  }, [])

  // Initial load
  useEffect(() => { loadLeads() }, [loadLeads])

  // ── Auto-poll every 5 minutes ──────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(async () => {
      setPolling(true)
      try {
        await syncGoogleSheets()      // sync from Sheets → DB
        await loadLeads({ trackNew: true, silent: true })
      } catch { /* silent fail */ }
      setPolling(false)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [loadLeads])

  // ── Manual sync ───────────────────────────────────────────────────────────
  const handleSync = async () => {
    try {
      const result = await syncGoogleSheets()
      await loadLeads({ trackNew: true })
      return { success: true, count: result.count }
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  const unreadCount = notifications.length

  // ── Today's follow-ups ────────────────────────────────────────────────────
  const todayFollowUps = useMemo(() => {
    const todayStr = new Date().toDateString()
    return leads.filter(l => l.follow_up_at && new Date(l.follow_up_at).toDateString() === todayStr)
      .sort((a, b) => new Date(a.follow_up_at) - new Date(b.follow_up_at))
  }, [leads])

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const t = darkMode ? {
    bg: 'bg-[#0F1117]',
    sidebar: 'bg-[#161B27] border-[#2A2F3E]',
    header: 'bg-[#161B27] border-[#2A2F3E]',
    border: 'border-[#2A2F3E]',
    text: 'text-[#E2E8F0]',
    subtext: 'text-[#8892A4]',
    navActive: 'bg-[#1E3A5F] text-[#60A5FA]',
    navHover: 'text-[#8892A4] hover:bg-[#1E2436]',
    logoBrand: 'text-[#E2E8F0]',
    iconBtn: 'text-[#8892A4] hover:text-[#E2E8F0]',
    dropdown: 'bg-[#1A2035] border-[#2A2F3E]',
    dropdownItem: 'hover:bg-[#1E2540]',
  } : {
    bg: 'bg-[#F6F8FB]',
    sidebar: 'bg-white border-[#E6EBF2]',
    header: 'bg-white border-[#E6EBF2]',
    border: 'border-[#E6EBF2]',
    text: 'text-[#2F3542]',
    subtext: 'text-[#9AA5B1]',
    navActive: 'bg-[#E9F2FF] text-[#2F6BFF]',
    navHover: 'text-[#6B778C] hover:bg-[#F4F6F9]',
    logoBrand: 'text-[#2F3542]',
    iconBtn: 'text-[#6B778C] hover:text-[#2F3542]',
    dropdown: 'bg-white border-[#E6EBF2]',
    dropdownItem: 'hover:bg-[#F6F8FB]',
  }

  return (
    <div className={`h-screen w-full overflow-hidden ${t.bg} flex`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes live-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(47,203,113,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(47,203,113,0); }
        }
        .lead-live { animation: live-glow 1.5s ease-in-out infinite; background-color: #F0FFF4 !important; }
        html.dark .lead-live { background-color: #0D2A1A !important; }
      `}</style>

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} ${t.sidebar} border-r flex flex-col transition-all duration-200 shrink-0 h-full`}>
        <div className={`h-16 flex items-center px-4 border-b ${t.border} gap-3`}>
          <div className="w-8 h-8 rounded-lg bg-[#2F6BFF] flex items-center justify-center shrink-0">
            <Target size={16} className="text-white" />
          </div>
          {sidebarOpen && <span className={`font-black ${t.logoBrand} whitespace-nowrap`}>LeadFlow</span>}
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {[
            ['leads', Users, 'Lead Management'],
            ['followups', CalendarCheck, 'Follow-ups'],
            ['import', Upload, 'Import Leads'],
            ['analytics', BarChart2, 'Analytics'],
            ['settings', Settings, 'Settings'],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-left transition-colors ${activeTab === id ? t.navActive : t.navHover}`}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span className="text-sm font-semibold">{label}</span>}
            </button>
          ))}
        </nav>

        <div className={`p-4 mt-auto border-t ${t.border}`}>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white bg-red-500 hover:bg-red-600 shadow-sm transition-all"
          >
            <LogOut size={16} className="shrink-0" />
            {sidebarOpen && <span className="text-sm font-bold">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className={`h-16 ${t.header} border-b flex items-center justify-between px-6 shrink-0`}>
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(v => !v)} className={t.iconBtn}>
              <Menu size={20} />
            </button>
            <div>
              <h1 className={`text-base font-bold ${t.text}`}>
                {activeTab === 'leads' ? 'Lead Management'
                  : activeTab === 'analytics' ? 'Analytics Dashboard'
                  : activeTab === 'followups' ? 'Follow-ups'
                  : activeTab === 'import' ? 'Import Leads'
                  : 'Settings'}
              </h1>
              <p className={`text-xs ${t.subtext}`}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* DB status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 ${dbReady ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'} rounded-lg text-xs font-semibold`}>
              <span className={`w-1.5 h-1.5 ${dbReady ? 'bg-green-500' : 'bg-yellow-500'} rounded-full ${polling ? 'animate-ping' : 'animate-pulse'}`} />
              {polling ? 'Syncing…' : dbReady ? 'DB Connected' : 'Demo Mode'}
            </div>

            {/* ── Notification Bell ── */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen(o => !o)}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${darkMode ? 'bg-[#2A2F3E] text-[#8892A4] hover:text-[#E2E8F0]' : 'bg-[#F4F6F9] text-[#6B778C] hover:bg-[#E6EBF2]'}`}
                title="Notifications"
              >
                <Bell size={16} className={unreadCount > 0 ? 'text-[#2F6BFF]' : ''} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {bellOpen && (
                <div className={`absolute right-0 top-11 w-80 ${t.dropdown} border rounded-xl shadow-2xl z-50 overflow-hidden`}>
                  <div className={`px-4 py-3 border-b ${t.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[#2F6BFF]" />
                      <span className={`text-sm font-bold ${t.text}`}>New Leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button
                          onClick={() => setNotifications([])}
                          className={`text-xs ${t.subtext} hover:text-red-500 transition-colors`}
                        >
                          Clear all
                        </button>
                      )}
                      <button onClick={() => setBellOpen(false)} className={t.iconBtn}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className={`py-10 text-center ${t.subtext} text-sm`}>
                        <Bell size={24} className="mx-auto mb-2 opacity-30" />
                        <p>No new leads yet</p>
                        <p className="text-xs mt-1 opacity-70">Checks every 5 minutes automatically</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b ${t.border} ${t.dropdownItem} transition-colors`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`text-xs font-bold ${t.text}`}>
                                🟢 {n.count} new lead{n.count > 1 ? 's' : ''} synced
                              </p>
                              {n.leads.slice(0, 2).map(l => (
                                <p key={l.id} className={`text-xs ${t.subtext} mt-0.5`}>
                                  · {l.lead_name || '—'} ({l.source || '—'})
                                </p>
                              ))}
                              {n.leads.length > 2 && (
                                <p className={`text-xs ${t.subtext} opacity-60`}>+{n.leads.length - 2} more</p>
                              )}
                            </div>
                            <span className={`text-[10px] ${t.subtext} whitespace-nowrap shrink-0`}>
                              {n.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className={`px-4 py-2 border-t ${t.border} flex items-center gap-1 ${t.subtext} text-[10px]`}>
                    <RefreshCw size={10} className={polling ? 'animate-spin' : ''} />
                    Auto-syncs every 5 min · Next: ~{POLL_INTERVAL_MS / 60000}m
                  </div>
                </div>
              )}
            </div>

            {/* ── Follow-up Bell ── */}
            <div className="relative" ref={followUpBellRef}>
              <button
                onClick={() => setFollowUpBellOpen(o => !o)}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${darkMode ? 'bg-[#2A2F3E] text-[#8892A4] hover:text-[#E2E8F0]' : 'bg-[#F4F6F9] text-[#6B778C] hover:bg-[#E6EBF2]'}`}
                title="Today's Follow-ups"
              >
                <CalendarClock size={16} className={todayFollowUps.length > 0 ? 'text-orange-500' : ''} />
                {todayFollowUps.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {todayFollowUps.length > 9 ? '9+' : todayFollowUps.length}
                  </span>
                )}
              </button>

              {followUpBellOpen && (
                <div className={`absolute right-0 top-11 w-80 ${t.dropdown} border rounded-xl shadow-2xl z-50 overflow-hidden`}>
                  <div className={`px-4 py-3 border-b ${t.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <CalendarClock size={14} className="text-orange-500" />
                      <span className={`text-sm font-bold ${t.text}`}>Today's Follow-ups</span>
                      {todayFollowUps.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-black rounded-full">{todayFollowUps.length}</span>
                      )}
                    </div>
                    <button onClick={() => setFollowUpBellOpen(false)} className={t.iconBtn}><X size={14} /></button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {todayFollowUps.length === 0 ? (
                      <div className={`py-10 text-center ${t.subtext} text-sm`}>
                        <CalendarClock size={24} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No follow-ups today</p>
                        <p className="text-xs mt-1 opacity-60">Schedule follow-ups from the Edit button in the leads table</p>
                      </div>
                    ) : (
                      todayFollowUps.map(l => {
                        const fu = new Date(l.follow_up_at)
                        const isPast = fu < new Date()
                        return (
                          <div key={l.id} className={`px-4 py-3 border-b ${t.border} ${t.dropdownItem} transition-colors`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold ${t.text} truncate`}>{l.lead_name || '—'}</p>
                                <p className={`text-[10px] ${t.subtext} mt-0.5`}>{l.company || l.source || '—'}</p>
                                <p className={`text-[10px] ${t.subtext} mt-0.5`}>👤 {l.assigned_to || 'Unassigned'}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${isPast ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                }`}>
                                {fu.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                {isPast ? ' · Overdue' : ''}
                              </span>
                            </div>
                            {l.feedback && <p className={`text-[10px] ${t.subtext} mt-1 truncate`}>💬 {l.feedback}</p>}
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className={`px-4 py-2 border-t ${t.border} text-[10px] ${t.subtext}`}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </div>
                </div>
              )}
            </div>

            {/* Dark mode */}
            <button
              onClick={() => setDarkMode(d => !d)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${darkMode ? 'bg-[#2A2F3E] text-yellow-400 hover:bg-[#353C52]' : 'bg-[#F4F6F9] text-[#6B778C] hover:bg-[#E6EBF2]'}`}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <div className="w-9 h-9 rounded-full bg-[#2F6BFF] flex items-center justify-center text-white text-sm font-bold">A</div>
          </div>
        </header>

        <main className={`flex-1 overflow-auto p-6 ${t.bg}`}>
          {activeTab === 'leads' ? (
            <LeadsTab
              leads={leads}
              setLeads={setLeads}
              loading={loading}
              dbReady={dbReady}
              onSync={handleSync}
              darkMode={darkMode}
              newLeadIds={newLeadIds}
              settings={settings}
            />
          ) : activeTab === 'followups' ? (
            <FollowUpsTab leads={leads} setLeads={setLeads} dbReady={dbReady} darkMode={darkMode} settings={settings} />
          ) : activeTab === 'import' ? (
            <ImportTab leads={leads} setLeads={setLeads} dbReady={dbReady} darkMode={darkMode} settings={settings} />
          ) : activeTab === 'analytics' ? (
            <AnalyticsTab leads={leads} darkMode={darkMode} settings={settings} />
          ) : (
            <SettingsTab settings={settings} onSettingsChange={handleSettingsChange} />
          )}
        </main>
      </div>
    </div>
  )
}
