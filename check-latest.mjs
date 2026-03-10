import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jzzjbwonvntlznrcquaf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6empid29udm50bHpucmNxdWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Mjg0NDAsImV4cCI6MjA4MzIwNDQ0MH0.Ej5PcbPXXEA0-o_qcZatoU2uNS2Wms_s1uT5sCXj47g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLeads() {
    const { data: existing } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(20);
    console.log(`Latest existing leads:`, existing.map(l => ({ name: l.lead_name, email: l.email, phone: l.phone, source: l.source })));
}

checkLeads();
