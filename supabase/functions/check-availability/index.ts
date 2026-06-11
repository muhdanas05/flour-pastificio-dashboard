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
  const { date, time, party_size } = args as {
    date: string;
    time: string;
    party_size: number;
  };

  if (!date || !time || !party_size) {
    return vapiResponse(toolCallId, {
      available: false,
      error: 'Missing date, time or party_size',
    });
  }

  const resolvedDate = resolveDate(date);
  const supabase = getSupabase();

  // 1. Check closures
  const { data: closure } = await supabase
    .from('closures')
    .select('id')
    .eq('restaurant_id', rid)
    .eq('date', resolvedDate)
    .maybeSingle();

  if (closure) {
    return vapiResponse(toolCallId, {
      available: false,
      reason: 'closed',
      message: 'Il ristorante è chiuso quel giorno.',
    });
  }

  // 2. Check opening hours for that weekday
  const dow = new Date(resolvedDate + 'T00:00:00').getDay();
  const { data: oh } = await supabase
    .from('opening_hours')
    .select('*')
    .eq('restaurant_id', rid)
    .eq('day_of_week', dow)
    .maybeSingle();

  if (!oh || !oh.is_active) {
    return vapiResponse(toolCallId, {
      available: false,
      reason: 'closed',
      message: 'Il ristorante non è aperto quel giorno.',
    });
  }

  const openMins  = timeToMins(oh.open_time);
  const closeMins = timeToMins(oh.close_time);
  const reqMins   = timeToMins(time);

  if (reqMins < openMins || reqMins >= closeMins) {
    return vapiResponse(toolCallId, {
      available: false,
      reason: 'outside_hours',
      open_time: oh.open_time.slice(0, 5),
      close_time: oh.close_time.slice(0, 5),
      message: `Siamo aperti dalle ${oh.open_time.slice(0, 5)} alle ${oh.close_time.slice(0, 5)}.`,
    });
  }

  // 3. Count overlapping covers for the requested slot
  //    A reservation overlaps if its session window intersects [reqMins, reqMins+90)
  const { data: existing } = await supabase
    .from('reservations')
    .select('time, party_size, duration_minutes')
    .eq('restaurant_id', rid)
    .eq('date', resolvedDate)
    .neq('status', 'cancelled');

  const reqEndMins = reqMins + 90;
  const bookedCovers = (existing ?? []).reduce((sum, r) => {
    const rStart = timeToMins(r.time);
    const rEnd   = rStart + (r.duration_minutes ?? 90);
    return rStart < reqEndMins && rEnd > reqMins ? sum + r.party_size : sum;
  }, 0);

  const maxCovers       = oh.max_covers || 80;
  const availableCovers = Math.max(0, maxCovers - bookedCovers);
  const available       = availableCovers >= party_size;

  return vapiResponse(toolCallId, {
    available,
    booked_covers: bookedCovers,
    max_covers: maxCovers,
    available_covers: availableCovers,
    message: available
      ? `Disponibile. ${availableCovers} posti liberi.`
      : `Non disponibile alle ${time}. Rimangono solo ${availableCovers} posti.`,
  });
});
