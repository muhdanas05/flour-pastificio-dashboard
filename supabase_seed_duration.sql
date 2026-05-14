-- ─────────────────────────────────────────────────────────────────────────────
-- Sala Smart — Backfill duration_minutes on seeded reservations
-- Run AFTER supabase_schema_additions.sql has been applied.
-- ─────────────────────────────────────────────────────────────────────────────

-- Vary duration by party size to make the demo data realistic
UPDATE reservations SET duration_minutes = 90  WHERE party_size <= 2;
UPDATE reservations SET duration_minutes = 120 WHERE party_size BETWEEN 3 AND 5;
UPDATE reservations SET duration_minutes = 150 WHERE party_size >= 6;
