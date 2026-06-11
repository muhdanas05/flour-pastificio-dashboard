import {
  corsHeaders,
  getSupabase,
  isAuthorized,
  parseVapiBody,
  vapiResponse,
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
  const { reservation_id } = args as { reservation_id: string };

  if (!reservation_id) {
    return vapiResponse(toolCallId, {
      success: false,
      error: 'Missing reservation_id',
    });
  }

  const supabase = getSupabase();

  // Verify reservation belongs to this restaurant before cancelling
  const { data: existing } = await supabase
    .from('reservations')
    .select('id, customer_name, date, time, party_size, status')
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

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservation_id);

  if (error) {
    return vapiResponse(toolCallId, {
      success: false,
      error: 'Errore durante la cancellazione. Riprovo.',
    });
  }

  return vapiResponse(toolCallId, {
    success: true,
    reservation_id,
    message: `Prenotazione di ${existing.customer_name} per il ${existing.date} alle ${existing.time.slice(0, 5)} cancellata.`,
  });
});
