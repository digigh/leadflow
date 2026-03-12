-- ============================================================
-- LeadFlow — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. LEADS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id            BIGSERIAL PRIMARY KEY,
  lead_name     TEXT NOT NULL,
  company       TEXT,
  email         TEXT,
  phone         TEXT,
  source        TEXT CHECK (source IN ('Website', 'Meta', 'Landing Page 2')),
  message       TEXT,
  date          TIMESTAMPTZ,
  job_title     TEXT,

  -- Filled by your team (blank by default)
  status        TEXT,
  priority      TEXT,
  assigned_to   TEXT,
  feedback      TEXT,
  remarks       TEXT,
  follow_up_at  TIMESTAMPTZ,   -- scheduled follow-up date & time

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing DBs:
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('Website', 'Meta', 'Landing Page 2'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ;

-- 2. AUTO-UPDATE updated_at ON EVERY EDIT
-- -------------------------------------------------------------
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

-- 3. ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow anon key to read all leads
CREATE POLICY "allow_select" ON leads
  FOR SELECT USING (true);

-- Allow anon key to insert new leads (from Google Sheets sync)
CREATE POLICY "allow_insert" ON leads
  FOR INSERT WITH CHECK (true);

-- Allow anon key to update leads (status, feedback, remarks etc.)
CREATE POLICY "allow_update" ON leads
  FOR UPDATE USING (true);

-- 4. END OF SCHEMA
