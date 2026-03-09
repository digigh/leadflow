// ── Status options ──────────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  'New',
  'Contacted',
  'Interested',
  'Follow Up',
  'Converted',
  'Not Interested',
]

// ── Priority options ─────────────────────────────────────────────────────────
export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low']

// ── Team members (Assigned To) ───────────────────────────────────────────────
export const ASSIGNED_OPTIONS = ['Team DIGICIDES']

// ── Status badge Tailwind classes ────────────────────────────────────────────
export const STATUS_STYLES = {
  New: 'bg-blue-50 text-blue-600',
  Contacted: 'bg-indigo-50 text-indigo-600',
  Interested: 'bg-green-50 text-green-600',
  'Follow Up': 'bg-orange-50 text-orange-600',
  Converted: 'bg-emerald-50 text-emerald-700',
  'Not Interested': 'bg-red-50 text-red-600',
}

// ── Status chart colors ──────────────────────────────────────────────────────
export const STATUS_COLORS = {
  New: '#2F6BFF',
  Contacted: '#4A85FF',
  Interested: '#2ECC71',
  'Follow Up': '#F5A623',
  Converted: '#27AE60',
  'Not Interested': '#E74C3C',
}

// ── Priority badge classes ───────────────────────────────────────────────────
export const PRIORITY_COLORS_CLASS = {
  High: 'bg-red-100 text-red-600',
  Medium: 'bg-orange-100 text-orange-600',
  Low: 'bg-green-100 text-green-600',
}

// ── Design tokens ────────────────────────────────────────────────────────────
export const COLORS = {
  primary: '#2F6BFF',
  success: '#2ECC71',
  warning: '#F5A623',
  danger: '#E74C3C',
  purple: '#7B3FFF',
}

// ── Demo / mock leads (shown when Supabase table not set up yet) ─────────────
export const MOCK_LEADS = [
  { id: 1, lead_name: 'Rajesh Kumar', company: 'TechCorp India', email: 'rajesh@techcorp.in', phone: '+91 9876543210', source: 'Website', message: 'Interested in enterprise plan', date: '2025-01-15', job_title: 'CTO', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
  { id: 2, lead_name: 'Dharmendra Rathod', company: 'Ratanveer Enterprise Pvt Ltd', email: 'dkrathod89@gmail.com', phone: '+91 9978953600', source: 'Meta', message: '', date: '2025-01-16', job_title: 'CEO', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
  { id: 3, lead_name: 'Sneha Patel', company: 'FinanceFlow Ltd', email: 'sneha@financeflow.com', phone: '+91 9988776655', source: 'Website', message: 'Need pricing details for SMB', date: '2025-01-17', job_title: 'CFO', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
  { id: 4, lead_name: 'Vikram Singh', company: 'CloudBase Solutions', email: 'vikram@cloudbase.io', phone: '+91 9765432100', source: 'Meta', message: '', date: '2025-01-17', job_title: 'VP Sales', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
  { id: 5, lead_name: 'Anita Sharma', company: 'GreenTech Pvt Ltd', email: 'anita@greentech.com', phone: '+91 9812345678', source: 'Website', message: 'Looking for custom integrations', date: '2025-01-18', job_title: 'Head of IT', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
  { id: 6, lead_name: 'Kavya Reddy', company: 'DataDriven Analytics', email: 'kavya@datadriven.ai', phone: '+91 9123456789', source: 'Website', message: 'Automated reporting feature inquiry', date: '2025-01-20', job_title: 'Data Scientist', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
  { id: 7, lead_name: 'Suresh Nair', company: 'MediSync Healthcare', email: 'suresh@medisync.in', phone: '+91 9876012345', source: 'Meta', message: '', date: '2025-01-21', job_title: 'COO', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
  { id: 8, lead_name: 'Arjun Kapoor', company: 'LogiTrack Pvt Ltd', email: 'arjun@logitrack.in', phone: '+91 9712345678', source: 'Meta', message: '', date: '2025-01-23', job_title: 'CEO', status: null, feedback: null, remarks: null, assigned_to: null, priority: null },
]
