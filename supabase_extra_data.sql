-- ─────────────────────────────────────────────────────────────────────────────
-- Sala Smart — Extra Demo Data (all statuses, multiple dates)
-- Run in Supabase SQL Editor AFTER supabase_schema_additions.sql
-- Safe to re-run — adds new rows, doesn't delete anything.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  flour_id     UUID;
  harbour_id   UUID;
  brasserie_id UUID;
  t1 UUID; t2 UUID; t3 UUID; t4 UUID; t5 UUID; t6 UUID;
BEGIN

SELECT id INTO flour_id     FROM restaurants WHERE slug = 'flour';
SELECT id INTO harbour_id   FROM restaurants WHERE slug = 'harbour';
SELECT id INTO brasserie_id FROM restaurants WHERE slug = 'brasserie';

-- ── Flour Pastificio — table ids ───────────────────────────────────────────
SELECT id INTO t1 FROM restaurant_tables WHERE restaurant_id = flour_id AND table_name = 'Table 1' LIMIT 1;
SELECT id INTO t2 FROM restaurant_tables WHERE restaurant_id = flour_id AND table_name = 'Table 2' LIMIT 1;
SELECT id INTO t3 FROM restaurant_tables WHERE restaurant_id = flour_id AND table_name = 'Table 3' LIMIT 1;
SELECT id INTO t4 FROM restaurant_tables WHERE restaurant_id = flour_id AND table_name = 'Table 4' LIMIT 1;
SELECT id INTO t5 FROM restaurant_tables WHERE restaurant_id = flour_id AND table_name = 'Table 5' LIMIT 1;
SELECT id INTO t6 FROM restaurant_tables WHERE restaurant_id = flour_id AND table_name = 'Table 6' LIMIT 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- FLOUR PASTIFICIO — 7 days of data, all statuses
-- ═══════════════════════════════════════════════════════════════════════════

-- Today (already seeded — add a few more statuses)
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source, table_id)
VALUES
  (flour_id, 'Marco Conti',    '+39 06 1234 5678', CURRENT_DATE, '12:30', 2, 90,  'arrived',   NULL,                                       'agent',  t1),
  (flour_id, 'Sara Mancini',   '+39 348 222 3344', CURRENT_DATE, '19:00', 3, 120, 'cancelled', 'Cancelled by guest',                        'manual', NULL),
  (flour_id, 'Paolo Romani',   '+39 339 555 6677', CURRENT_DATE, '19:30', 2, 90,  'no_show',   NULL,                                        'agent',  t2),
  (flour_id, 'Elena Gallo',    '+39 06 9988 7766', CURRENT_DATE, '20:30', 4, 120, 'arrived',   'Birthday celebration',                      'manual', t3),
  (flour_id, 'Gianni Ferrara', '+39 335 111 2233', CURRENT_DATE, '22:00', 6, 150, 'confirmed', 'Nut allergy at the table',                  'agent',  t4);

-- Yesterday
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source, table_id)
VALUES
  (flour_id, 'Anna Ricci',      '+39 06 4411 0011', CURRENT_DATE - 1, '12:00', 2, 90,  'arrived',   NULL,                              'agent',  t1),
  (flour_id, 'Bruno Marino',    '+39 349 100 2200', CURRENT_DATE - 1, '13:00', 4, 120, 'arrived',   'Anniversary dinner',             'manual', t2),
  (flour_id, 'Chiara Greco',    '+39 339 300 4400', CURRENT_DATE - 1, '19:30', 2, 90,  'no_show',   NULL,                              'agent',  t3),
  (flour_id, 'Davide Esposito', '+39 06 5522 6633', CURRENT_DATE - 1, '20:00', 5, 120, 'arrived',   'Gluten intolerant — 1 guest',    'agent',  t4),
  (flour_id, 'Elisa Ferretti',  '+39 320 700 8800', CURRENT_DATE - 1, '20:30', 3, 90,  'arrived',   NULL,                              'manual', t5),
  (flour_id, 'Fabio Costa',     '+39 06 1100 2200', CURRENT_DATE - 1, '21:00', 2, 90,  'cancelled', NULL,                              'agent',  NULL),
  (flour_id, 'Giulia Moretti',  '+39 329 900 1100', CURRENT_DATE - 1, '21:30', 7, 150, 'arrived',   'Shellfish allergy — 2 guests',   'agent',  t6);

