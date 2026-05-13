-- ============================================================
-- Sala Smart — New Schema
-- Run this ONCE in the Supabase SQL editor.
-- It drops all old tables and creates the new structure.
-- ============================================================

-- Drop old tables (order matters for FK constraints)
DROP TABLE IF EXISTS seat_availability  CASCADE;
DROP TABLE IF EXISTS weekly_metrics     CASCADE;
DROP TABLE IF EXISTS daily_stats        CASCADE;
DROP TABLE IF EXISTS allergy_alerts     CASCADE;
DROP TABLE IF EXISTS escalations        CASCADE;
DROP TABLE IF EXISTS reservations       CASCADE;
DROP TABLE IF EXISTS clients            CASCADE;

-- ── restaurants ───────────────────────────────────────────────
CREATE TABLE restaurants (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT    NOT NULL,
  slug              TEXT    UNIQUE,
  address           TEXT,
  phone_number      TEXT,
  vapi_assistant_id TEXT,
  agent_name        TEXT,
  booking_mode      TEXT    DEFAULT 'seats'
                    CHECK (booking_mode IN ('seats', 'tables')),
  timezone          TEXT    DEFAULT 'Europe/Rome',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── opening_hours ─────────────────────────────────────────────
-- One row per weekday per restaurant.
-- day_of_week: 0 = Sunday, 1 = Monday … 6 = Saturday
CREATE TABLE opening_hours (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID    REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week   INT     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time     TIME    NOT NULL,
  close_time    TIME    NOT NULL,
  max_covers    INT     DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  UNIQUE(restaurant_id, day_of_week)
);

-- ── closures ──────────────────────────────────────────────────
-- Specific dates the restaurant is fully closed.
CREATE TABLE closures (
  id            UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID  REFERENCES restaurants(id) ON DELETE CASCADE,
  date          DATE  NOT NULL,
  reason        TEXT,
  UNIQUE(restaurant_id, date)
);

-- ── restaurant_tables ─────────────────────────────────────────
-- Physical tables — only relevant when booking_mode = 'tables'.
CREATE TABLE restaurant_tables (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID    REFERENCES restaurants(id) ON DELETE CASCADE,
  table_name    TEXT    NOT NULL,
  capacity      INT     NOT NULL,
  is_active     BOOLEAN DEFAULT true
);

-- ── customers ─────────────────────────────────────────────────
-- Lightweight CRM keyed by phone number per restaurant.
CREATE TABLE customers (
  id            UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID  REFERENCES restaurants(id) ON DELETE CASCADE,
  phone         TEXT,
  name          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, phone)
);

-- ── reservations ──────────────────────────────────────────────
CREATE TABLE reservations (
  id              UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   UUID  REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id     UUID  REFERENCES customers(id),
  table_id        UUID  REFERENCES restaurant_tables(id),
  customer_name   TEXT  NOT NULL,
  customer_phone  TEXT,
  date            DATE  NOT NULL,
  time            TIME  NOT NULL,
  party_size      INT   NOT NULL DEFAULT 1,
  status          TEXT  DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'arrived', 'no_show', 'cancelled')),
  notes           TEXT,
  source          TEXT  DEFAULT 'manual'
                  CHECK (source IN ('agent', 'manual')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── escalations ───────────────────────────────────────────────
-- Written by voice agent. restaurant_id replaces old client_id.
CREATE TABLE escalations (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   UUID    REFERENCES restaurants(id) ON DELETE CASCADE,
  date            DATE    NOT NULL DEFAULT CURRENT_DATE,
  customer_name   TEXT,
  customer_phone  TEXT,
  type            TEXT,
  note            TEXT,
  received_at     TEXT,
  resolved        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Disable RLS (internal tool — all access via anon key) ─────
ALTER TABLE restaurants       DISABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours     DISABLE ROW LEVEL SECURITY;
ALTER TABLE closures          DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers         DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE escalations       DISABLE ROW LEVEL SECURITY;
