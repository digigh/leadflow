import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load .env manual parsing to guarantee compatibility with ESM without dotenv dependency issues
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('[YOUR-PASSWORD]') || connectionString.includes('[password]')) {
  console.error('❌ Error: SUPABASE_DB_URL is not configured with your actual database password.');
  console.log('Please add your database connection string with the correct password to your local .env file:');
  console.log('SUPABASE_DB_URL=postgresql://postgres:[password]@db.ypcozvgrdaloegxbozsz.supabase.co:5432/postgres');
  process.exit(1);
}

const pool = new pg.Pool({ 
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function run() {
  console.log('🔄 Connecting to Supabase Postgres database...');
  try {
    const client = await pool.connect();
    
    console.log('⚡ Dropping "leads_status_check" constraint if exists...');
    await client.query('ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;');
    
    console.log('⚡ Dropping "leads_priority_check" constraint if exists...');
    await client.query('ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_priority_check;');
    
    console.log('✅ Success! Check constraints successfully removed. Custom status/priority options are now supported!');
    client.release();
  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.error('👉 Tip: Double check that you replaced [YOUR-PASSWORD] with your actual Supabase database password in the .env connection string.');
    }
  } finally {
    await pool.end();
  }
}

run();
