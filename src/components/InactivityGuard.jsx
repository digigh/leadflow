import { useState, useEffect, useRef, useCallback } from 'react'
import { Clock, LogIn, AlertCircle } from 'lucide-react'

const WARN_BEFORE_MS = 60 * 1000 // Show warning 1 minute before logout

export default function InactivityGuard({ children, timeoutMs, onLogout }) {
    const [warning, setWarning] = useState(false)     // show the warning modal
    const [secondsLeft, setSecondsLeft] = useState(60) // countdown in modal

    const logoutTimer = useRef(null)
    const warnTimer = useRef(null)
    const countdownRef = useRef(null)

    const doLogout = useCallback(() => {
        clearTimeout(logoutTimer.current)
        clearTimeout(warnTimer.current)
        clearInterval(countdownRef.current)
        setWarning(false)
        onLogout()
    }, [onLogout])

    const resetTimers = useCallback(() => {
        // If modal is already showing, don't reset — user must click to stay
        if (warning) return

        clearTimeout(logoutTimer.current)
        clearTimeout(warnTimer.current)
        clearInterval(countdownRef.current)
        setSecondsLeft(60)

        // Schedule warning
        warnTimer.current = setTimeout(() => {
            setWarning(true)
            setSecondsLeft(60)

            // Countdown every second inside the modal
            countdownRef.current = setInterval(() => {
                setSecondsLeft(s => {
                    if (s <= 1) {
                        clearInterval(countdownRef.current)
                        return 0
                    }
                    return s - 1
                })
            }, 1000)
        }, timeoutMs - WARN_BEFORE_MS)

        // Schedule actual logout
        logoutTimer.current = setTimeout(() => {
            doLogout()
        }, timeoutMs)
    }, [timeoutMs, warning, doLogout])

    // Track activity events
    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
        const onActivity = () => resetTimers()
        events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))
        resetTimers() // start the timer on mount
        return () => {
            events.forEach(ev => window.removeEventListener(ev, onActivity))
            clearTimeout(logoutTimer.current)
            clearTimeout(warnTimer.current)
            clearInterval(countdownRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // intentionally only on mount — resetTimers is stable-ish

    const handleStayLoggedIn = () => {
        setWarning(false)
        clearInterval(countdownRef.current)
        resetTimers()
    }

    return (
        <>
            {children}

            {/* ─── Inactivity Warning Modal ─────────────────────────────────────── */}
            {warning && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                        {/* Top accent bar */}
                        <div className="h-1.5 bg-gradient-to-r from-orange-400 to-red-500" />

                        <div className="p-8">
                            {/* Icon + heading */}
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4">
                                    <Clock size={30} className="text-orange-500" />
                                </div>
                                <h2 className="text-xl font-black text-[#2F3542] mb-1">Session Expiring Soon</h2>
                                <p className="text-[#6B778C] text-sm leading-relaxed">
                                    No activity detected for the past <strong>9 minutes</strong>.
                                    Your session will automatically end in:
                                </p>
                            </div>

                            {/* Countdown */}
                            <div className="flex items-center justify-center mb-6">
                                <div className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-colors ${secondsLeft <= 15 ? 'border-red-400 bg-red-50' : 'border-orange-400 bg-orange-50'
                                    }`}>
                                    <span className={`text-3xl font-black tabular-nums ${secondsLeft <= 15 ? 'text-red-500' : 'text-orange-500'}`}>
                                        {secondsLeft}
                                    </span>
                                    <span className={`text-xs font-semibold ${secondsLeft <= 15 ? 'text-red-400' : 'text-orange-400'}`}>
                                        seconds
                                    </span>
                                </div>
                            </div>

                            {/* Info notice */}
                            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl mb-6 text-sm">
                                <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-amber-700">
                                    For your security, the platform logs out inactive sessions automatically. Any unsaved changes will remain in the database.
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleStayLoggedIn}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#2F6BFF] text-white font-bold rounded-xl hover:bg-[#1A4FCC] transition-colors shadow-lg shadow-blue-500/25"
                                >
                                    <LogIn size={16} />
                                    Stay Logged In
                                </button>
                                <button
                                    onClick={doLogout}
                                    className="px-5 py-3 border border-[#E6EBF2] text-[#6B778C] font-semibold rounded-xl hover:bg-[#F4F6F9] transition-colors text-sm"
                                >
                                    Log Out Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