-- Day before yesterday
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source, table_id)
VALUES
  (flour_id, 'Luca Barbieri',  '+39 06 3344 5566', CURRENT_DATE - 2, '12:30', 3, 120, 'arrived',   NULL,                            'manual', t1),
  (flour_id, 'Marta Leone',    '+39 344 200 3300', CURRENT_DATE - 2, '13:00', 2, 90,  'no_show',   NULL,                            'agent',  t2),
  (flour_id, 'Nicola Palma',   '+39 06 6677 8899', CURRENT_DATE - 2, '19:00', 4, 120, 'arrived',   'Vegetarian menu required',      'agent',  t3),
  (flour_id, 'Ornella Valli',  '+39 331 400 5500', CURRENT_DATE - 2, '20:00', 2, 90,  'arrived',   NULL,                            'manual', t4),
  (flour_id, 'Piero Testa',    '+39 06 8899 0011', CURRENT_DATE - 2, '21:00', 6, 150, 'arrived',   'Dairy intolerant — 1 guest',   'agent',  t5),
  (flour_id, 'Rita Gatti',     '+39 339 600 7700', CURRENT_DATE - 2, '21:30', 2, 90,  'cancelled', 'No show, called to cancel',     'manual', NULL);

-- Tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source, table_id)
VALUES
  (flour_id, 'Sergio Bruno',   '+39 06 2233 4455', CURRENT_DATE + 1, '12:00', 2, 90,  'confirmed', NULL,                              'agent',  t1),
  (flour_id, 'Teresa Amato',   '+39 348 800 9900', CURRENT_DATE + 1, '12:30', 4, 120, 'confirmed', 'Celiac disease — 1 guest',        'manual', t2),
  (flour_id, 'Ugo Caruso',     '+39 06 4455 6677', CURRENT_DATE + 1, '13:00', 3, 90,  'confirmed', NULL,                              'agent',  t3),
  (flour_id, 'Valeria Nucci',  '+39 320 100 2200', CURRENT_DATE + 1, '19:30', 2, 90,  'confirmed', NULL,                              'agent',  t4),
  (flour_id, 'Walter Rossi',   '+39 06 6688 9900', CURRENT_DATE + 1, '20:00', 6, 150, 'confirmed', 'Peanut allergy — severe',         'manual', t5),
  (flour_id, 'Xenia Giorgi',   '+39 329 300 4400', CURRENT_DATE + 1, '20:30', 2, 90,  'confirmed', 'Honeymoon dinner, set up decor',  'agent',  t6),
  (flour_id, 'Yuri Palombo',   '+39 06 1122 3344', CURRENT_DATE + 1, '21:00', 4, 120, 'confirmed', NULL,                              'agent',  t1);

-- Day after tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source, table_id)
VALUES
  (flour_id, 'Zara Conti',     '+39 06 5566 7788', CURRENT_DATE + 2, '12:00', 2, 90,  'confirmed', NULL,                         'agent',  t2),
  (flour_id, 'Aldo Marini',    '+39 348 500 6600', CURRENT_DATE + 2, '13:00', 5, 120, 'confirmed', 'Lactose intolerant — 2 guests','manual', t3),
  (flour_id, 'Bianca Fabbri',  '+39 06 7788 9900', CURRENT_DATE + 2, '19:00', 2, 90,  'confirmed', NULL,                         'agent',  t4),
  (flour_id, 'Carlo Riva',     '+39 339 700 8800', CURRENT_DATE + 2, '20:00', 4, 120, 'confirmed', NULL,                         'agent',  t5),
  (flour_id, 'Diana Serra',    '+39 06 9900 1122', CURRENT_DATE + 2, '21:00', 3, 90,  'confirmed', 'Vegan menu required',        'manual', t6);

-- 3 days from now
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (flour_id, 'Enrico Poli',    '+39 06 2244 6688', CURRENT_DATE + 3, '19:30', 2, 90,  'confirmed', NULL,                         'agent'),
  (flour_id, 'Franca Levi',    '+39 320 400 5500', CURRENT_DATE + 3, '20:00', 6, 150, 'confirmed', 'Shellfish allergy — 1 guest','agent'),
  (flour_id, 'Giorgio Neri',   '+39 06 3355 7799', CURRENT_DATE + 3, '21:00', 3, 90,  'confirmed', NULL,                         'manual');

-- 4 days from now
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (flour_id, 'Helena Brun',    '+39 06 4466 8800', CURRENT_DATE + 4, '12:30', 4, 120, 'confirmed', NULL,                   'agent'),
  (flour_id, 'Ivan Corti',     '+39 348 600 7700', CURRENT_DATE + 4, '19:00', 2, 90,  'confirmed', NULL,                   'agent'),
  (flour_id, 'Jenny Rosso',    '+39 06 5577 9911', CURRENT_DATE + 4, '20:30', 5, 120, 'confirmed', 'Nut allergy — 1 guest','manual');

