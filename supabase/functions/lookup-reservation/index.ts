import {
  corsHeaders,
  getSupabase,
  isAuthorized,
  parseVapiBody,
  vapiResponse,
  resolveDate,
} from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return vapiResponse(null, { error: 'Unauthorized' }, 401);
  }

  const rid = new URL(req.url).searchParams.get('rid');
  if (!rid) {
    return vapiResponse(null, { error: 'Missing ?rid= restaurant ID' }, 400);
  }

  const { toolCallId, args } = await parseVapiBody(req);
  const { guest_name, date } = args as {
    guest_name: string;
    date: string;
  };

  if (!guest_name || !date) {
    return vapiResponse(toolCallId, {
      found: false,
      error: 'Missing guest_name or date',
    });
  }

  const resolvedDate = resolveDate(date);
  const supabase = getSupabase();

  // Search by name (case-insensitive) + date, non-cancelled
  const { data: rows } = await supabase
    .from('reservations')
    .select('id, customer_name, customer_phone, date, time, party_size, duration_minutes, status, notes')
    .eq('restaurant_id', rid)
    .eq('date', resolvedDate)
    .ilike('customer_name', `%${guest_name}%`)
    .neq('status', 'cancelled')
    .order('time');

  if (!rows || rows.length === 0) {
    return vapiResponse(toolCallId, {
      found: false,
      message: `Nessuna prenotazione trovata per ${guest_name} il ${resolvedDate}.`,
    });
  }

  // Return the first match (most likely if multiple on same day)
  const r = rows[0];
  return vapiResponse(toolCallId, {
    found: true,
    reservation_id:  r.id,
    guest_name:      r.customer_name,
    phone:           r.customer_phone ?? null,
    date:            r.date,
    time:            r.time.slice(0, 5),
    party_size:      r.party_size,
    duration_minutes: r.duration_minutes ?? 90,
    status:          r.status,
    notes:           r.notes ?? null,
    message: `Trovata: ${r.customer_name}, ${r.party_size} ${r.party_size === 1 ? 'persona' : 'persone'}, ${r.date} alle ${r.time.slice(0, 5)}.`,
  });
});
