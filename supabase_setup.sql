-- ============================================================
-- Voice AI Dashboard — Supabase Schema + Seed Data
-- Run this in the Supabase SQL editor (project: esovvrmqjjpydsqpamec)
-- ============================================================

-- ── TABLES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  address      TEXT,
  agent_name   TEXT,
  agent_status TEXT DEFAULT 'Online',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_stats (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_today     INT  DEFAULT 0,
  reservations    INT  DEFAULT 0,
  conversion_pct  INT  DEFAULT 0,
  covers_booked   INT  DEFAULT 0,
  escalations     INT  DEFAULT 0,
  UNIQUE(client_id, date)
);

CREATE TABLE IF NOT EXISTS allergy_alerts (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  name      TEXT,
  time      TEXT,
  phone     TEXT,
  allergy   TEXT
);

CREATE TABLE IF NOT EXISTS escalations (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  name      TEXT,
  phone     TEXT,
  type      TEXT,
  note      TEXT,
  received  TEXT
);

CREATE TABLE IF NOT EXISTS reservations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  time       TEXT,
  guest_name TEXT,
  guests     INT  DEFAULT 1,
  allergy    TEXT,
  phone      TEXT
);

CREATE TABLE IF NOT EXISTS weekly_metrics (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID REFERENCES clients(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  calls        INT  DEFAULT 0,
  reservations INT  DEFAULT 0,
  UNIQUE(client_id, date)
);

-- Seat availability: restaurant sets total_seats each day so AI won't overbook
CREATE TABLE IF NOT EXISTS seat_availability (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID REFERENCES clients(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  total_seats  INT  DEFAULT 0,
  UNIQUE(client_id, date)
);

-- Disable RLS so the dashboard can read without auth (internal tool)
ALTER TABLE clients          DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats      DISABLE ROW LEVEL SECURITY;
ALTER TABLE allergy_alerts   DISABLE ROW LEVEL SECURITY;
ALTER TABLE escalations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations     DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_metrics   DISABLE ROW LEVEL SECURITY;
ALTER TABLE seat_availability DISABLE ROW LEVEL SECURITY;


-- ── SEED DATA ───────────────────────────────────────────────

DO $$
DECLARE
  flour_id     UUID;
  harbour_id   UUID;
  brasserie_id UUID;
BEGIN

-- ── Clients ──
INSERT INTO clients (name, address, agent_name, agent_status) VALUES
  ('Flour Pastificio', 'Via della Croce 18, Roma', 'Marco', 'Online')
RETURNING id INTO flour_id;

INSERT INTO clients (name, address, agent_name, agent_status) VALUES
  ('The Harbour Grill', '12 Harbour Road, Dun Laoghaire, Dublin', 'Aoife', 'Online')
RETURNING id INTO harbour_id;

INSERT INTO clients (name, address, agent_name, agent_status) VALUES
  ('La Brasserie', '45 Rue du Faubourg Saint-Antoine, Paris 11e', 'Claire', 'Online')
RETURNING id INTO brasserie_id;

-- ── Daily Stats (today) ──
INSERT INTO daily_stats (client_id, date, calls_today, reservations, conversion_pct, covers_booked, escalations) VALUES
  (flour_id,     CURRENT_DATE, 24, 8,  33, 29, 3),
  (harbour_id,   CURRENT_DATE, 18, 6,  44, 22, 1),
  (brasserie_id, CURRENT_DATE, 31, 14, 45, 48, 2);

-- ── Seat Availability (today) ──
INSERT INTO seat_availability (client_id, date, total_seats) VALUES
  (flour_id,     CURRENT_DATE, 60),
  (harbour_id,   CURRENT_DATE, 40),
  (brasserie_id, CURRENT_DATE, 80);

-- ── Allergy Alerts ──
INSERT INTO allergy_alerts (client_id, date, name, time, phone, allergy) VALUES
  (flour_id,     CURRENT_DATE, 'Valentina Conti',  '20:00', '+39 06 7733 2211', 'Nut allergy, severe'),
  (flour_id,     CURRENT_DATE, 'Alessandro Greco', '20:30', '+39 349 223 4418', 'Dairy intolerant x2'),
  (harbour_id,   CURRENT_DATE, 'Siobhan Murphy',   '19:00', '+353 87 234 5678', 'Shellfish allergy'),
  (brasserie_id, CURRENT_DATE, 'Marie Dubois',     '20:00', '+33 6 12 34 56 78','Peanut allergy'),
  (brasserie_id, CURRENT_DATE, 'Pierre Martin',    '20:45', '+33 6 98 76 54 32','Coeliac disease'),
  (brasserie_id, CURRENT_DATE, 'Sophie Lefevre',   '21:15', '+33 6 55 44 33 22','Lactose intolerant');

-- ── Escalations ──
INSERT INTO escalations (client_id, date, name, phone, type, note, received) VALUES
  (flour_id, CURRENT_DATE, 'Unknown Caller',  '+39 06 3344 5521', 'Private Hire',    'Enquired about exclusive private hire for 35 guests. Pricing and availability require owner decision before callback.', '11:42'),
  (flour_id, CURRENT_DATE, 'Giorgio Mancini', '+39 349 771 8832', 'Complaint',        'Caller unhappy with wait time on last visit and requested a manager callback to discuss compensation.', '14:15'),
  (flour_id, CURRENT_DATE, 'Unknown Caller',  '+39 06 5593 2284', 'Language Barrier', 'Caller spoke no Italian or English — possible French speaker. Marco could not complete booking.', '16:03'),
  (harbour_id, CURRENT_DATE, 'Patrick Walsh', '+353 86 987 6543', 'Large Group',      'Caller enquired about reserving the full terrace for a 40-person birthday dinner. Manager approval required.', '13:05'),
  (brasserie_id, CURRENT_DATE, 'Jacques Renard',  '+33 1 44 55 66 77', 'Complaint',    'Guest dissatisfied with previous reservation mix-up. Requested manager call and complimentary dessert.', '10:20'),
  (brasserie_id, CURRENT_DATE, 'Unknown Caller',  '+33 6 77 88 99 00', 'Press Inquiry','Caller identified as food journalist requesting an interview and tasting menu booking. Needs owner approval.', '15:47');

-- ── Reservations ──
INSERT INTO reservations (client_id, date, time, guest_name, guests, allergy, phone) VALUES
  -- Flour Pastificio — Today
  (flour_id, CURRENT_DATE,     '12:30', 'Martina Ferraro',    2, '',                    '+39 06 4521 8834'),
  (flour_id, CURRENT_DATE,     '13:00', 'Davide Romano',      4, 'Gluten intolerant',   '+39 338 742 1093'),
  (flour_id, CURRENT_DATE,     '13:30', 'Elena Ricci',        2, '',                    '+39 06 9921 4455'),
  (flour_id, CURRENT_DATE,     '19:30', 'Marco Salvatore',    3, '',                    '+39 347 882 3310'),
  (flour_id, CURRENT_DATE,     '20:00', 'Valentina Conti',    2, 'Nut allergy, severe', '+39 06 7733 2211'),
  (flour_id, CURRENT_DATE,     '20:30', 'Alessandro Greco',   6, 'Dairy intolerant x2', '+39 349 223 4418'),
  (flour_id, CURRENT_DATE,     '21:00', 'Sofia De Luca',      2, '',                    '+39 333 551 9920'),
  -- Flour Pastificio — Tomorrow
  (flour_id, CURRENT_DATE + 1, '13:00', 'Federico Marchetti', 4, '',                    '+39 06 3312 7741'),
  (flour_id, CURRENT_DATE + 1, '20:00', 'Giulia Bianchi',     2, 'Shellfish allergy',   '+39 348 991 2206'),
  (flour_id, CURRENT_DATE + 1, '20:30', 'Luca Esposito',      5, '',                    '+39 339 441 5572'),
  (flour_id, CURRENT_DATE + 1, '21:00', 'Isabella Fontana',   3, 'Gluten-free required','+39 06 4411 3390'),
  -- Flour Pastificio — Day after
  (flour_id, CURRENT_DATE + 2, '19:30', 'Chiara Lombardi',    4, '',                    '+39 345 770 3318'),
  (flour_id, CURRENT_DATE + 2, '20:00', 'Antonio Moretti',    2, '',                    '+39 06 6612 8843'),
  (flour_id, CURRENT_DATE + 2, '20:30', 'Roberto Caruso',     6, 'Tree nut allergy',    '+39 06 8831 2290'),

  -- The Harbour Grill — Today
  (harbour_id, CURRENT_DATE,     '19:00', 'Siobhan Murphy',     2, 'Shellfish allergy', '+353 87 234 5678'),
  (harbour_id, CURRENT_DATE,     '19:30', 'Conor O''Brien',     4, '',                  '+353 85 321 9876'),
  (harbour_id, CURRENT_DATE,     '20:00', 'Aoife Byrne',        3, '',                  '+353 83 456 7890'),
  (harbour_id, CURRENT_DATE,     '20:30', 'Niamh Kelly',        2, '',                  '+353 87 765 4321'),
  -- The Harbour Grill — Tomorrow
  (harbour_id, CURRENT_DATE + 1, '13:00', 'Declan Fitzpatrick', 6, '',                  '+353 86 543 2109'),
  (harbour_id, CURRENT_DATE + 1, '19:00', 'Fiona Lynch',        2, 'Vegan',             '+353 85 678 9012'),
  -- The Harbour Grill — Day after
  (harbour_id, CURRENT_DATE + 2, '19:30', 'Sean Doyle',         5, '',                  '+353 87 890 1234'),

  -- La Brasserie — Today
  (brasserie_id, CURRENT_DATE,     '12:30', 'Marie Dubois',     2, 'Peanut allergy',    '+33 6 12 34 56 78'),
  (brasserie_id, CURRENT_DATE,     '13:00', 'Antoine Bernard',  4, '',                  '+33 6 23 45 67 89'),
  (brasserie_id, CURRENT_DATE,     '13:30', 'Camille Morel',    2, '',                  '+33 6 34 56 78 90'),
  (brasserie_id, CURRENT_DATE,     '19:30', 'Isabelle Petit',   5, '',                  '+33 6 45 67 89 01'),
  (brasserie_id, CURRENT_DATE,     '20:45', 'Pierre Martin',    2, 'Coeliac disease',   '+33 6 98 76 54 32'),
  (brasserie_id, CURRENT_DATE,     '21:15', 'Sophie Lefevre',   3, 'Lactose intolerant','+33 6 55 44 33 22'),
  -- La Brasserie — Tomorrow
  (brasserie_id, CURRENT_DATE + 1, '20:00', 'Francois Girard',  4, '',                  '+33 6 56 78 90 12'),
  (brasserie_id, CURRENT_DATE + 1, '20:30', 'Amelie Fournier',  2, 'Nut allergy',       '+33 6 67 89 01 23'),
  (brasserie_id, CURRENT_DATE + 1, '21:00', 'Thomas Rousseau',  6, '',                  '+33 6 78 90 12 34'),
  -- La Brasserie — Day after
  (brasserie_id, CURRENT_DATE + 2, '12:30', 'Margot Vincent',   2, '',                  '+33 6 89 01 23 45'),
  (brasserie_id, CURRENT_DATE + 2, '19:30', 'Nicolas Laurent',  3, '',                  '+33 6 90 12 34 56'),
  (brasserie_id, CURRENT_DATE + 2, '20:00', 'Elise Simon',      4, 'Vegan',             '+33 6 01 23 45 67');

-- ── Weekly Metrics (last 7 days) ──
INSERT INTO weekly_metrics (client_id, date, calls, reservations) VALUES
  (flour_id,     CURRENT_DATE - 6, 44, 18),
  (flour_id,     CURRENT_DATE - 5, 32, 12),
  (flour_id,     CURRENT_DATE - 4, 16,  6),
  (flour_id,     CURRENT_DATE - 3, 19,  8),
  (flour_id,     CURRENT_DATE - 2, 21,  8),
  (flour_id,     CURRENT_DATE - 1, 26, 11),
  (flour_id,     CURRENT_DATE,     24,  8),

  (harbour_id,   CURRENT_DATE - 6, 28, 12),
  (harbour_id,   CURRENT_DATE - 5, 22,  9),
  (harbour_id,   CURRENT_DATE - 4, 14,  5),
  (harbour_id,   CURRENT_DATE - 3, 18,  7),
  (harbour_id,   CURRENT_DATE - 2, 16,  6),
  (harbour_id,   CURRENT_DATE - 1, 20,  8),
  (harbour_id,   CURRENT_DATE,     18,  6),

  (brasserie_id, CURRENT_DATE - 6, 52, 23),
  (brasserie_id, CURRENT_DATE - 5, 41, 18),
  (brasserie_id, CURRENT_DATE - 4, 28, 11),
  (brasserie_id, CURRENT_DATE - 3, 35, 14),
  (brasserie_id, CURRENT_DATE - 2, 38, 15),
  (brasserie_id, CURRENT_DATE - 1, 44, 19),
  (brasserie_id, CURRENT_DATE,     31, 14);

END $$;
