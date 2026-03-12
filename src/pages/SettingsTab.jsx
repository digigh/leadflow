import { useState } from 'react'
import {
    Settings, Plus, Trash2, GripVertical, Eye, EyeOff, RotateCcw,
    Save, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Database, Columns3, ListChecks
} from 'lucide-react'
import { loadSettings, saveSettings, resetSettings, DEFAULT_COLUMNS } from '../lib/settings'

const SECTION_ICONS = { dropdowns: ListChecks, columns: Columns3, sql: Database }

// ── Colour palette for new status values ──────────────────────────────────────
const BADGE_COLORS = [
    { label: 'Blue', bg: 'bg-blue-50', text: 'text-blue-600' },
    { label: 'Green', bg: 'bg-green-50', text: 'text-green-600' },
    { label: 'Orange', bg: 'bg-orange-50', text: 'text-orange-600' },
    { label: 'Red', bg: 'bg-red-50', text: 'text-red-600' },
    { label: 'Purple', bg: 'bg-purple-50', text: 'text-purple-600' },
    { label: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-600' },
    { label: 'Teal', bg: 'bg-teal-50', text: 'text-teal-600' },
]

function TagEditor({ label, values, onChange }) {
    const [input, setInput] = useState('')
    const add = () => {
        const v = input.trim()
        if (!v || values.includes(v)) return
        onChange([...values, v])
        setInput('')
    }
    const remove = (val) => onChange(values.filter(v => v !== val))
    return (
        <div>
            <p className="text-xs font-bold text-[#6B778C] uppercase tracking-wide mb-2">{label}</p>
            <div className="flex flex-wrap gap-2 mb-3">
                {values.map(v => (
                    <span key={v} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4F6F9] rounded-lg text-sm font-medium text-[#2F3542] border border-[#E6EBF2]">
                        {v}
                        <button onClick={() => remove(v)} className="text-gray-400 hover:text-red-500 transition-colors ml-0.5">
                            <Trash2 size={11} />
                        </button>
                    </span>
                ))}
                {values.length === 0 && <p className="text-sm text-gray-400 italic">No options — add at least one</p>}
            </div>
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && add()}
                    placeholder={`Add new ${label.toLowerCase()} option…`}
                    className="flex-1 text-sm border border-[#E6EBF2] rounded-lg px-3 py-2 focus:outline-none focus:border-[#2F6BFF] focus:ring-2 focus:ring-[#2F6BFF]/10"
                />
                <button onClick={add}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#2F6BFF] text-white text-sm font-bold rounded-lg hover:bg-[#1A4FCC] transition-colors">
                    <Plus size={14} /> Add
                </button>
            </div>
        </div>
    )
}

function SectionCard({ id, title, subtitle, icon: Icon, open, onToggle, children }) {
    return (
        <div className="bg-white rounded-2xl border border-[#E6EBF2] shadow-sm overflow-hidden">
            <button className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#FAFBFC] transition-colors"
                onClick={onToggle}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E9F2FF] flex items-center justify-center">
                        <Icon size={18} className="text-[#2F6BFF]" />
                    </div>
                    <div>
                        <p className="font-bold text-[#2F3542] text-sm">{title}</p>
                        <p className="text-xs text-[#9AA5B1] mt-0.5">{subtitle}</p>
                    </div>
                </div>
                {open ? <ChevronUp size={16} className="text-[#9AA5B1]" /> : <ChevronDown size={16} className="text-[#9AA5B1]" />}
            </button>
            {open && <div className="border-t border-[#E6EBF2] px-6 py-5">{children}</div>}
        </div>
    )
}

