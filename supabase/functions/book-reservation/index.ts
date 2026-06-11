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
  const {
    date,
    time,
    party_size,
    guest_name,
    phone,
    dietary_notes,
    occasion,
  } = args as {
    date: string;
    time: string;
    party_size: number;
    guest_name: string;
    phone?: string;
    dietary_notes?: string;
    occasion?: string;
  };

  if (!date || !time || !party_size || !guest_name) {
    return vapiResponse(toolCallId, {
      success: false,
      error: 'Missing required fields: date, time, party_size, guest_name',
    });
  }

  const resolvedDate = resolveDate(date);
  const supabase = getSupabase();

  // Upsert customer record (by phone + restaurant)
  let customerId: string | null = null;
  if (phone) {
    const { data: customer } = await supabase
      .from('customers')
      .upsert(
        { restaurant_id: rid, phone, name: guest_name },
        { onConflict: 'restaurant_id,phone', ignoreDuplicates: false },
      )
      .select('id')
      .single();
    customerId = customer?.id ?? null;
  }

  // Build notes string
  const notesParts: string[] = [];
  if (dietary_notes) notesParts.push(dietary_notes);
  if (occasion)      notesParts.push(`Occasione: ${occasion}`);
  const notes = notesParts.join(' | ') || null;

  // Insert reservation
  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      restaurant_id:    rid,
      customer_id:      customerId,
      customer_name:    guest_name,
      customer_phone:   phone || null,
      date:             resolvedDate,
      time,
      party_size,
      duration_minutes: 90,
      status:           'confirmed',
      source:           'agent',
      notes,
    })
    .select('id')
    .single();

  if (error || !reservation) {
    return vapiResponse(toolCallId, {
      success: false,
      error: 'Impossibile creare la prenotazione. Riprovo tra un attimo.',
    });
  }

  return vapiResponse(toolCallId, {
    success: true,
    reservation_id: reservation.id,
    message: `Prenotazione confermata. ${guest_name}, ${party_size} ${party_size === 1 ? 'persona' : 'persone'}, ${resolvedDate} alle ${time}.`,
  });
});
