import { ArrowRight, Target, TrendingUp, Users, Bell, Filter, BarChart2, Activity, CheckCircle2, ChevronRight, Zap } from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    gradient: 'from-blue-500 to-blue-600',
    bg: '#EFF6FF',
    accent: '#2563EB',
    title: 'Centralized Lead Inbox',
    desc: 'All leads from Website forms, Meta Ads, and Landing Pages flow into one unified table — no more juggling spreadsheets.',
  },
  {
    icon: Filter,
    gradient: 'from-indigo-500 to-indigo-600',
    bg: '#EEF2FF',
    accent: '#4F46E5',
    title: 'Smart Filtering',
    desc: 'Filter by Source, Status, Priority, Owner, or Date Range instantly. Find any lead in seconds.',
  },
  {
    icon: TrendingUp,
    gradient: 'from-sky-500 to-sky-600',
    bg: '#F0F9FF',
    accent: '#0284C7',
    title: 'Pipeline Tracking',
    desc: 'Assign Priority and Owner to every lead. Track from New → Interested → Follow Up → Converted.',
  },
  {
    icon: Bell,
    gradient: 'from-blue-400 to-cyan-500',
    bg: '#ECFEFF',
    accent: '#0891B2',
    title: 'Live Notifications',
    desc: 'Notification bell alerts you the moment new leads arrive. Auto-background sync every 5 minutes.',
  },
  {
    icon: BarChart2,
    gradient: 'from-violet-500 to-blue-500',
    bg: '#F5F3FF',
    accent: '#7C3AED',
    title: 'Conversion Analytics',
    desc: 'Conversion rates, source breakdown, priority pipeline — all filterable by date range, month, or year.',
  },
  {
    icon: Activity,
    gradient: 'from-blue-600 to-indigo-600',
    bg: '#EFF6FF',
    accent: '#1D4ED8',
    title: 'Team Collaboration',
    desc: 'Assign leads, add feedback and remarks, and track who is working on what — built for teams.',
  },
]

const STEPS = [
  { n: '01', title: 'Connect Your Sources', desc: 'Link your Google Sheet with Website, Meta & Landing Page lead data.' },
  { n: '02', title: 'Auto-Sync & Notify', desc: 'Leads pull in automatically. Bell alerts you of new arrivals.' },
  { n: '03', title: 'Assign & Track', desc: 'Set Priority, Owner, and Status — your team works the pipeline.' },
  { n: '04', title: 'Analyse & Convert', desc: 'Monitor charts and conversion rates to close more deals.' },
]

