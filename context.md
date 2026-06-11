# Project Context — Flour Pastificio Dashboard + Anna Voice Agent

## What this is

A restaurant management platform for **Flour Pastificio** (Via della Croce 14, Roma).  
Two parts:
1. **Web dashboard** — reservations, calls, escalations, settings, capacity
2. **Anna** — a Vapi voice AI that answers the phone and books reservations via the dashboard's backend

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS + HTML + CSS (no framework), hosted on Netlify |
| Database | Supabase (PostgreSQL) |
| Voice agent | Vapi (GPT-4o Mini + ElevenLabs TTS + Deepgram STT) |
| Backend functions | Supabase Edge Functions (Deno/TypeScript) |

**Supabase project:** `rxjcxbbdyewerpeeljjz`  
**Repo:** `github.com/muhdanas05/flour-pastificio-dashboard`

---

## Database schema (key tables)

| Table | Purpose |
|---|---|
| `restaurants` | One row per restaurant. Has `slug`, `vapi_assistant_id`, `booking_mode`, `avg_spend_per_cover` |
| `reservations` | Core bookings table. `source` = `agent` or `manual` |
| `opening_hours` | Per-weekday hours + `max_covers` per restaurant |
| `closures` | Specific closed dates |
| `customers` | Lightweight CRM — phone + name + staff notes |
| `call_logs` | Every call Anna handles, with transcript and outcome |
| `escalations` | Calls Anna couldn't handle — passed to the human team |
| `restaurant_tables` | Physical tables (used when `booking_mode = 'tables'`) |

---

## Dashboard views

- **Overview** — today's stats (bookings, covers, available slots, revenue, escalations), capacity bar, availability by turn, hourly chart, today's reservations, no-show rate
- **Reservations** — full CRUD table with date navigation and status filters
- **Calls** — call log with transcript viewer
- **Settings** — restaurant info, opening hours, capacity by day, service turns, closed dates, tables

### Service Turns feature
Turns (e.g. 11:30–13:00, 13:00–14:30, 18:30–20:30, 20:30–22:30) are configured in Settings → Service Turns. Stored in `localStorage` per restaurant. Shown in Overview → Availability by Turn with colour-coded fill bars.

---

## Anna — voice agent

**File:** `anna-system-prompt.md` — full system prompt  
**File:** `anna-vapi-setup.md` — complete Vapi configuration guide (model, voice, transcriber, speech plans, tools, idle messages)

### Anna's tool endpoints (Supabase Edge Functions)

All functions live in `supabase/functions/`. Auth via `X-Vapi-Secret` header. Restaurant identified via `?rid=<restaurant_uuid>` query param.

| Vapi tool name | Function folder | URL pattern |
|---|---|---|
| `check_availability` | `check-availability/` | `.../check-availability?rid=<uuid>` |
| `book_reservation` | `book-reservation/` | `.../book-reservation?rid=<uuid>` |
| `lookup_reservation` | `lookup-reservation/` | `.../lookup-reservation?rid=<uuid>` |
| `modify_reservation` | `modify-reservation/` | `.../modify-reservation?rid=<uuid>` |
| `cancel_reservation` | `cancel-reservation/` | `.../cancel-reservation?rid=<uuid>` |

Skipped for now (not yet built): `send_whatsapp_confirmation`, `get_menu_recommendations`

### Shared utilities
`supabase/functions/_shared/utils.ts` — Supabase client, Vapi request parser, CORS headers, auth check, time helpers.

---

## Deployment

### Dashboard
Hosted on Netlify. `build.js` injects Supabase credentials at build time.

### Edge Functions
**Status: code written, not yet deployed to Supabase.**

To deploy (one-time setup):
1. Get a Personal Access Token from https://supabase.com/dashboard/account/tokens
2. Run:
```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxxxx
bash deploy-functions.sh
```

The deploy script deploys all 5 functions and prints the final URLs.

### Vapi tools
**Status: not yet configured in Vapi dashboard.**

Once functions are deployed, set each tool's `server.url` in the Vapi assistant to:
```
https://rxjcxbbdyewerpeeljjz.supabase.co/functions/v1/<function-name>?rid=<flour-restaurant-uuid>
```

---

## Flour Pastificio restaurant UUID

Run this in the Supabase SQL editor to get it:
```sql
SELECT id, name, slug FROM restaurants WHERE slug = 'flour';
```

---

## Next steps

### 1. Deploy the Edge Functions
- Generate a PAT at https://supabase.com/dashboard/account/tokens
- Run `bash deploy-functions.sh`

### 2. Configure Vapi tools
- Get Flour's restaurant UUID from Supabase (see query above)
- In Vapi dashboard → Anna assistant → Tools tab
- Set `server.url` on all 5 tools to the deployed Edge Function URLs with `?rid=<uuid>`
- Set `X-Vapi-Secret` header in each tool (optional but recommended for production)

### 3. Set VAPI_SECRET on Supabase (optional, recommended for production)
```bash
supabase secrets set VAPI_SECRET=your_secret --project-ref rxjcxbbdyewerpeeljjz
```
Then add the same value as a header secret in each Vapi tool definition.

### 4. Test the full Anna call flow
Use the 5 test scenarios in `anna-vapi-setup.md` Step 10:
- Standard booking
- Allergy handling
- Large group (30 people)
- Cancellation
- Interruption stress test

### 5. Build WhatsApp confirmation
Add `send_whatsapp_confirmation` edge function using Twilio or Meta Cloud API.  
Triggered after a successful `book_reservation` if the guest agrees.

### 6. Build menu recommendations
Add `get_menu_recommendations` edge function.  
Options: static lookup table in the function, or a `menu_items` table in Supabase.

### 7. Wire Service Turns to the backend
Currently turns are stored in `localStorage` (per-browser). For production, move them to a `restaurant_turns` table in Supabase so they persist across devices and are accessible to the Edge Functions for smarter availability checking.

### 8. Multi-restaurant rollout
The dashboard and all Edge Functions are already multi-tenant (`restaurant_id` on every table, `?rid=` on every function). To add a new restaurant:
- Insert a row in `restaurants`
- Set up opening hours and turns in Settings
- Clone the Vapi assistant, point tools at the same Edge Functions with the new `?rid=`