-- ═══════════════════════════════════════════════════════════════════════════
-- HARBOUR GRILL — 7 days of data, all statuses
-- ═══════════════════════════════════════════════════════════════════════════

-- Today extras
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (harbour_id, 'Seamus O''Brien',   '+353 87 111 2222', CURRENT_DATE, '12:30', 2, 90,  'arrived',   NULL,                           'agent'),
  (harbour_id, 'Aoife Murphy',      '+353 86 333 4444', CURRENT_DATE, '13:00', 4, 120, 'no_show',   NULL,                           'agent'),
  (harbour_id, 'Ciarán Kelly',      '+353 83 555 6666', CURRENT_DATE, '19:00', 3, 90,  'arrived',   'Gluten-free required',          'manual'),
  (harbour_id, 'Deirdre Walsh',     '+353 87 777 8888', CURRENT_DATE, '20:00', 6, 150, 'confirmed', 'Shellfish allergy — 2 guests',  'agent'),
  (harbour_id, 'Eoin Brennan',      '+353 86 999 0000', CURRENT_DATE, '20:30', 2, 90,  'cancelled', NULL,                           'agent');

-- Yesterday
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (harbour_id, 'Fiona Collins',     '+353 87 100 2000', CURRENT_DATE - 1, '12:00', 2, 90,  'arrived', NULL,                       'agent'),
  (harbour_id, 'Gerry Doyle',       '+353 83 200 3000', CURRENT_DATE - 1, '19:30', 5, 120, 'arrived', 'Dairy allergy — 1 guest',   'manual'),
  (harbour_id, 'Heather Flynn',     '+353 86 300 4000', CURRENT_DATE - 1, '20:00', 3, 90,  'arrived', NULL,                       'agent'),
  (harbour_id, 'Ian Gallagher',     '+353 87 400 5000', CURRENT_DATE - 1, '21:00', 4, 120, 'no_show', NULL,                       'agent'),
  (harbour_id, 'Jane Hannigan',     '+353 83 500 6000', CURRENT_DATE - 1, '21:30', 2, 90,  'arrived', NULL,                       'manual');

-- Tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (harbour_id, 'Kevin Irwin',       '+353 86 600 7000', CURRENT_DATE + 1, '12:00', 2, 90,  'confirmed', NULL,                           'agent'),
  (harbour_id, 'Laura Jordan',      '+353 87 700 8000', CURRENT_DATE + 1, '13:00', 6, 150, 'confirmed', 'Nut allergy — severe, carries EpiPen', 'manual'),
  (harbour_id, 'Mark Kennedy',      '+353 83 800 9000', CURRENT_DATE + 1, '19:00', 3, 90,  'confirmed', NULL,                           'agent'),
  (harbour_id, 'Niamh Lynch',       '+353 86 900 0000', CURRENT_DATE + 1, '20:00', 4, 120, 'confirmed', 'Celiac — 2 guests',             'agent'),
  (harbour_id, 'Owen Moran',        '+353 87 010 1010', CURRENT_DATE + 1, '21:00', 2, 90,  'confirmed', NULL,                           'manual');

-- Day after tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (harbour_id, 'Patricia Nolan',    '+353 83 120 2020', CURRENT_DATE + 2, '12:30', 3, 90,  'confirmed', NULL,                'agent'),
  (harbour_id, 'Quinn O''Connor',   '+353 86 230 3030', CURRENT_DATE + 2, '19:30', 2, 90,  'confirmed', NULL,                'agent'),
  (harbour_id, 'Rachel Power',      '+353 87 340 4040', CURRENT_DATE + 2, '20:00', 5, 120, 'confirmed', 'Vegetarian menu',   'manual');

-- 3 days from now
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (harbour_id, 'Sean Quinn',        '+353 83 450 5050', CURRENT_DATE + 3, '19:00', 4, 120, 'confirmed', NULL,                    'agent'),
  (harbour_id, 'Tara Ryan',         '+353 86 560 6060', CURRENT_DATE + 3, '20:00', 2, 90,  'confirmed', 'Anniversary dinner',    'manual'),
  (harbour_id, 'Ultan Sheridan',    '+353 87 670 7070', CURRENT_DATE + 3, '21:00', 6, 150, 'confirmed', 'Lactose intolerant',    'agent');