export default function HomePage({ onNavigate }) {
  return (
    <div className="min-h-screen" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400;1,9..40,700&family=DM+Serif+Display:ital@0;1&display=swap');

        /* Fade up */
        @keyframes fadeUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        .f1{animation:fadeUp .7s .05s ease both}
        .f2{animation:fadeUp .7s .2s ease both}
        .f3{animation:fadeUp .7s .35s ease both}
        .f4{animation:fadeUp .7s .5s ease both}
        .f5{animation:fadeUp .7s .65s ease both}

        /* Float */
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        .float-ui{animation:floatY 5s ease-in-out infinite}

        /* Orb drift */
        @keyframes orb1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,25px)} }
        .orb1{animation:orb1 14s ease-in-out infinite}
        .orb2{animation:orb2 18s ease-in-out infinite}

        /* Shimmer pulse */
        @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
        .live-dot{animation:shimmer 2s ease-in-out infinite}

        /* Gradient text */
        .blue-grad {
          background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 40%, #818CF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Card lift */
        .card-lift { transition: all .25s cubic-bezier(.4,0,.2,1); }
        .card-lift:hover { transform:translateY(-5px); box-shadow:0 20px 40px rgba(37,99,235,.13); }

        /* Step connector */
        .step-line { background: linear-gradient(90deg, #BFDBFE, #93C5FD); }

        /* Feature icon gradient */
        .feat-icon { background: linear-gradient(135deg, var(--ia), var(--ib)); }
      `}</style>

      {/* ── HERO SECTION ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg, #020F2E 0%, #0A2160 30%, #0D3B8D 55%, #4A90D9 80%, #EBF4FF 100%)',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Dreamy orbs */}
        <div className="orb1 absolute pointer-events-none" style={{
          top: '80px', left: '8%', width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(96,165,250,0.22) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }} />
        <div className="orb2 absolute pointer-events-none" style={{
          top: '160px', right: '10%', width: 420, height: 420,
          background: 'radial-gradient(circle, rgba(129,140,248,0.2) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }} />
        <div className="absolute pointer-events-none" style={{
          bottom: '-60px', left: '50%', transform: 'translateX(-50%)', width: 900, height: 300,
          background: 'radial-gradient(ellipse, rgba(219,234,254,0.25) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />

        {/* Star dots */}
        {[...Array(28)].map((_, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{
              width: i % 5 === 0 ? 3 : 2, height: i % 5 === 0 ? 3 : 2,
              background: 'rgba(255,255,255,' + (0.2 + (i % 4) * 0.15) + ')',
              top: `${8 + (i * 23) % 65}%`,
              left: `${(i * 17 + 5) % 92}%`,
              animation: `shimmer ${2 + (i % 4)}s ${i * 0.3}s ease-in-out infinite`,
            }} />
        ))}

        {/* ── NAV ── */}
        <nav className="relative z-50 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xl shadow-blue-800/40"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #818CF8)' }}>
              <Target size={17} className="text-white" />
            </div>
            <span className="font-black text-white text-xl tracking-tight">LeadFlow</span>
          </div>
          <button
            onClick={() => onNavigate('login')}
            className="flex items-center gap-2 px-6 py-2.5 font-bold rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(10px)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            Sign In <ChevronRight size={14} />
          </button>
        </nav>

        {/* ── HERO CONTENT ── */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-32 text-center">
          {/* Pill */}
          <div className="f1 inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-sm font-semibold mb-8"
            style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(96,165,250,0.4)', color: '#BAE6FD' }}>
            <span className="live-dot w-2 h-2 bg-green-400 rounded-full inline-block" />
            Live Lead Management Platform
          </div>

          {/* Headline */}
          <h1 className="f2 font-black text-white tracking-tight mb-6" style={{ fontSize: 'clamp(2.8rem,7vw,5.5rem)', lineHeight: 1.05 }}>
            Every Lead.<br />
            <span className="blue-grad" style={{ fontFamily: "'DM Serif Display', serif", fontStyle: 'italic' }}>
              Every Opportunity.
            </span>
          </h1>

          {/* Subtext */}
          <p className="f3 max-w-2xl mx-auto mb-12 leading-relaxed" style={{ color: '#BAE6FD', fontSize: '1.1rem' }}>
            Capture leads from Website, Meta Ads & Landing Pages, assign them to your team,
            track every stage of the pipeline, and close more deals — all in one beautifully simple platform.
          </p>

          {/* CTA */}
          <div className="f4 flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => onNavigate('login')}
              className="flex items-center gap-2.5 px-9 py-4 font-black rounded-2xl text-base transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: 'white', boxShadow: '0 8px 32px rgba(59,130,246,0.5)' }}
            >
              Enter Platform <ArrowRight size={18} />
            </button>
          </div>

          {/* Stats strip */}
          <div className="f5 grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {[['Unlimited', 'Leads Tracked'], ['5 min', 'Auto-Sync'], ['Real-time', 'Notifications'], ['100%', 'Cloud Secure']].map(([v, l]) => (
              <div key={l} className="rounded-2xl px-4 py-5 text-center"
                style={{ background: 'rgba(14,38,90,0.55)', border: '1px solid rgba(96,165,250,0.25)', backdropFilter: 'blur(8px)' }}>
                <div className="text-xl font-black text-white mb-0.5">{v}</div>
                <div className="text-xs font-medium" style={{ color: '#93C5FD' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Dashboard Preview */}
        <div className="float-ui relative z-10 max-w-3xl mx-auto px-6 -mt-6 pb-20">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,28,80,0.7)', border: '1px solid rgba(96,165,250,0.25)', boxShadow: '0 32px 80px rgba(2,15,46,0.7)', backdropFilter: 'blur(20px)' }}>
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              <span className="ml-2 text-[10px] font-mono" style={{ color: '#4B6EA8' }}>leadflow.internal/dashboard</span>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: '#34D399' }}>
                <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full" />DB Connected
              </div>
            </div>
            {/* Metric cards */}
            <div className="p-5 grid grid-cols-4 gap-3">
              {[['Total Leads', '348', '#60A5FA'], ['Converted', '61', '#34D399'], ['Hot Leads', '87', '#FCD34D'], ['Sources', '2', '#A78BFA']].map(([l, v, c]) => (
                <div key={l} className="rounded-xl p-4"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-[10px] mb-1.5 font-medium" style={{ color: '#6495C8' }}>{l}</div>
                  <div className="text-xl font-black" style={{ color: c }}>{v}</div>
                  <div className="text-[9px] mt-1" style={{ color: '#4B6EA8' }}>↑ 12% this month</div>
                </div>
              ))}
            </div>
            {/* Mini chart */}
            <div className="px-5 pb-5">
              <div className="rounded-xl flex items-end gap-1 px-3 pb-3 pt-2"
                style={{ height: 72, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[20, 38, 28, 58, 42, 72, 52, 88, 65, 95, 78, 100].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm"
                    style={{ height: `${h * .68}%`, background: i % 3 === 0 ? '#3B82F6' : i % 3 === 1 ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.2)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHITE SECTION — FEATURES ──────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(180deg, #EBF4FF 0%, #FFFFFF 12%)' }}>

        {/* FEATURE CARDS */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5"
                style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB' }}>
                <CheckCircle2 size={12} className="text-blue-500" />
                What LeadFlow Gives You
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight" style={{ color: '#0F172A' }}>
                Built for sales teams<br />
                <span className="blue-grad">that close deals.</span>
              </h2>
              <p className="max-w-lg mx-auto text-base leading-relaxed" style={{ color: '#64748B' }}>
                Every feature reduces friction, increases visibility, and helps your team focus on converting leads into customers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ icon: Icon, bg, accent, title, desc }) => (
                <div key={title} className="card-lift bg-white rounded-2xl p-7"
                  style={{ border: '1px solid #E8F0FE', boxShadow: '0 2px 16px rgba(37,99,235,.06)' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: bg, border: `1px solid ${accent}22` }}>
                    <Icon size={22} style={{ color: accent }} />
                  </div>
                  <h3 className="font-bold text-base mb-2" style={{ color: '#0F172A' }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-20 px-6" style={{ background: '#F8FBFF' }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5"
                style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB' }}>
                <Zap size={11} className="text-blue-500" />
                How It Works
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: '#0F172A' }}>
                From lead to close —<br />
                <span className="blue-grad">four simple steps.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              {STEPS.map((s, i) => (
                <div key={s.n} className="relative">
                  {/* connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="step-line hidden md:block absolute top-6 left-[calc(50%+24px)] right-0 h-0.5 z-0" style={{ right: '-24px' }} />
                  )}
                  <div className="bg-white rounded-2xl p-6 text-center relative z-10"
                    style={{ border: '1px solid #E8F0FE', boxShadow: '0 2px 16px rgba(37,99,235,.06)' }}>
                    <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center font-black text-sm"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: 'white', boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}>
                      {s.n}
                    </div>
                    <h3 className="font-bold text-sm mb-2" style={{ color: '#0F172A' }}>{s.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto rounded-3xl text-center px-10 py-16 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 40%, #2563EB 70%, #3B82F6 100%)', boxShadow: '0 24px 80px rgba(37,99,235,0.4)' }}>
            {/* Orb inside CTA */}
            <div className="absolute pointer-events-none" style={{
              top: -80, right: -80, width: 280, height: 280,
              background: 'radial-gradient(circle, rgba(96,165,250,0.3) 0%, transparent 65%)',
              filter: 'blur(30px)',
            }} />
            <div className="absolute pointer-events-none" style={{
              bottom: -60, left: -60, width: 220, height: 220,
              background: 'radial-gradient(circle, rgba(129,140,248,0.25) 0%, transparent 65%)',
              filter: 'blur(30px)',
            }} />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-7"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#BFDBFE' }}>
                <Activity size={11} />
                Start in 30 seconds
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
                Ready to take control<br />of your lead pipeline?
              </h2>
              <p className="text-blue-200 mb-8 max-w-md mx-auto leading-relaxed text-sm">
                Sign in to your LeadFlow dashboard. Every lead — from any source — is waiting. Your team is one click away.
              </p>
              <button
                onClick={() => onNavigate('login')}
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-white font-black rounded-2xl text-base transition-all hover:scale-[1.03] hover:shadow-2xl"
                style={{ color: '#1E40AF', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
              >
                Get Into the Dashboard <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-8 px-6" style={{ borderTop: '1px solid #E8F0FE' }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                <Target size={13} className="text-white" />
              </div>
              <span className="font-black text-sm" style={{ color: '#0F172A' }}>LeadFlow</span>
            </div>
            <p className="text-xs" style={{ color: '#94A3B8' }}>© 2025 LeadFlow · Internal Platform</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
