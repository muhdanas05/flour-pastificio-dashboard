-- ============================================================
-- Migration: restaurant_turns table
-- Run ONCE in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.restaurant_turns (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID    NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  start_time    TEXT    NOT NULL,   -- e.g. "11:30"
  end_time      TEXT    NOT NULL,   -- e.g. "13:00"
  capacity      INT     NOT NULL DEFAULT 80,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS restaurant_turns_rid_idx
  ON public.restaurant_turns(restaurant_id, start_time);
