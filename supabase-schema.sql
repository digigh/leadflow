-- ============================================================
-- LeadFlow — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS
-- ============================================================


-- ── 1. LEADS TABLE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id            BIGSERIAL PRIMARY KEY,
  lead_name     TEXT NOT NULL,
  company       TEXT,
  email         TEXT,
  phone         TEXT,
  source        TEXT,           -- no CHECK constraint — any source string allowed
  message       TEXT,
  date          TIMESTAMPTZ,
  job_title     TEXT,
  business_type TEXT,
  looking_for   TEXT,
  website       TEXT,
  sync_key      TEXT,           -- dedup key: "lower(email)|digits-only-phone"

  -- Filled by your team (never overwritten by sync)
  status        TEXT,
  priority      TEXT,
  assigned_to   TEXT,
  feedback      TEXT,
  remarks       TEXT,
  follow_up_at  TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ── 2. MIGRATIONS FOR EXISTING DATABASES ─────────────────────────────────────
-- Add any missing columns to an existing leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_at  TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS looking_for   TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website       TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sync_key      TEXT;

-- Remove old restrictive source CHECK constraint (blocked custom sources)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;


-- ── 3. DEDUPLICATION MIGRATION (run once to clean existing duplicates) ────────
-- Step A: Populate sync_key for all existing leads that don't have one
UPDATE leads
SET sync_key = lower(coalesce(trim(email), ''))
               || '|'
               || regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
WHERE sync_key IS NULL;

-- Step B: Remove rows where sync_key is empty (no email and no phone — bad data)
DELETE FROM leads WHERE sync_key = '|' OR sync_key IS NULL;

-- Step C: For each duplicate sync_key group, keep only the row with the lowest id
DELETE FROM leads a
USING leads b
WHERE a.sync_key IS NOT NULL
  AND a.sync_key != '|'
  AND a.sync_key = b.sync_key
  AND a.id > b.id;


-- ── 4. UNIQUE INDEX ON sync_key (enables upsert without duplicates) ───────────
CREATE UNIQUE INDEX IF NOT EXISTS leads_sync_key_uq
  ON leads(sync_key)
  WHERE sync_key IS NOT NULL AND sync_key != '|';


-- ── 5. AUTO-UPDATE updated_at ON EVERY EDIT ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON leads;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ── 6. ROW LEVEL SECURITY — LEADS ────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select" ON leads;
CREATE POLICY "allow_select" ON leads FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_insert" ON leads;
CREATE POLICY "allow_insert" ON leads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "allow_update" ON leads;
CREATE POLICY "allow_update" ON leads FOR UPDATE USING (true);

DROP POLICY IF EXISTS "allow_delete" ON leads;
CREATE POLICY "allow_delete" ON leads FOR DELETE USING (true);


-- ── 7. LEAD QUALIFICATIONS TABLE ─────────────────────────────────────────────
-- Stores scores and qualification data per lead (joined as lead_qualifications(*) in Dashboard)
CREATE TABLE IF NOT EXISTS lead_qualifications (
  id             BIGSERIAL PRIMARY KEY,
  lead_id        BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  score          INTEGER DEFAULT 0,
  budget         TEXT,
  timeline       TEXT,
  decision_maker BOOLEAN,
  industry       TEXT,
  pain_point     TEXT,
  company_name   TEXT,
  notes          TEXT,
  qualified_by   TEXT,
  qualified_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)
);

CREATE OR REPLACE FUNCTION update_lead_qualifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_lq_updated_at ON lead_qualifications;
CREATE TRIGGER set_lq_updated_at
  BEFORE UPDATE ON lead_qualifications
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_qualifications_updated_at();

ALTER TABLE lead_qualifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_lead_qualifications" ON lead_qualifications;
CREATE POLICY "allow_all_lead_qualifications" ON lead_qualifications FOR ALL USING (true) WITH CHECK (true);


-- ── 8. SETTINGS TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  config     JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_settings" ON settings;
CREATE POLICY "allow_all_settings" ON settings FOR ALL USING (true) WITH CHECK (true);


-- ── DONE ─────────────────────────────────────────────────────────────────────
-- After running this script:
-- 1. Your existing duplicate leads are removed (lowest id is kept per email/phone pair)
-- 2. Future syncs use upsert — no more duplicates
-- 3. lead_qualifications and settings tables are created
