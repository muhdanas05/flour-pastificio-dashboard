-- ============================================================
-- Sala Smart — Seed Data
-- Run AFTER supabase_schema.sql.
-- Safe to re-run: truncates all tables first.
-- ============================================================

TRUNCATE TABLE escalations, reservations, customers,
  restaurant_tables, closures, opening_hours, restaurants
  RESTART IDENTITY CASCADE;

DO $$
DECLARE
  flour_id     UUID;
  harbour_id   UUID;
  brasserie_id UUID;
BEGIN

-- ── Restaurants ───────────────────────────────────────────────

INSERT INTO restaurants (name, slug, address, agent_name, booking_mode, timezone)
VALUES ('Flour Pastificio', 'flour', 'Via della Croce 18, Roma', 'Marco', 'tables', 'Europe/Rome')
RETURNING id INTO flour_id;

INSERT INTO restaurants (name, slug, address, agent_name, booking_mode, timezone)
VALUES ('The Harbour Grill', 'harbour', '12 Harbour Road, Dun Laoghaire, Dublin', 'Aoife', 'seats', 'Europe/Dublin')
RETURNING id INTO harbour_id;

INSERT INTO restaurants (name, slug, address, agent_name, booking_mode, timezone)
VALUES ('La Brasserie', 'brasserie', '45 Rue du Faubourg Saint-Antoine, Paris 11e', 'Claire', 'seats', 'Europe/Paris')
RETURNING id INTO brasserie_id;

-- ── Opening Hours ─────────────────────────────────────────────
-- Flour Pastificio: Tue–Sun lunch (12:00–15:00) + dinner (18:30–23:00), closed Mon (day_of_week 1)
INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time, max_covers, is_active) VALUES
  (flour_id, 0, '12:00', '23:00', 60, true),   -- Sunday
  (flour_id, 1, '12:00', '15:00', 60, false),  -- Monday (closed)
  (flour_id, 2, '12:00', '23:00', 60, true),   -- Tuesday
  (flour_id, 3, '12:00', '23:00', 60, true),   -- Wednesday
  (flour_id, 4, '12:00', '23:00', 60, true),   -- Thursday
  (flour_id, 5, '12:00', '23:30', 80, true),   -- Friday (extended)
  (flour_id, 6, '12:00', '23:30', 80, true);   -- Saturday (extended)

-- The Harbour Grill: Mon–Sat dinner only (17:30–22:30), closed Sunday
INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time, max_covers, is_active) VALUES
  (harbour_id, 0, '17:30', '22:30', 40, false), -- Sunday (closed)
  (harbour_id, 1, '17:30', '22:30', 40, true),  -- Monday
  (harbour_id, 2, '17:30', '22:30', 40, true),  -- Tuesday
  (harbour_id, 3, '17:30', '22:30', 40, true),  -- Wednesday
  (harbour_id, 4, '17:30', '22:30', 40, true),  -- Thursday
  (harbour_id, 5, '17:30', '23:00', 50, true),  -- Friday
  (harbour_id, 6, '12:00', '23:00', 60, true);  -- Saturday (lunch + dinner)

-- La Brasserie: Mon–Sun all day (11:30–23:00)
INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time, max_covers, is_active) VALUES
  (brasserie_id, 0, '11:30', '23:00', 80, true),
  (brasserie_id, 1, '11:30', '23:00', 80, true),
  (brasserie_id, 2, '11:30', '23:00', 80, true),
  (brasserie_id, 3, '11:30', '23:00', 80, true),
  (brasserie_id, 4, '11:30', '23:00', 80, true),
  (brasserie_id, 5, '11:30', '23:30', 100, true),
  (brasserie_id, 6, '11:30', '23:30', 100, true);

-- ── Closures ──────────────────────────────────────────────────
INSERT INTO closures (restaurant_id, date, reason) VALUES
  (flour_id,     CURRENT_DATE + 14, 'Staff training day'),
  (flour_id,     CURRENT_DATE + 30, 'Private event — full venue hire'),
  (harbour_id,   CURRENT_DATE + 7,  'Public holiday — Christmas Day'),
  (harbour_id,   CURRENT_DATE + 21, 'Annual deep clean'),
  (brasserie_id, CURRENT_DATE + 10, 'Bastille Day — private function'),
  (brasserie_id, CURRENT_DATE + 28, 'Staff party');

-- ── Tables (Flour Pastificio — tables mode) ───────────────────
INSERT INTO restaurant_tables (restaurant_id, table_name, capacity, is_active) VALUES
  (flour_id, 'Table 1',  2, true),
  (flour_id, 'Table 2',  2, true),
  (flour_id, 'Table 3',  4, true),
  (flour_id, 'Table 4',  4, true),
  (flour_id, 'Table 5',  4, true),
  (flour_id, 'Table 6',  6, true),
  (flour_id, 'Table 7',  6, true),
  (flour_id, 'Table 8',  8, true),
  (flour_id, 'Bar 1',    2, true),
  (flour_id, 'Bar 2',    2, true),
  (flour_id, 'Terrace 1',4, true),
  (flour_id, 'Terrace 2',4, true);

