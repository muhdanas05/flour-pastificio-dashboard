import {
  corsHeaders,
  getSupabase,
  isAuthorized,
  parseVapiBody,
  vapiResponse,
  resolveDate,
  timeToMins,
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
  const { reservation_id, new_date, new_time, new_party_size } = args as {
    reservation_id: string;
    new_date?: string;
    new_time?: string;
    new_party_size?: number;
  };

  if (!reservation_id) {
    return vapiResponse(toolCallId, {
      success: false,
      error: 'Missing reservation_id',
    });
  }

  const supabase = getSupabase();

  // Fetch existing reservation and verify it belongs to this restaurant
  const { data: existing } = await supabase
    .from('reservations')
    .select('id, restaurant_id, date, time, party_size, duration_minutes, customer_name, status')
    .eq('id', reservation_id)
    .eq('restaurant_id', rid)
    .maybeSingle();

  if (!existing) {
    return vapiResponse(toolCallId, {
      success: false,
      message: 'Prenotazione non trovata.',
    });
  }

  if (existing.status === 'cancelled') {
    return vapiResponse(toolCallId, {
      success: false,
      message: 'Questa prenotazione è già stata cancellata.',
    });
  }

  const targetDate      = new_date ? resolveDate(new_date) : existing.date;
  const targetTime      = new_time ?? existing.time.slice(0, 5);
  const targetPartySize = new_party_size ?? existing.party_size;

  // If date or time changed, verify availability for the new slot
  if (new_date || new_time || new_party_size) {
    const dow = new Date(targetDate + 'T00:00:00').getDay();
    const { data: oh } = await supabase
      .from('opening_hours')
      .select('*')
      .eq('restaurant_id', rid)
      .eq('day_of_week', dow)
      .maybeSingle();

    if (!oh || !oh.is_active) {
      return vapiResponse(toolCallId, {
        success: false,
        message: 'Il ristorante non è aperto in quella data.',
      });
    }

    // Check capacity (exclude this reservation from the count)
    const { data: others } = await supabase
      .from('reservations')
      .select('time, party_size, duration_minutes')
      .eq('restaurant_id', rid)
      .eq('date', targetDate)
      .neq('status', 'cancelled')
      .neq('id', reservation_id);

    const reqMins    = timeToMins(targetTime);
    const reqEndMins = reqMins + (existing.duration_minutes ?? 90);

    const bookedCovers = (others ?? []).reduce((sum, r) => {
      const rStart = timeToMins(r.time);
      const rEnd   = rStart + (r.duration_minutes ?? 90);
      return rStart < reqEndMins && rEnd > reqMins ? sum + r.party_size : sum;
    }, 0);

    const available = (oh.max_covers || 80) - bookedCovers;
    if (available < targetPartySize) {
      return vapiResponse(toolCallId, {
        success: false,
        available_covers: Math.max(0, available),
        message: `Non c'è disponibilità per ${targetPartySize} persone in quel orario. Rimangono ${Math.max(0, available)} posti.`,
      });
    }
  }

  // Apply the update
  const patch: Record<string, unknown> = {};
  if (new_date)       patch.date       = targetDate;
  if (new_time)       patch.time       = targetTime;
  if (new_party_size) patch.party_size = targetPartySize;

  const { error } = await supabase
    .from('reservations')
    .update(patch)
    .eq('id', reservation_id);

  if (error) {
    return vapiResponse(toolCallId, {
      success: false,
      error: 'Errore durante la modifica. Riprovo.',
    });
  }

  return vapiResponse(toolCallId, {
    success: true,
    reservation_id,
    date:       targetDate,
    time:       targetTime,
    party_size: targetPartySize,
    message: `Modifica confermata: ${existing.customer_name}, ${targetPartySize} ${targetPartySize === 1 ? 'persona' : 'persone'}, ${targetDate} alle ${targetTime}.`,
  });
});
