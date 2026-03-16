import { supabase } from './src/lib/supabase.js';

async function precisionPurge() {
    console.log("Precision Purge: Deleting Meta leads that have business_type populated...");
    
    // Remote delete with filters
    const { data, error } = await supabase
        .from('leads')
        .delete()
        .eq('source', 'Meta')
        .not('business_type', 'is', null)
        .select();

    if (error) {
        console.error(error);
    } else {
        console.log(`Successfully purged ${data?.length || 0} corrupted leads with business_type.`);
    }

    // Also check for 'looking_for' and 'website' just in case
    const { data: data2, error: error2 } = await supabase
        .from('leads')
        .delete()
        .eq('source', 'Meta')
        .not('looking_for', 'is', null)
        .select();
    
    if (error2) console.error(error2);
    else console.log(`Successfully purged ${data2?.length || 0} corrupted leads with looking_for.`);

    const { data: data3, error: error3 } = await supabase
        .from('leads')
        .delete()
        .eq('source', 'Meta')
        .not('website', 'is', null)
        .select();
    
    if (error3) console.error(error3);
    else console.log(`Successfully purged ${data3?.length || 0} corrupted leads with website.`);
}

precisionPurge();
