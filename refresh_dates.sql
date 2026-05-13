-- ============================================================
-- Run this in Supabase SQL Editor whenever seed data dates go stale.
-- Shifts all dates relative to today.
-- ============================================================

-- Reservations: preserve today / tomorrow / day-after / yesterday spread per restaurant
WITH min_dates AS (
  SELECT restaurant_id, MIN(date) AS min_date
  FROM reservations
  GROUP BY restaurant_id
)
UPDATE reservations r
SET date = CURRENT_DATE + (r.date - m.min_date)
FROM min_dates m
WHERE r.restaurant_id = m.restaurant_id;

-- Escalations: always today
UPDATE escalations SET date = CURRENT_DATE;

-- Closures: shift so they stay in the future relative to today
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY date) AS rn
  FROM closures
)
UPDATE closures c
SET date = CURRENT_DATE + (n.rn * 7)
FROM numbered n
WHERE c.id = n.id;