-- ── Reservations ──────────────────────────────────────────────
-- Flour Pastificio — Today
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (flour_id, 'Martina Ferraro',    '+39 06 4521 8834', CURRENT_DATE, '12:30', 2, 'confirmed', null,                                    'agent'),
  (flour_id, 'Davide Romano',      '+39 338 742 1093', CURRENT_DATE, '13:00', 4, 'confirmed', 'Gluten intolerant — needs GF pasta',     'agent'),
  (flour_id, 'Elena Ricci',        '+39 06 9921 4455', CURRENT_DATE, '13:30', 2, 'arrived',   null,                                    'agent'),
  (flour_id, 'Marco Salvatore',    '+39 347 882 3310', CURRENT_DATE, '19:30', 3, 'confirmed', null,                                    'manual'),
  (flour_id, 'Valentina Conti',    '+39 06 7733 2211', CURRENT_DATE, '20:00', 2, 'confirmed', 'Nut allergy, severe — inform kitchen',   'agent'),
  (flour_id, 'Alessandro Greco',   '+39 349 223 4418', CURRENT_DATE, '20:30', 6, 'confirmed', 'Dairy intolerant x2',                   'agent'),
  (flour_id, 'Sofia De Luca',      '+39 333 551 9920', CURRENT_DATE, '21:00', 2, 'confirmed', 'Anniversary dinner',                    'manual');

-- Flour Pastificio — Tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (flour_id, 'Federico Marchetti', '+39 06 3312 7741', CURRENT_DATE + 1, '13:00', 4, 'confirmed', null,                               'agent'),
  (flour_id, 'Giulia Bianchi',     '+39 348 991 2206', CURRENT_DATE + 1, '20:00', 2, 'confirmed', 'Shellfish allergy',                 'agent'),
  (flour_id, 'Luca Esposito',      '+39 339 441 5572', CURRENT_DATE + 1, '20:30', 5, 'confirmed', null,                               'agent'),
  (flour_id, 'Isabella Fontana',   '+39 06 4411 3390', CURRENT_DATE + 1, '21:00', 3, 'confirmed', 'Gluten-free required, coeliac',     'manual');

-- Flour Pastificio — Day after
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (flour_id, 'Chiara Lombardi',    '+39 345 770 3318', CURRENT_DATE + 2, '19:30', 4, 'confirmed', null,                               'agent'),
  (flour_id, 'Antonio Moretti',    '+39 06 6612 8843', CURRENT_DATE + 2, '20:00', 2, 'confirmed', 'Birthday — request window table',   'manual'),
  (flour_id, 'Roberto Caruso',     '+39 06 8831 2290', CURRENT_DATE + 2, '20:30', 6, 'confirmed', 'Tree nut allergy',                  'agent');

-- Flour Pastificio — Yesterday (no-show example)
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (flour_id, 'Lorenzo Rizzo',      '+39 06 1234 5678', CURRENT_DATE - 1, '20:00', 4, 'no_show',  null,                               'agent'),
  (flour_id, 'Paola Esposito',     '+39 347 111 2222', CURRENT_DATE - 1, '13:00', 2, 'arrived',  null,                               'manual');

-- The Harbour Grill — Today
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (harbour_id, 'Siobhan Murphy',   '+353 87 234 5678', CURRENT_DATE, '19:00', 2, 'arrived',  'Shellfish allergy',                     'agent'),
  (harbour_id, 'Conor O''Brien',   '+353 85 321 9876', CURRENT_DATE, '19:30', 4, 'confirmed', null,                                   'agent'),
  (harbour_id, 'Aoife Byrne',      '+353 83 456 7890', CURRENT_DATE, '20:00', 3, 'confirmed', null,                                   'manual'),
  (harbour_id, 'Niamh Kelly',      '+353 87 765 4321', CURRENT_DATE, '20:30', 2, 'confirmed', 'Vegan menu requested',                  'agent');

-- The Harbour Grill — Tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (harbour_id, 'Declan Fitzpatrick','+353 86 543 2109', CURRENT_DATE + 1, '19:00', 6, 'confirmed', null,                              'manual'),
  (harbour_id, 'Fiona Lynch',       '+353 85 678 9012', CURRENT_DATE + 1, '20:00', 2, 'confirmed', 'Vegan',                           'agent');

-- The Harbour Grill — Day after
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (harbour_id, 'Sean Doyle',        '+353 87 890 1234', CURRENT_DATE + 2, '19:30', 5, 'confirmed', null,                              'agent');

