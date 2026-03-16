import { supabase } from './src/lib/supabase.js';

async function listMeta() {
    const { data, error } = await supabase.from('leads').select('id, lead_name, email, phone').eq('source', 'Meta');
    if (error) {
        console.error(error);
    } else {
        console.log("Current Meta Source Leads:");
        console.log(JSON.stringify(data, null, 2));
    }
}

listMeta();
