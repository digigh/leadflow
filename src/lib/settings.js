/**
 * LeadFlow Settings — persisted in Supabase
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
import { supabase } from './supabase'

export const DEFAULT_COLUMNS = [
    { key: 'lead_name', label: 'Lead', removable: false },
    { key: 'company', label: 'Company', removable: true },
    { key: 'contact', label: 'Contact', removable: true },
    { key: 'source', label: 'Source', removable: true },
    { key: 'business_type', label: 'Business Type', removable: true },
    { key: 'looking_for', label: 'Looking For', removable: true },
    { key: 'website', label: 'Website', removable: true },
    { key: 'date', label: 'Date', removable: true },
    { key: 'follow_up_at', label: 'Follow-up', removable: true },
    { key: 'status', label: 'Status', removable: false },
    { key: 'priority', label: 'Priority', removable: true },
    { key: 'assigned_to', label: 'Assigned To', removable: true },
    { key: 'actions', label: 'Actions', removable: false },
]

export const DEFAULT_SETTINGS = {
    statusOptions: [...STATUS_OPTIONS],
    priorityOptions: [...PRIORITY_OPTIONS],
    assignedOptions: [...ASSIGNED_OPTIONS],
    columnVisibility: Object.fromEntries(DEFAULT_COLUMNS.map(c => [c.key, true])),
    customColumns: [],
}

export async function loadSettings() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('config')
            .eq('id', 1)
            .single()

        if (error && error.code !== 'PGRST116') { // Ignore "No rows found"
            console.error('Error loading settings from DB:', error)
        }

        if (data && data.config) {
            const parsed = typeof data.config === 'string' ? JSON.parse(data.config) : data.config
            // Merge defaults so new keys always exist
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                columnVisibility: { ...DEFAULT_SETTINGS.columnVisibility, ...(parsed.columnVisibility || {}) },
            }
        }
    } catch (err) {
        console.error('Failed to parse DB settings fallback to default:', err)
    }
    
    return structuredClone(DEFAULT_SETTINGS)
}

export async function saveSettings(settings) {
    try {
        const payload = typeof settings === 'string' ? JSON.parse(settings) : settings
        const { error } = await supabase
            .from('settings')
            .upsert({ id: 1, config: payload })

        if (error) {
            console.error('Error upserting settings:', error)
        }
    } catch (err) {
        console.error('Error saving settings DB request:', err)
    }
}

export async function resetSettings() {
    try {
        await supabase.from('settings').delete().eq('id', 1)
    } catch (err) {
        console.error('Error resetting settings in DB:', err)
    }
    return structuredClone(DEFAULT_SETTINGS)
}
