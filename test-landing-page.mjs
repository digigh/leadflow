import { supabase } from './src/lib/supabase.js';

async function test() {
    const { data: byEmail, error: err1 } = await supabase.from('leads').select('*').eq('email', 'ankush.kumar@digicides.com');
    console.log("By Email:", byEmail);

    const { data: byPhone, error: err2 } = await supabase.from('leads').select('*').like('phone', '%7895776124%');
    console.log("By Phone:", byPhone);
}
test();