-- The Harbour Grill — Yesterday
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (harbour_id, 'Patrick Walsh',     '+353 86 987 6543', CURRENT_DATE - 1, '19:00', 3, 'no_show',  null,                              'agent'),
  (harbour_id, 'Mary O''Sullivan',  '+353 85 111 3333', CURRENT_DATE - 1, '20:30', 2, 'arrived',  null,                              'manual');

-- La Brasserie — Today
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (brasserie_id, 'Marie Dubois',    '+33 6 12 34 56 78', CURRENT_DATE, '12:30', 2, 'arrived',  'Peanut allergy',                      'agent'),
  (brasserie_id, 'Antoine Bernard', '+33 6 23 45 67 89', CURRENT_DATE, '13:00', 4, 'confirmed', null,                                 'agent'),
  (brasserie_id, 'Camille Morel',   '+33 6 34 56 78 90', CURRENT_DATE, '13:30', 2, 'confirmed', null,                                 'manual'),
  (brasserie_id, 'Isabelle Petit',  '+33 6 45 67 89 01', CURRENT_DATE, '19:30', 5, 'confirmed', null,                                 'agent'),
  (brasserie_id, 'Pierre Martin',   '+33 6 98 76 54 32', CURRENT_DATE, '20:45', 2, 'confirmed', 'Coeliac disease — strictly GF',      'agent'),
  (brasserie_id, 'Sophie Lefevre',  '+33 6 55 44 33 22', CURRENT_DATE, '21:15', 3, 'confirmed', 'Lactose intolerant',                 'agent');

-- La Brasserie — Tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (brasserie_id, 'Francois Girard', '+33 6 56 78 90 12', CURRENT_DATE + 1, '20:00', 4, 'confirmed', null,                            'agent'),
  (brasserie_id, 'Amelie Fournier', '+33 6 67 89 01 23', CURRENT_DATE + 1, '20:30', 2, 'confirmed', 'Nut allergy',                   'agent'),
  (brasserie_id, 'Thomas Rousseau', '+33 6 78 90 12 34', CURRENT_DATE + 1, '21:00', 6, 'confirmed', null,                            'manual');

-- La Brasserie — Day after
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (brasserie_id, 'Margot Vincent',  '+33 6 89 01 23 45', CURRENT_DATE + 2, '12:30', 2, 'confirmed', null,                            'agent'),
  (brasserie_id, 'Nicolas Laurent', '+33 6 90 12 34 56', CURRENT_DATE + 2, '19:30', 3, 'confirmed', null,                            'manual'),
  (brasserie_id, 'Elise Simon',     '+33 6 01 23 45 67', CURRENT_DATE + 2, '20:00', 4, 'confirmed', 'Vegan x2',                      'agent');

-- La Brasserie — Yesterday
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, status, notes, source) VALUES
  (brasserie_id, 'Jacques Renard',  '+33 1 44 55 66 77', CURRENT_DATE - 1, '20:00', 2, 'no_show',  null,                            'agent'),
  (brasserie_id, 'Chloe Bernard',   '+33 6 33 44 55 66', CURRENT_DATE - 1, '13:00', 4, 'arrived',  null,                            'manual');

-- ── Escalations ───────────────────────────────────────────────
INSERT INTO escalations (restaurant_id, date, customer_name, customer_phone, type, note, received_at, resolved) VALUES
  (flour_id, CURRENT_DATE, 'Unknown Caller',  '+39 06 3344 5521', 'Private Hire',
   'Enquired about exclusive private hire for 35 guests. Pricing and availability require owner decision before callback.', '11:42', false),
  (flour_id, CURRENT_DATE, 'Giorgio Mancini', '+39 349 771 8832', 'Complaint',
   'Caller unhappy with wait time on last visit and requested a manager callback to discuss compensation.', '14:15', false),
  (flour_id, CURRENT_DATE, 'Unknown Caller',  '+39 06 5593 2284', 'Language Barrier',
   'Caller spoke no Italian or English — possible French speaker. Marco could not complete booking.', '16:03', false),

  (harbour_id, CURRENT_DATE, 'Patrick Walsh',   '+353 86 987 6543', 'Large Group',
   'Caller enquired about reserving the full terrace for a 40-person birthday dinner. Manager approval required.', '13:05', false),

  (brasserie_id, CURRENT_DATE, 'Jacques Renard', '+33 1 44 55 66 77', 'Complaint',
   'Guest dissatisfied with previous reservation mix-up. Requested manager call and complimentary dessert.', '10:20', false),
  (brasserie_id, CURRENT_DATE, 'Unknown Caller', '+33 6 77 88 99 00', 'Press Inquiry',
   'Caller identified as food journalist requesting an interview and tasting menu booking. Needs owner approval.', '15:47', false);

END $$;
