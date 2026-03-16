import { supabase } from './src/lib/supabase.js';

async function cleanup() {
    console.log("Starting cleanup of misidentified Meta leads...");
    
    // Names that belong to the March Meta sheet but were erroneously imported as 'Meta'
    const marchNames = [
        "Nikhil Bansal", "Sudhir Choudhury", "Vinod Narwar", "Lakshmikanth",
        "Ravindra Gaur", "Prabhu Raj", "Rahul Yadav", "VIVEK ITOKAR",
        "Janardhan Reddy Munnelli", "raman jindal", "Santhosh Kumar",
        "Sharad Jain", "Rajan Patel", "Shine view", "Gaurav Arvind Kale",
        "Naren Vanga", "Arun", "Nitish Kumar", "Ankush Kunar", "Manoj Rajput", "full_name"
    ];

    // Fetch leads with source='Meta' and matching names
    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, lead_name, source, email, phone')
        .eq('source', 'Meta')
        .in('lead_name', marchNames);

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    console.log(`Found ${leads.length} leads to delete.`);

    if (leads.length > 0) {
        const ids = leads.map(l => l.id);
        const { error: delError } = await supabase.from('leads').delete().in('id', ids);
        if (delError) {
            console.error("Delete error:", delError);
        } else {
            console.log("Successfully deleted corrupted Meta leads.");
        }
    } else {
        console.log("No corrupted Meta leads found.");
    }
}

cleanup();
