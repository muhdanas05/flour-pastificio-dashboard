-- ============================================================
-- Run this in Supabase SQL Editor whenever seed data dates go stale.
-- Shifts all records so they're relative to today.
-- ============================================================

-- Stats, alerts, escalations, seat availability → always today
UPDATE daily_stats       SET date = CURRENT_DATE;
UPDATE allergy_alerts    SET date = CURRENT_DATE;
UPDATE escalations       SET date = CURRENT_DATE;
UPDATE seat_availability SET date = CURRENT_DATE;

-- Reservations: preserve today / tomorrow / day-after spread per client
WITH min_dates AS (
  SELECT client_id, MIN(date) AS min_date
  FROM reservations
  GROUP BY client_id
)
UPDATE reservations r
SET date = CURRENT_DATE + (r.date - m.min_date)
FROM min_dates m
WHERE r.client_id = m.client_id;

-- Weekly metrics: shift so the last day = today
WITH max_date AS (
  SELECT MAX(date) AS max_d FROM weekly_metrics
)
UPDATE weekly_metrics
SET date = date + (CURRENT_DATE - (SELECT max_d FROM max_date));
