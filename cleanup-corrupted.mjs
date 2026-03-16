import { supabase } from './src/lib/supabase.js';

async function cleanup() {
    console.log("Fetching corrupted leads with source='Meta'...");
    
    // We fetch all Meta leads
    const { data: leads, error } = await supabase.from('leads').select('*').eq('source', 'Meta');
    
    if (error) {
        console.error("Error fetching leads:", error);
        return;
    }
    
    // We know the corrupted ones are the ones from 'New Meta Leads March' that got misattributed.
    // They share these exact names + they have empty 'business_type'
    const newMetaNames = [
        "Nikhil Bansal", "Sudhir Choudhury", "Vinod Narwar", "Lakshmikanth",
        "Ravindra Gaur", "Prabhu Raj", "Rahul Yadav", "VIVEK ITOKAR",
        "Janardhan Reddy Munnelli", "raman jindal", "Santhosh Kumar",
        "Sharad Jain", "Rajan Patel", "Shine view", "Gaurav Arvind Kale",
        "Naren Vanga", "Arun", "Nitish Kumar"
    ];

    const toDelete = leads.filter(l => 
        newMetaNames.includes(l.lead_name) && 
        !l.business_type // Corrupted leads didn't get this populated
    );

    console.log(`Found ${toDelete.length} corrupted leads. Deleting...`);

    if (toDelete.length > 0) {
        const ids = toDelete.map(l => l.id);
        const { error: delError } = await supabase.from('leads').delete().in('id', ids);
        
        if (delError) {
            console.error("Failed to delete corrupted leads:", delError);
        } else {
            console.log("Successfully deleted corrupted leads.");
        }
    } else {
        console.log("No corrupted leads found to delete.");
    }
}

cleanup();