export default function SettingsTab({ settings, onSettingsChange }) {
    const [localSettings, setLocalSettings] = useState(() => ({ ...settings }))
    const [openSection, setOpenSection] = useState('dropdowns')
    const [saved, setSaved] = useState(false)
    const [newColLabel, setNewColLabel] = useState('')
    const [newColType, setNewColType] = useState('text')
    const [sqlPreview, setSqlPreview] = useState(null)

    const update = (key, val) => setLocalSettings(s => ({ ...s, [key]: val }))

    const handleSave = () => {
        saveSettings(localSettings)
        onSettingsChange(localSettings)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    const handleReset = () => {
        const fresh = resetSettings()
        setLocalSettings(fresh)
        onSettingsChange(fresh)
    }

    // Column visibility toggle
    const toggleColumn = (key) => {
        setLocalSettings(s => ({
            ...s,
            columnVisibility: { ...s.columnVisibility, [key]: !s.columnVisibility[key] },
        }))
    }

    // Add custom column
    const addCustomColumn = () => {
        const label = newColLabel.trim()
        if (!label) return
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        if (!key) return
        const col = { key, label, type: newColType }
        const updated = {
            ...localSettings,
            customColumns: [...(localSettings.customColumns || []), col],
            columnVisibility: { ...localSettings.columnVisibility, [key]: true },
        }
        setLocalSettings(updated)
        setSqlPreview(generateSQL(col))
        setNewColLabel('')
        setNewColType('text')
    }

    const removeCustomColumn = (key) => {
        setLocalSettings(s => ({
            ...s,
            customColumns: s.customColumns.filter(c => c.key !== key),
            columnVisibility: { ...s.columnVisibility, [key]: false },
        }))
        setSqlPreview(null)
    }

    const generateSQL = (col) => {
        const sqlType = col.type === 'number' ? 'NUMERIC' : col.type === 'date' ? 'TIMESTAMPTZ' : 'TEXT'
        return `ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col.key} ${sqlType};`
    }

    const allColumns = [
        ...DEFAULT_COLUMNS,
        ...(localSettings.customColumns || []).map(c => ({ ...c, removable: true, isCustom: true })),
    ]

    return (
        <div className="space-y-5 max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-[#2F3542]">Platform Settings</h2>
                    <p className="text-sm text-[#9AA5B1] mt-0.5">Customize dropdowns, table columns, and data fields</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleReset}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[#6B778C] border border-[#E6EBF2] rounded-xl hover:bg-[#F4F6F9] transition-colors">
                        <RotateCcw size={14} /> Reset Defaults
                    </button>
                    <button onClick={handleSave}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-[#2F6BFF] text-white text-sm font-bold rounded-xl hover:bg-[#1A4FCC] transition-colors shadow-lg shadow-blue-500/20">
                        {saved ? <><CheckCircle2 size={14} />Saved!</> : <><Save size={14} />Save Settings</>}
                    </button>
                </div>
            </div>

            {/* ── Section 1: Dropdown Options ─────────────────────────────────────── */}
            <SectionCard
                id="dropdowns" icon={ListChecks}
                title="Dropdown Options"
                subtitle="Edit the values available in Status, Priority, and Assigned To dropdowns"
                open={openSection === 'dropdowns'}
                onToggle={() => setOpenSection(o => o === 'dropdowns' ? null : 'dropdowns')}
            >
                <div className="space-y-8">
                    <TagEditor
                        label="Status Options"
                        values={localSettings.statusOptions}
                        onChange={v => update('statusOptions', v)}
                    />
                    <div className="border-t border-[#F0F4F8]" />
                    <TagEditor
                        label="Priority Options"
                        values={localSettings.priorityOptions}
                        onChange={v => update('priorityOptions', v)}
                    />
                    <div className="border-t border-[#F0F4F8]" />
                    <TagEditor
                        label="Assigned To Options"
                        values={localSettings.assignedOptions}
                        onChange={v => update('assignedOptions', v)}
                    />
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-2.5">
                        <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                        <div className="space-y-3 w-full">
                            <p className="text-xs text-amber-700 leading-relaxed">
                                Changes take effect immediately after clicking <strong>Save Settings</strong>.
                                Leads already assigned a deleted option will keep that value — only new assignments will use the updated list.
                            </p>
                            <div className="w-full h-px bg-amber-200/60" />
                            <div>
                                <p className="text-xs text-amber-900 font-bold mb-1">
                                    🚀 Getting "Check Constraint" Database Errors?
                                </p>
                                <p className="text-xs text-amber-800 leading-relaxed mb-2">
                                    If leads fail to save with your new custom status, Supabase is blocking it. Run this to allow any custom status:
                                </p>
                                <div className="bg-white border border-amber-200 rounded-lg p-3 relative group">
                                    <pre className="text-[11px] font-mono text-amber-900 whitespace-pre-wrap select-all">ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_priority_check;</pre>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            navigator.clipboard.writeText('ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;\nALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_priority_check;');
                                        }}
                                        className="absolute top-2 right-2 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all font-bold shadow-sm"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* ── Section 2: Column Visibility ─────────────────────────────────────── */}
            <SectionCard
                id="columns" icon={Columns3}
                title="Table Columns"
                subtitle="Show or hide columns in the Leads table and Analytics"
                open={openSection === 'columns'}
                onToggle={() => setOpenSection(o => o === 'columns' ? null : 'columns')}
            >
                <div className="space-y-2">
                    {allColumns.map(col => {
                        const visible = localSettings.columnVisibility[col.key] !== false
                        const canToggle = col.removable
                        return (
                            <div key={col.key}
                                className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#E6EBF2] hover:border-[#CBD5E0] transition-colors">
                                <div className="flex items-center gap-3">
                                    <GripVertical size={14} className="text-[#C5CDD8]" />
                                    <div>
                                        <p className="text-sm font-semibold text-[#2F3542]">{col.label}</p>
                                        <p className="text-[10px] text-[#9AA5B1] font-mono">{col.key}</p>
                                    </div>
                                    {col.isCustom && (
                                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-bold rounded-full">CUSTOM</span>
                                    )}
                                    {!col.removable && (
                                        <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[9px] font-bold rounded-full">REQUIRED</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {col.isCustom && (
                                        <button onClick={() => removeCustomColumn(col.key)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                    <button
                                        disabled={!canToggle}
                                        onClick={() => canToggle && toggleColumn(col.key)}
                                        className={`w-9 h-5 rounded-full transition-colors relative ${visible && canToggle ? 'bg-[#2F6BFF]' : visible && !canToggle ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200'}`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${visible && canToggle ? 'left-[18px]' : 'left-0.5'}`} />
                                    </button>
                                    {visible ? <Eye size={14} className="text-[#2F6BFF]" /> : <EyeOff size={14} className="text-[#C5CDD8]" />}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </SectionCard>

            {/* ── Section 3: Custom Columns / SQL generator ───────────────────────── */}
            <SectionCard
                id="sql" icon={Database}
                title="Add Custom Column"
                subtitle="Add a new custom data field — generates the SQL to run in your database"
                open={openSection === 'sql'}
                onToggle={() => setOpenSection(o => o === 'sql' ? null : 'sql')}
            >
                <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-[#6B778C] mb-1.5">Column Label</label>
                            <input
                                value={newColLabel}
                                onChange={e => setNewColLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addCustomColumn()}
                                placeholder="e.g. Budget, Lead Score, City…"
                                className="w-full text-sm border border-[#E6EBF2] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#2F6BFF] focus:ring-2 focus:ring-[#2F6BFF]/10"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#6B778C] mb-1.5">Data Type</label>
                            <select value={newColType} onChange={e => setNewColType(e.target.value)}
                                className="w-full text-sm border border-[#E6EBF2] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#2F6BFF] text-[#2F3542]">
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="date">Date / Time</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={addCustomColumn}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#2F6BFF] text-white text-sm font-bold rounded-xl hover:bg-[#1A4FCC] transition-colors shadow-lg shadow-blue-500/20">
                        <Plus size={14} /> Add Column
                    </button>

                    {/* SQL Preview */}
                    {sqlPreview && (
                        <div className="bg-[#0F172A] rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                                    <Database size={11} />
                                    Run this in your database SQL Editor
                                </p>
                                <button
                                    onClick={() => navigator.clipboard.writeText(sqlPreview)}
                                    className="text-[10px] text-slate-400 hover:text-white transition-colors font-medium"
                                >
                                    Copy
                                </button>
                            </div>
                            <pre className="text-sm text-blue-300 font-mono whitespace-pre-wrap break-all">{sqlPreview}</pre>
                            <p className="text-[10px] text-slate-500 mt-2">
                                The column is now visible in the Leads table. Run the SQL above to enable saving data to the database.
                            </p>
                        </div>
                    )}

                    {/* Existing custom columns summary */}
                    {(localSettings.customColumns || []).length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-[#6B778C] uppercase tracking-wide mb-2">Your Custom Columns</p>
                            <div className="space-y-2">
                                {localSettings.customColumns.map(col => (
                                    <div key={col.key} className="flex items-center justify-between p-3 bg-[#F8FAFF] border border-[#E6EBF2] rounded-xl">
                                        <div>
                                            <span className="text-sm font-semibold text-[#2F3542]">{col.label}</span>
                                            <span className="ml-2 text-[10px] text-[#9AA5B1] font-mono">{col.key}</span>
                                            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold">{col.type.toUpperCase()}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setSqlPreview(generateSQL(col))}
                                                className="text-xs text-[#2F6BFF] font-semibold hover:underline">View SQL</button>
                                            <button onClick={() => removeCustomColumn(col.key)}
                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-2.5">
                        <AlertCircle size={15} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700 leading-relaxed">
                            Adding a column here updates the <strong>visible table</strong> immediately. To permanently store data for this column,
                            run the generated SQL in your database's SQL Editor (Supabase → SQL Editor). The column will then persist across sessions.
                        </p>
                    </div>
                </div>
            </SectionCard>

            {/* Save button bottom */}
            <div className="flex justify-end pt-2">
                <button onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 bg-[#2F6BFF] text-white font-bold rounded-xl hover:bg-[#1A4FCC] transition-colors shadow-lg shadow-blue-500/20">
                    {saved ? <><CheckCircle2 size={16} />All settings saved!</> : <><Save size={16} />Save All Settings</>}
                </button>
            </div>
        </div>
    )
}
