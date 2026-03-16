import { supabase } from './src/lib/supabase.js';

async function verify() {
    const { data, error } = await supabase.from('leads').select('*').ilike('lead_name', '%Rahul Yadav%');
    if (error) {
        console.error(error);
    } else {
        console.log("Found leads for Rahul Yadav:");
        console.log(JSON.stringify(data, null, 2));
    }
}

verify();
