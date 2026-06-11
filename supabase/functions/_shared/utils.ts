import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS headers ─────────────────────────────────────────────────────────────
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-vapi-secret',
};

// ── Supabase client (service role — bypasses RLS) ────────────────────────────
export function getSupabase(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ── Auth: check X-Vapi-Secret header ─────────────────────────────────────────
export function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get('VAPI_SECRET');
  if (!secret) return true; // no secret configured → open (useful for dev)
  return req.headers.get('x-vapi-secret') === secret;
}

// ── Parse Vapi tool-call request body ────────────────────────────────────────
// Vapi sends: { message: { toolCallList: [{ id, function: { name, arguments } }] } }
// Returns: { toolCallId, args }
// Falls back to treating the whole body as args (for direct testing).
export async function parseVapiBody(
  req: Request,
): Promise<{ toolCallId: string | null; args: Record<string, unknown> }> {
  const body = await req.json();

  const toolCall = body?.message?.toolCallList?.[0];
  if (toolCall) {
    const rawArgs = toolCall.function?.arguments;
    const args =
      typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs ?? {});
    return { toolCallId: toolCall.id ?? null, args };
  }

  // Direct call (testing / non-Vapi)
  return { toolCallId: null, args: body ?? {} };
}

// ── Build Vapi-compatible response ───────────────────────────────────────────
export function vapiResponse(
  toolCallId: string | null,
  result: Record<string, unknown>,
  status = 200,
): Response {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const body = toolCallId
    ? { results: [{ toolCallId, result: JSON.stringify(result) }] }
    : result;
  return new Response(JSON.stringify(body), { status, headers });
}

// ── Time helpers ─────────────────────────────────────────────────────────────
export function timeToMins(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// "today" / "tomorrow" → YYYY-MM-DD
export function resolveDate(date: string): string {
  const today = todayISO();
  if (date === 'today') return today;
  if (date === 'tomorrow') return addDays(today, 1);
  return date;
}
