import { supabase } from './src/lib/supabase.js';

async function finalCleanup() {
    console.log("Detecting and deleting misaligned Meta leads...");
    
    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, lead_name, email, source')
        .eq('source', 'Meta');

    if (error) {
        console.error(error);
        return;
    }

    const corrupted = leads.filter(l => l.email && l.email.includes('p:+'));
    
    console.log(`Found ${corrupted.length} corrupted leads.`);

    if (corrupted.length > 0) {
        const ids = corrupted.map(l => l.id);
        const { error: delError } = await supabase.from('leads').delete().in('id', ids);
        if (delError) {
            console.error("Delete error:", delError);
        } else {
            console.log("Success! Deleted the last batch of corrupted leads.");
        }
    } else {
        console.log("No more corrupted leads found.");
    }
}

finalCleanup();