-- ═══════════════════════════════════════════════════════════════════════════
-- LA BRASSERIE — 7 days of data, all statuses
-- ═══════════════════════════════════════════════════════════════════════════

-- Today extras
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (brasserie_id, 'Amélie Dupont',   '+33 6 11 22 33 44', CURRENT_DATE, '12:00', 2, 90,  'arrived',   NULL,                         'agent'),
  (brasserie_id, 'Baptiste Girard', '+33 6 22 33 44 55', CURRENT_DATE, '12:30', 4, 120, 'no_show',   NULL,                         'agent'),
  (brasserie_id, 'Céline Moreau',   '+33 6 33 44 55 66', CURRENT_DATE, '19:30', 2, 90,  'arrived',   'Gluten intolerance',          'manual'),
  (brasserie_id, 'Denis Laurent',   '+33 6 44 55 66 77', CURRENT_DATE, '20:00', 6, 150, 'confirmed', 'Shellfish allergy — 1 guest', 'agent'),
  (brasserie_id, 'Elodie Petit',    '+33 6 55 66 77 88', CURRENT_DATE, '20:30', 3, 90,  'cancelled', NULL,                         'agent');

-- Yesterday
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (brasserie_id, 'François Simon',  '+33 6 66 77 88 99', CURRENT_DATE - 1, '12:00', 2, 90,  'arrived', NULL,                  'agent'),
  (brasserie_id, 'Gabrielle Roy',   '+33 6 77 88 99 00', CURRENT_DATE - 1, '19:00', 5, 120, 'arrived', 'Vegan — 2 guests',    'manual'),
  (brasserie_id, 'Hugo Martin',     '+33 6 88 99 00 11', CURRENT_DATE - 1, '20:00', 2, 90,  'no_show', NULL,                  'agent'),
  (brasserie_id, 'Inès Roux',       '+33 6 99 00 11 22', CURRENT_DATE - 1, '20:30', 4, 120, 'arrived', 'Nut allergy at table','agent'),
  (brasserie_id, 'Julien Thomas',   '+33 6 00 11 22 33', CURRENT_DATE - 1, '21:00', 3, 90,  'arrived', NULL,                  'manual');

-- Tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (brasserie_id, 'Karine Leroy',    '+33 6 11 22 33 55', CURRENT_DATE + 1, '12:00', 2, 90,  'confirmed', NULL,                     'agent'),
  (brasserie_id, 'Louis Bernard',   '+33 6 22 33 44 66', CURRENT_DATE + 1, '19:00', 6, 150, 'confirmed', 'Celiac — 3 guests',       'manual'),
  (brasserie_id, 'Margaux Dubois',  '+33 6 33 44 55 77', CURRENT_DATE + 1, '19:30', 2, 90,  'confirmed', NULL,                     'agent'),
  (brasserie_id, 'Nicolas Perrin',  '+33 6 44 55 66 88', CURRENT_DATE + 1, '20:30', 4, 120, 'confirmed', 'Dairy free required',    'agent'),
  (brasserie_id, 'Olivia Fontaine', '+33 6 55 66 77 99', CURRENT_DATE + 1, '21:00', 3, 90,  'confirmed', NULL,                     'manual');

-- Day after tomorrow
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (brasserie_id, 'Pierre Rousseau', '+33 6 66 77 88 00', CURRENT_DATE + 2, '12:30', 4, 120, 'confirmed', NULL,              'agent'),
  (brasserie_id, 'Quentin Blanc',   '+33 6 77 88 99 11', CURRENT_DATE + 2, '19:00', 2, 90,  'confirmed', NULL,              'agent'),
  (brasserie_id, 'Romy Garnier',    '+33 6 88 99 00 22', CURRENT_DATE + 2, '20:00', 5, 120, 'confirmed', 'Kosher required', 'manual');

-- 3 days from now
INSERT INTO reservations (restaurant_id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes, source)
VALUES
  (brasserie_id, 'Stéphane Colin',  '+33 6 99 00 11 33', CURRENT_DATE + 3, '19:30', 2, 90,  'confirmed', NULL,              'agent'),
  (brasserie_id, 'Théo Guerin',     '+33 6 00 11 22 44', CURRENT_DATE + 3, '20:00', 4, 120, 'confirmed', NULL,              'agent'),
  (brasserie_id, 'Ursula Vidal',    '+33 6 11 22 33 66', CURRENT_DATE + 3, '21:00', 6, 150, 'confirmed', 'Shellfish allergy', 'manual');

END $$;
