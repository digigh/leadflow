import { supabase } from './src/lib/supabase.js';

async function rangePurge() {
    console.log("Range Purge: Deleting IDs 1721 to 1740...");
    const { data, error } = await supabase
        .from('leads')
        .delete()
        .gte('id', 1721)
        .lte('id', 1740)
        .select();

    if (error) {
        console.error(error);
    } else {
        console.log(`Deleted ${data?.length || 0} leads in range.`);
    }
}

rangePurge();
