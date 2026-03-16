import { supabase } from './src/lib/supabase.js';

async function checkColumns() {
    console.log("Fetching one lead to inspect columns...");
    const { data, error } = await supabase.from('leads').select('*').limit(1);

    if (error) {
        console.error("Supabase Error:", error);
    } else {
        if (data && data.length > 0) {
            console.log("Columns found in Supabase leads table:");
            console.log(Object.keys(data[0]));
        } else {
            console.log("Table is empty, trying to insert an empty row to check constraints...");
            const { error: insertError } = await supabase.from('leads').insert([{ lead_name: "Test Check" }]).select();
            if (insertError) {
                console.error("Insert Error checking columns:", insertError);
            } else {
                console.log("Successfully inserted a dummy row to inspect.");
                const { data: newData } = await supabase.from('leads').select('*').limit(1);
                if (newData && newData.length > 0) {
                    console.log("Columns found:");
                    console.log(Object.keys(newData[0]));
                    // Cleanup
                    await supabase.from('leads').delete().eq('id', newData[0].id);
                }
            }
        }
    }
}

checkColumns();
