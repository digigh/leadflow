/**
 * LeadFlow Settings — persisted in localStorage
 *
 * Shape:
 * {
 *   statusOptions:   string[]
 *   priorityOptions: string[]
 *   assignedOptions: string[]
 *   columnVisibility: { [columnKey]: boolean }
 *   customColumns:   { key: string, label: string, type: 'text'|'number'|'date' }[]
 * }
 */

import {
    STATUS_OPTIONS,
    PRIORITY_OPTIONS,
    ASSIGNED_OPTIONS,
} from './constants'

const LS_KEY = 'lf_settings'

export const DEFAULT_COLUMNS = [
    { key: 'lead_name', label: 'Lead', removable: false },
    { key: 'company', label: 'Company', removable: true },
    { key: 'contact', label: 'Contact', removable: true },
    { key: 'source', label: 'Source', removable: true },
    { key: 'date', label: 'Date', removable: true },
    { key: 'follow_up_at', label: 'Follow-up', removable: true },
    { key: 'status', label: 'Status', removable: false },
    { key: 'priority', label: 'Priority', removable: true },
    { key: 'assigned_to', label: 'Assigned To', removable: true },
    { key: 'actions', label: 'Actions', removable: false },
]

const DEFAULT_SETTINGS = {
    statusOptions: [...STATUS_OPTIONS],
    priorityOptions: [...PRIORITY_OPTIONS],
    assignedOptions: [...ASSIGNED_OPTIONS],
    columnVisibility: Object.fromEntries(DEFAULT_COLUMNS.map(c => [c.key, true])),
    customColumns: [],
}

export function loadSettings() {
    try {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return structuredClone(DEFAULT_SETTINGS)
        const parsed = JSON.parse(raw)
        // Merge defaults so new keys always exist
        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            columnVisibility: { ...DEFAULT_SETTINGS.columnVisibility, ...(parsed.columnVisibility || {}) },
        }
    } catch {
        return structuredClone(DEFAULT_SETTINGS)
    }
}

export function saveSettings(settings) {
    localStorage.setItem(LS_KEY, JSON.stringify(settings))
}

export function resetSettings() {
    localStorage.removeItem(LS_KEY)
    return structuredClone(DEFAULT_SETTINGS)
}
