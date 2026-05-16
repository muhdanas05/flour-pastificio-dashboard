-- ─────────────────────────────────────────────────────────────────────────────
-- Sala Smart — Enrich escalations with realistic notes/phones
-- So the escalation detail modal has content to display.
-- Run AFTER supabase_schema_v3.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- Patch any escalations missing notes or phones with realistic values.
UPDATE escalations
SET note = COALESCE(note, 'Caller had a special request — manager callback requested.'),
    customer_phone = COALESCE(customer_phone, '+39 06 0000 0000'),
    type = COALESCE(type, 'Special Request'),
    received_at = COALESCE(received_at, TO_CHAR(NOW(), 'HH24:MI'))
WHERE resolved = false;

-- Add a few extra rich escalations across the 3 restaurants for demo
DO $$
DECLARE
  flour_id     UUID;
  harbour_id   UUID;
  brasserie_id UUID;
BEGIN

SELECT id INTO flour_id     FROM restaurants WHERE slug = 'flour';
SELECT id INTO harbour_id   FROM restaurants WHERE slug = 'harbour';
SELECT id INTO brasserie_id FROM restaurants WHERE slug = 'brasserie';

INSERT INTO escalations (restaurant_id, customer_name, customer_phone, type, note, received_at, resolved)
VALUES
  (flour_id, 'Giorgio Mancini', '+39 339 444 5566', 'Complaint',
   'Caller unhappy with wait time on last visit and requested a manager callback to discuss compensation.',
   '14:15', false),
  (flour_id, 'Unknown Caller', '+39 06 1234 9999', 'Language Barrier',
   'Caller spoke no Italian or English — possible French speaker. Marco could not complete booking.',
   '16:03', false),
  (harbour_id, 'Sinead Murphy', '+353 87 555 0001', 'Special Request',
   'Asked if we can accommodate a wheelchair for a party of 6 on Saturday. Needs confirmation on access route.',
   '11:42', false),
  (brasserie_id, 'Marc Dubois', '+33 6 78 90 12 34', 'Booking Issue',
   'Was double-booked last weekend due to a system sync issue. Requests priority booking and a complimentary drink.',
   '18:21', false)
ON CONFLICT DO NOTHING;

END $$;
