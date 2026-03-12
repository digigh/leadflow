import { createClient } from '@supabase/supabase-js'

const env = typeof process !== 'undefined' ? process.env : (import.meta && import.meta.env ? import.meta.env : {});
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://jzzjbwonvntlznrcquaf.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6empid29udm50bHpucmNxdWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Mjg0NDAsImV4cCI6MjA4MzIwNDQ0MH0.Ej5PcbPXXEA0-o_qcZatoU2uNS2Wms_s1uT5sCXj47g';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Supabase env vars not found. Check your .env file.')
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)
