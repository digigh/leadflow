import { supabase } from './src/lib/supabase.js';

async function finalPurge() {
    console.log("Final Purge: Deleting Meta leads with 'p:+' in the email field...");
    
    // Perform a direct server-side delete
    const { data, error } = await supabase
        .from('leads')
        .delete()
        .eq('source', 'Meta')
        .ilike('email', '%p:+%')
        .select();

    if (error) {
        console.error("Purge Error:", error);
    } else {
        console.log(`Successfully purged ${data?.length || 0} corrupted leads.`);
    }

    // Also purge those with source='Meta' that match the March names exactly (just in case they have clean emails but are still Meta source)
    const marchNames = [
        "Nikhil Bansal", "Sudhir Choudhury", "Vinod Narwar", "Lakshmikanth",
        "Ravindra Gaur", "Prabhu Raj", "Rahul Yadav", "VIVEK ITOKAR",
        "Janardhan Reddy Munnelli", "raman jindal", "Santhosh Kumar",
        "Sharad Jain", "Rajan Patel", "Shine view", "Gaurav Arvind Kale",
        "Naren Vanga", "Arun", "Nitish Kumar"
    ];

    const { data: data2, error: error2 } = await supabase
        .from('leads')
        .delete()
        .eq('source', 'Meta')
        .in('lead_name', marchNames)
        .select();

    if (error2) {
        console.error("Name Purge Error:", error2);
    } else {
        console.log(`Successfully purged ${data2?.length || 0} additional misattributed leads.`);
    }
}

finalPurge();
