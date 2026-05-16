-- ─────────────────────────────────────────────────────────────────────────────
-- Sala Smart — Seed Call Logs
-- Run AFTER supabase_schema_v3.sql.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  flour_id     UUID;
  harbour_id   UUID;
  brasserie_id UUID;
BEGIN

SELECT id INTO flour_id     FROM restaurants WHERE slug = 'flour';
SELECT id INTO harbour_id   FROM restaurants WHERE slug = 'harbour';
SELECT id INTO brasserie_id FROM restaurants WHERE slug = 'brasserie';

-- Clear existing demo logs before reseeding
DELETE FROM call_logs WHERE restaurant_id IN (flour_id, harbour_id, brasserie_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- FLOUR PASTIFICIO calls
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO call_logs (restaurant_id, call_date, duration_seconds, outcome, transcript) VALUES
(flour_id, CURRENT_DATE, 142, 'booked',
 E'Agent: Buongiorno, Flour Pastificio, sono Marco. Come posso aiutarla?\nGuest: Vorrei prenotare un tavolo per due stasera alle otto.\nAgent: Certo. A che nome?\nGuest: Sergio Bruno.\nAgent: Perfetto Signor Bruno, due persone alle 20:00. Le invio conferma via SMS.\nGuest: Grazie, arrivederci.'),
(flour_id, CURRENT_DATE, 78, 'no_answer',
 E'[Call connected — no audio detected for 15s]\n[Caller hung up]'),
(flour_id, CURRENT_DATE, 215, 'escalated',
 E'Agent: Buongiorno, Flour Pastificio.\nGuest: [in French] Bonjour, je voudrais réserver pour ce soir.\nAgent: Mi scusi, parla italiano o inglese?\nGuest: [continues in French]\nAgent: Un momento, le passo un collega.\n[Escalated to manager]'),
(flour_id, CURRENT_DATE - 1, 167, 'booked',
 E'Agent: Buongiorno, Flour Pastificio.\nGuest: Vorrei prenotare per quattro persone domani sera.\nAgent: A che ora?\nGuest: Verso le otto e mezza.\nAgent: Va bene. Nome e numero per la conferma?\nGuest: Teresa Amato, 348 800 9900.\nAgent: Confermato. Le ricordo che abbiamo bisogno di sapere allergie.\nGuest: Sì, mia figlia è celiaca.\nAgent: Annotato. A presto.'),
(flour_id, CURRENT_DATE - 1, 94, 'cancelled',
 E'Agent: Flour Pastificio, buongiorno.\nGuest: Buongiorno, devo cancellare la prenotazione di Fabio Costa per stasera.\nAgent: Capisco, la cancello subito. Tutto bene?\nGuest: Sì grazie, problemi di lavoro.\nAgent: Nessun problema, alla prossima.'),
(flour_id, CURRENT_DATE - 2, 188, 'booked',
 E'Agent: Buongiorno, Flour Pastificio.\nGuest: Avete posto per sei persone venerdì sera?\nAgent: Mi dia un momento per controllare. Sì, alle 20:00 possiamo.\nGuest: Perfetto. Walter Rossi, attenzione: allergia alle arachidi grave.\nAgent: Annotato in primo piano. Confermo per venerdì 20:00, sei persone.'),
(flour_id, CURRENT_DATE - 2, 56, 'no_answer',
 E'[Call connected — caller silent]\n[Disconnected after 56s]'),
(flour_id, CURRENT_DATE - 3, 124, 'booked',
 E'Agent: Buongiorno, Flour Pastificio.\nGuest: Tre persone per stasera alle nove?\nAgent: Confermo. Nome?\nGuest: Ugo Caruso.\nAgent: Perfetto, a stasera.'),
(flour_id, CURRENT_DATE - 4, 203, 'escalated',
 E'Agent: Flour Pastificio, buongiorno.\nGuest: Sono molto arrabbiato, ieri sera abbiamo aspettato 40 minuti per il tavolo.\nAgent: Mi dispiace molto. Mi passi il manager per favore?\n[Escalated to Marco — manager callback requested]'),
(flour_id, CURRENT_DATE - 5, 89, 'cancelled',
 E'Guest: Devo cancellare la prenotazione di stasera, scusate.\nAgent: Nessun problema, cancello. Grazie per averci avvisato.'),
(flour_id, CURRENT_DATE - 6, 156, 'booked',
 E'Agent: Buongiorno, Flour Pastificio.\nGuest: Vorrei prenotare per il compleanno di mia moglie.\nAgent: Volentieri. Quante persone, e quando?\nGuest: Otto persone sabato sera, e vorrei una torta sorpresa.\nAgent: Confermato, organizziamo tutto.');

-- ═══════════════════════════════════════════════════════════════════════════
-- HARBOUR GRILL calls
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO call_logs (restaurant_id, call_date, duration_seconds, outcome, transcript) VALUES
(harbour_id, CURRENT_DATE, 132, 'booked',
 E'Agent: Good afternoon, Harbour Grill, this is Aoife.\nGuest: Hi, I''d like a table for four tonight at half eight.\nAgent: Of course — name and number please?\nGuest: Deirdre Walsh, 087 777 8888. Two of us have shellfish allergies.\nAgent: Noted, I''ll flag it with the kitchen. See you at 20:30.'),
(harbour_id, CURRENT_DATE, 67, 'no_answer',
 E'[Connected — no response]\n[Hung up at 67s]'),
(harbour_id, CURRENT_DATE - 1, 198, 'booked',
 E'Agent: Harbour Grill, good evening.\nGuest: Looking for a table for six on Friday.\nAgent: Lunch or dinner?\nGuest: Dinner, around 7 if possible.\nAgent: We have 19:00 free. Name?\nGuest: Laura Jordan, severe nut allergy.\nAgent: Flagged. Phone for confirmation?\nGuest: 087 700 8000.\nAgent: Confirmed, see you Friday.'),
(harbour_id, CURRENT_DATE - 1, 78, 'other',
 E'Guest: Hi, just wondering if you do gluten-free pasta?\nAgent: Yes we do — please mention it when booking.\nGuest: Great, I''ll call back. Thanks.'),
(harbour_id, CURRENT_DATE - 2, 245, 'escalated',
 E'Guest: I''d like to discuss the bill from last Saturday — I think we were overcharged.\nAgent: Let me take your details and have the manager call you back today.\nGuest: Eoin Brennan, 086 999 0000.\n[Manager callback scheduled]'),
(harbour_id, CURRENT_DATE - 3, 112, 'booked',
 E'Guest: Two for tomorrow lunch, 12:30.\nAgent: Of course. Name?\nGuest: Fiona Collins.\nAgent: Confirmed.'),
(harbour_id, CURRENT_DATE - 4, 98, 'cancelled',
 E'Guest: Need to cancel tonight''s booking, sorry — kids are sick.\nAgent: No problem, hope they feel better. Cancelled.'),
(harbour_id, CURRENT_DATE - 5, 174, 'booked',
 E'Agent: Harbour Grill, good morning.\nGuest: Anniversary dinner for two on Saturday at 8pm — can you arrange a window seat?\nAgent: Absolutely. Name?\nGuest: Tara Ryan.\nAgent: Window table reserved for two, Saturday 20:00.');

-- ═══════════════════════════════════════════════════════════════════════════
-- LA BRASSERIE calls
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO call_logs (restaurant_id, call_date, duration_seconds, outcome, transcript) VALUES
(brasserie_id, CURRENT_DATE, 145, 'booked',
 E'Agent: Bonjour, La Brasserie, je suis Claire.\nGuest: Bonjour, je voudrais une table pour six personnes ce soir.\nAgent: À quelle heure ?\nGuest: Vingt heures.\nAgent: Très bien. Au nom de ?\nGuest: Denis Laurent. Une personne a une allergie aux fruits de mer.\nAgent: Noté, je préviens la cuisine.'),
(brasserie_id, CURRENT_DATE, 62, 'no_answer',
 E'[Silence on line, disconnected after 62s]'),
(brasserie_id, CURRENT_DATE - 1, 167, 'booked',
 E'Agent: La Brasserie, bonsoir.\nGuest: Bonsoir, je voudrais réserver pour cinq, demain à dix-neuf heures.\nAgent: Au nom ?\nGuest: Gabrielle Roy. Deux végans.\nAgent: Très bien Madame Roy, c''est noté.'),
(brasserie_id, CURRENT_DATE - 2, 89, 'cancelled',
 E'Guest: Je dois annuler ma réservation de ce soir s''il vous plaît.\nAgent: Bien sûr, annulée. Merci de nous avoir prévenus.'),
(brasserie_id, CURRENT_DATE - 3, 210, 'escalated',
 E'Guest: Bonjour, je voudrais parler au chef au sujet d''un menu spécial.\nAgent: Un instant, je vous le passe.\n[Escalated to Chef]'),
(brasserie_id, CURRENT_DATE - 4, 128, 'booked',
 E'Agent: La Brasserie.\nGuest: Une table pour deux jeudi soir, 19h30.\nAgent: Confirmé. Nom ?\nGuest: Margaux Dubois.\nAgent: Très bien, à jeudi.'),
(brasserie_id, CURRENT_DATE - 5, 92, 'other',
 E'Guest: Vous faites de la livraison ?\nAgent: Non, mais nous avons des plats à emporter. Voulez-vous commander ?\nGuest: Je vais y réfléchir, merci.'),
(brasserie_id, CURRENT_DATE - 6, 156, 'booked',
 E'Agent: La Brasserie, bonjour.\nGuest: Réservation pour trois personnes dimanche midi.\nAgent: À quelle heure ?\nGuest: Treize heures.\nAgent: Confirmé. Nom ?\nGuest: Olivia Fontaine.');

END $$;
