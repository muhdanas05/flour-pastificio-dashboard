-- ─────────────────────────────────────────────────────────────────────────────
-- Sala Smart — Schema Additions (run in Supabase SQL Editor)
-- Run AFTER supabase_schema.sql has already been applied.
-- Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS equivalents).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add duration_minutes to reservations
--    Default 90 min. Required for table conflict detection:
--    a booking at 20:00 for 90 min blocks the table until 21:30.
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 90;

-- 2. Create call_logs table (written by voice agent; frontend display deferred)
CREATE TABLE IF NOT EXISTS call_logs (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id    UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_id   UUID REFERENCES reservations(id) ON DELETE SET NULL,
  call_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_seconds INT,
  outcome          TEXT CHECK (outcome IN ('booked', 'cancelled', 'escalated', 'no_answer', 'other')),
  transcript       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE call_logs DISABLE ROW LEVEL SECURITY;
