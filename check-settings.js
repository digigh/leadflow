import { supabase } from './src/lib/supabase.js'

async function checkSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1)
  console.log('Settings Data:', data)
  console.log('Settings Error:', error)
}

checkSettings()
