-- ─────────────────────────────────────────────────────────────────────────────
-- Sala Smart — Schema v3 (Risto feedback features)
-- Run in Supabase SQL Editor AFTER supabase_schema_additions.sql.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Restaurants: revenue + reminder defaults
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS avg_spend_per_cover    NUMERIC(7,2) DEFAULT 35.00,
  ADD COLUMN IF NOT EXISTS reminders_enabled      BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_hours_before  INT          DEFAULT 24;

-- 2. Reservations: reminder tracking
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reminder_sent     BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_at  TIMESTAMPTZ;

-- 3. Customers: internal staff notes (CRM)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS staff_notes TEXT;

-- 4. Backfill customer_id on existing reservations (matches by phone + restaurant).
-- Required for guest profile and no-show tracking on seeded data.
INSERT INTO customers (restaurant_id, phone, name)
SELECT DISTINCT r.restaurant_id, r.customer_phone, r.customer_name
FROM reservations r
LEFT JOIN customers c
  ON c.restaurant_id = r.restaurant_id AND c.phone = r.customer_phone
WHERE r.customer_phone IS NOT NULL AND c.id IS NULL
ON CONFLICT (restaurant_id, phone) DO NOTHING;

UPDATE reservations r
SET customer_id = c.id
FROM customers c
WHERE r.restaurant_id = c.restaurant_id
  AND r.customer_phone = c.phone
  AND r.customer_id IS NULL;

-- 5. Demo data: create a repeat no-show guest at Flour Pastificio so the
--    no-show flag is visible immediately.
DO $$
DECLARE
  flour_id UUID;
  repeat_customer_id UUID;
BEGIN
  SELECT id INTO flour_id FROM restaurants WHERE slug = 'flour';
  IF flour_id IS NULL THEN RETURN; END IF;

  INSERT INTO customers (restaurant_id, phone, name, staff_notes)
  VALUES (flour_id, '+39 06 0000 1111', 'Repeat Offender',
          'Has missed bookings twice — confirm by phone before accepting next reservation.')
  ON CONFLICT (restaurant_id, phone) DO UPDATE SET staff_notes = EXCLUDED.staff_notes
  RETURNING id INTO repeat_customer_id;

  -- 3 historical no-shows
  INSERT INTO reservations
    (restaurant_id, customer_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
  VALUES
    (flour_id, repeat_customer_id, 'Repeat Offender', '+39 06 0000 1111', CURRENT_DATE - 30, '20:00', 2, 90, 'no_show', NULL, 'agent'),
    (flour_id, repeat_customer_id, 'Repeat Offender', '+39 06 0000 1111', CURRENT_DATE - 14, '19:30', 4, 120, 'no_show', NULL, 'agent'),
    (flour_id, repeat_customer_id, 'Repeat Offender', '+39 06 0000 1111', CURRENT_DATE - 7,  '20:30', 2, 90, 'no_show', NULL, 'manual')
  ON CONFLICT DO NOTHING;
END $$;
