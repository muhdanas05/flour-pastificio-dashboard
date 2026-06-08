/* ============================================================
   Sala Smart — Dashboard App
   Supabase credentials injected by build.js at deploy time.
============================================================ */

'use strict';

/* ─── Supabase client ──────────────────────────────────────────────────────── */
const SUPA_URL = '%%SUPABASE_URL%%';
const SUPA_KEY = '%%SUPABASE_KEY%%';
const { createClient } = supabase;
const db = createClient(SUPA_URL, SUPA_KEY);

/* ─── Auth config ──────────────────────────────────────────────────────────── */
const USERS = {
  'admin':     { password: 'admin2024',     role: 'admin',  restaurantSlug: null },
  'flour':     { password: 'flour2024',     role: 'client', restaurantSlug: 'flour' },
  'harbour':   { password: 'harbour2024',   role: 'client', restaurantSlug: 'harbour' },
  'brasserie': { password: 'brasserie2024', role: 'client', restaurantSlug: 'brasserie' },
};

/* ─── App state ────────────────────────────────────────────────────────────── */
let session      = null;   // { username, role, restaurantSlug }
let restaurant   = null;   // full restaurants row
let restaurants  = [];     // all restaurants (admin only)
let resDate      = null;   // set after isoDate is defined
let resFilter    = 'all';
let todayCapacity = 0;     // session-only slider value
let selectedDayCap = null; // settings capacity editor — which day index is selected
let ohData       = [];     // opening_hours rows for current restaurant

/* ─── Utility ──────────────────────────────────────────────────────────────── */
function isoDate(d) {
  // Use local time components — toISOString() converts to UTC and drifts by timezone offset
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr.toString().padStart(2,'0')}:${m}`;
}
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
}
function fmtDateShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
const ALLERGY_KEYWORDS = ['allergy','allergic','intolerant','intolerance','coeliac','celiac','nut','gluten','dairy','lactose','vegan','vegetarian','halal','kosher'];
function hasAllergyFlag(notes) {
  if (!notes) return false;
  const n = notes.toLowerCase();
  return ALLERGY_KEYWORDS.some(k => n.includes(k));
}
function allergyBadge() {
  return `<span class="allergy-flag">&#9888; Allergy</span>`;
}
function statusBadge(s) {
  const labels = { confirmed:'Confirmed', arrived:'Arrived', no_show:'No-show', cancelled:'Cancelled' };
  return `<span class="badge badge-${s}">${labels[s] ?? s}</span>`;
}
function sourceBadge(s) {
  return `<span class="badge badge-${s}">${s === 'agent' ? 'Agent' : 'Manual'}</span>`;
}
function showToast(msg) {
  const el = document.getElementById('save-msg');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Initialise resDate here, after isoDate is defined
resDate = isoDate(new Date());

/* ─── Login ────────────────────────────────────────────────────────────────── */
document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  const username = document.getElementById('login-user').value.trim().toLowerCase();
  const password = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-error');
  const user     = USERS[username];
  if (!user || user.password !== password) {
    errEl.textContent = 'Incorrect username or password.';
    return;
  }
  errEl.textContent = '';
  session = { username, role: user.role, restaurantSlug: user.restaurantSlug };
  sessionStorage.setItem('sala_session', JSON.stringify(session));
  bootApp();
}

function doLogout() {
  session = null;
  restaurant = null;
  sessionStorage.removeItem('sala_session');
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

document.getElementById('btn-logout').addEventListener('click', doLogout);

/* ─── Boot ─────────────────────────────────────────────────────────────────── */
async function bootApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('active');

  if (session.role === 'admin') {
    const { data } = await db.from('restaurants').select('*').order('name');
    restaurants = data ?? [];
    setupAdminSelector();
  } else {
    const { data } = await db.from('restaurants').select('*').eq('slug', session.restaurantSlug).single();
    restaurant = data;
    document.getElementById('restaurant-select').style.display = 'none';
    document.getElementById('restaurant-name-display').textContent = restaurant?.name ?? '';
  }

  navigate(location.hash.replace('#','') || 'overview');
}

function setupAdminSelector() {
  const sel = document.getElementById('restaurant-select');
  sel.style.display = 'block';
  document.getElementById('restaurant-name-display').style.display = 'none';
  sel.innerHTML = restaurants.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  restaurant = restaurants[0] ?? null;
  sel.value = restaurant?.id ?? '';
  sel.addEventListener('change', () => {
    restaurant = restaurants.find(r => r.id === sel.value) ?? null;
    renderCurrentView();
  });
}

/* ─── Routing ──────────────────────────────────────────────────────────────── */
const VIEWS = ['overview','reservations','calls','settings'];

function navigate(view) {
  VIEWS.forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('active', v === view);
    document.querySelector(`.nav-item[data-view="${v}"]`).classList.toggle('active', v === view);
  });
  location.hash = view;
  renderCurrentView();
}

function renderCurrentView() {
  const active = document.querySelector('.view.active')?.id?.replace('view-','');
  if (active === 'overview')     loadOverview();
  if (active === 'reservations') loadReservations();
  if (active === 'calls')        loadCalls();
  if (active === 'settings')     loadSettings();
}

document.querySelectorAll('.nav-item[data-view]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.view));
});
window.navigate = navigate;

window.addEventListener('hashchange', () => {
  const v = location.hash.replace('#','');
  if (VIEWS.includes(v)) navigate(v);
});

/* ─── Shared helpers used by multiple features ──────────────────────────────── */
function whatsappLink(phone, text) {
  if (!phone) return '#';
  const clean = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  const msg = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${clean}${msg}`;
}
function telLink(phone) {
  if (!phone) return '#';
  return `tel:${phone.replace(/\s/g, '')}`;
}
function fmtMoney(n) {
  return '€' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
}
function fmtDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2,'0')}s` : `${s}s`;
}

// No-show count map per customer (used by Overview + Reservations tables)
let _noShowMap = new Map();
async function loadNoShowMap() {
  if (!restaurant) return new Map();
  const { data } = await db.from('reservations')
    .select('customer_id, customer_phone')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'no_show');
  const m = new Map();
  (data ?? []).forEach(r => {
    const key = r.customer_id || `phone:${r.customer_phone || ''}`;
    if (!key.endsWith(':')) m.set(key, (m.get(key) ?? 0) + 1);
  });
  _noShowMap = m;
  return m;
}
function noShowCountFor(r) {
  const key = r.customer_id || `phone:${r.customer_phone || ''}`;
  return _noShowMap.get(key) ?? 0;
}
function noShowFlagHTML(r) {
  const n = noShowCountFor(r);
  return n >= 2 ? `<span class="noshow-flag">&#9888; ${n} no-shows</span>` : '';
}

// Reusable open/close helpers for the extra modals
function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

/* ─── Overview ─────────────────────────────────────────────────────────────── */
async function loadOverview() {
  if (!restaurant) return;
  const today = isoDate(new Date());

  document.getElementById('ov-date-label').textContent = fmtDate(today);

  const [resResult, escResult, ohResult] = await Promise.all([
    db.from('reservations')
      .select('*, restaurant_tables(table_name)')
      .eq('restaurant_id', restaurant.id)
      .eq('date', today),
    db.from('escalations')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('resolved', false),
    db.from('opening_hours')
      .select('*')
      .eq('restaurant_id', restaurant.id),
  ]);

  const allRes = resResult.data ?? [];
  const escs   = escResult.data ?? [];
  ohData       = ohResult.data ?? [];

  const activeRes   = allRes.filter(r => r.status !== 'cancelled');
  const bookedCovers = activeRes.reduce((s, r) => s + (r.party_size ?? 0), 0);

  // No-show map (used by reservation rows below)
  await loadNoShowMap();

  // Capacity: use slider session value or today's opening_hours default
  const todayDow = new Date().getDay();
  const todayOH  = ohData.find(h => h.day_of_week === todayDow);
  if (todayCapacity === 0) {
    todayCapacity = todayOH?.max_covers ?? 80;
  }

  // Sync slider
  const slider = document.getElementById('capacity-slider');
  slider.value = todayCapacity;
  slider.max   = Math.max(300, todayCapacity + 50);
  updateCapacityUI(bookedCovers, todayCapacity);

  slider.oninput = () => {
    todayCapacity = parseInt(slider.value, 10);
    updateCapacityUI(bookedCovers, todayCapacity);
    updateRevenueTile(bookedCovers);
  };

  document.getElementById('btn-save-capacity').onclick = async () => {
    if (!todayOH) { showToast('No opening hours set for today'); return; }
    await db.from('opening_hours').update({ max_covers: todayCapacity }).eq('id', todayOH.id);
    showToast('Default capacity saved');
  };

  // Stats
  document.getElementById('stat-bookings').textContent    = activeRes.length;
  document.getElementById('stat-covers').textContent      = bookedCovers;
  document.getElementById('stat-slots').textContent       = Math.max(0, todayCapacity - bookedCovers);
  document.getElementById('stat-escalations').textContent = escs.length;
  updateRevenueTile(bookedCovers);

  // Availability by turn
  renderTurnsOverview(activeRes);

  // Time-slot occupancy
  renderTimeSlotOccupancy(activeRes, todayOH, todayCapacity);

  // No-show breakdown (last 30 days)
  loadNoShowBreakdown();

  // Today's reservations
  const sorted = [...activeRes].sort((a,b) => a.time.localeCompare(b.time));
  const resBody = document.getElementById('ov-res-body');
  document.getElementById('ov-res-count').textContent = sorted.length;
  // Colonna Table visibile solo in modalità "tavoli"
  resBody.closest('table')?.classList.toggle('show-table-col', restaurant?.booking_mode === 'tables');
  // "See all" sempre visibile quando c'è almeno una prenotazione
  const seeAll = document.getElementById('ov-see-all');
  if (seeAll) seeAll.style.display = sorted.length > 0 ? 'flex' : 'none';

  if (sorted.length === 0) {
    resBody.innerHTML = `<tr><td colspan="10" class="empty-state">No reservations today</td></tr>`;
  } else {
    resBody.innerHTML = sorted.slice(0, 3).map(r => {
      const notes = r.notes ? (hasAllergyFlag(r.notes) ? allergyBadge() + esc(r.notes).slice(0,40) : esc(r.notes).slice(0,40)) : '<span style="color:var(--muted)">—</span>';
      const guestArg = `'${r.customer_id ?? ''}','${(r.customer_phone || '').replace(/'/g, "\\'")}','${esc(r.customer_name ?? '').replace(/'/g, "\\'")}'`;
      const tableName = r.restaurant_tables?.table_name ?? '—';
      return `<tr>
        <td class="td-time">${fmtTime(r.time)}</td>
        <td class="td-guest"><span class="guest-link" onclick="openGuestProfile(${guestArg})">${esc(r.customer_name)}</span>${noShowFlagHTML(r)}</td>
        <td>${r.party_size}</td>
        <td class="td-muted col-table">${esc(tableName)}</td>
        <td class="td-muted col-duration">${r.duration_minutes ?? 90} min</td>
        <td class="td-notes" data-fulltext="${esc(r.notes ?? '')}">${notes}</td>
        <td>${reminderCellHTML(r)}</td>
        <td>${sourceBadge(r.source ?? 'manual')}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="td-actions">
          <button class="btn-inline arrived" onclick="quickStatus('${r.id}','arrived')">Arrived</button>
          <button class="btn-inline noshow" onclick="quickStatus('${r.id}','no_show')">No-show</button>
          <button class="btn-inline edit" onclick="openEditModal('${r.id}')" title="Edit">Edit</button>
          ${r.status !== 'cancelled' ? `<button class="btn-inline danger" onclick="cancelReservation('${r.id}')" title="Cancel">Cancel</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  // Escalations
  const escList  = document.getElementById('ov-esc-list');
  const escCount = document.getElementById('ov-esc-count');
  escCount.textContent = escs.length;

  if (escs.length === 0) {
    escList.innerHTML = `<div class="empty-state">No open escalations</div>`;
  } else {
    escList.innerHTML = escs.map(e => `
      <div class="escalation-item clickable" onclick="openEscalationModal('${e.id}')">
        <div class="escalation-info">
          <div class="escalation-name">${esc(e.customer_name ?? 'Unknown')}</div>
          <div class="escalation-meta">${esc(e.type ?? 'Special Request')} &middot; ${esc(e.received_at ?? '')}</div>
          ${e.note ? `<div class="escalation-note">${esc(e.note).slice(0, 120)}${e.note.length > 120 ? '…' : ''}</div>` : ''}
        </div>
        <span class="escalation-arrow">&#8250;</span>
      </div>
    `).join('');
  }
}

function updateRevenueTile(covers) {
  const avg = Number(restaurant?.avg_spend_per_cover ?? 35);
  const revenue = covers * avg;
  document.getElementById('stat-revenue').textContent = fmtMoney(revenue);
  document.getElementById('stat-revenue-meta').textContent = `${fmtMoney(avg)}/cover`;
}

/* ─── Time-slot occupancy ─────────────────────────────────────────────────── */
function renderTimeSlotOccupancy(reservations, todayOH, capacity) {
  const container = document.getElementById('slot-occupancy');
  if (!todayOH || !todayOH.is_active) {
    container.innerHTML = `<div class="empty-state">No opening hours set for today</div>`;
    return;
  }
  const openH  = parseInt(todayOH.open_time.split(':')[0], 10);
  const closeH = parseInt(todayOH.close_time.split(':')[0], 10);
  const totalHours = Math.max(1, closeH - openH);
  const perHourCap = Math.max(1, Math.round(capacity / totalHours));

  const buckets = [];
  for (let h = openH; h < closeH; h++) {
    let covers = 0;
    reservations.forEach(r => {
      const rStart = parseInt(r.time.split(':')[0], 10) + parseInt(r.time.split(':')[1], 10) / 60;
      const rEnd   = rStart + (r.duration_minutes ?? 90) / 60;
      if (rStart < h + 1 && rEnd > h) covers += r.party_size ?? 0;
    });
    buckets.push({ hour: h, covers });
  }

  container.innerHTML = buckets.map(b => {
    const pct = Math.min(100, Math.round(b.covers / perHourCap * 100));
    const cls = pct >= 100 ? 'over' : pct >= 75 ? 'full' : pct >= 50 ? 'busy' : '';
    return `<div class="slot-row">
      <span class="slot-time">${b.hour.toString().padStart(2,'0')}:00</span>
      <div class="slot-bar-wrap"><div class="slot-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="slot-meta"><strong>${b.covers}</strong> / ${perHourCap} (${pct}%)</span>
    </div>`;
  }).join('');
}

/* ─── No-show source breakdown (last 30 days) ─────────────────────────────── */
async function loadNoShowBreakdown() {
  if (!restaurant) return;
  const cutoff = addDays(isoDate(new Date()), -30);
  const { data } = await db.from('reservations')
    .select('source, status')
    .eq('restaurant_id', restaurant.id)
    .gte('date', cutoff);

  const rows = data ?? [];
  const agentTotal  = rows.filter(r => r.source === 'agent').length;
  const agentNo     = rows.filter(r => r.source === 'agent' && r.status === 'no_show').length;
  const manualTotal = rows.filter(r => r.source === 'manual').length;
  const manualNo    = rows.filter(r => r.source === 'manual' && r.status === 'no_show').length;

  const pct = (n, t) => t === 0 ? '0%' : `${Math.round(n / t * 100)}%`;
  document.getElementById('ns-agent').textContent       = pct(agentNo, agentTotal);
  document.getElementById('ns-agent-meta').textContent  = `${agentNo} of ${agentTotal} bookings`;
  document.getElementById('ns-manual').textContent      = pct(manualNo, manualTotal);
  document.getElementById('ns-manual-meta').textContent = `${manualNo} of ${manualTotal} bookings`;
}

function updateCapacityUI(booked, capacity) {
  document.getElementById('cap-booked').textContent     = booked;
  document.getElementById('cap-total').textContent      = capacity;
  document.getElementById('cap-slider-val').textContent = capacity;
  document.getElementById('stat-slots').textContent     = Math.max(0, capacity - booked);
  const pct  = capacity > 0 ? Math.min(100, Math.round(booked / capacity * 100)) : 0;
  const fill = document.getElementById('cap-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('full', pct >= 100);
}

async function quickStatus(id, status) {
  await db.from('reservations').update({ status }).eq('id', id);
  loadOverview();
  if (document.getElementById('view-reservations').classList.contains('active')) loadReservations();
}

async function resolveEscalation(id) {
  await db.from('escalations').update({ resolved: true }).eq('id', id);
  showToast('Escalation resolved');
  loadOverview();
}

// Expose to inline onclick
window.quickStatus       = quickStatus;
window.resolveEscalation = resolveEscalation;
window.openEditModal     = openEditModal;

/* ─── Reservations view ─────────────────────────────────────────────────────── */
// Date nav
function changeDate(n) {
  resDate = n === 0 ? isoDate(new Date()) : addDays(resDate, n);
  syncDateNav();
  loadReservations();
}

document.getElementById('res-prev').addEventListener('click', () => changeDate(-1));
document.getElementById('res-next').addEventListener('click', () => changeDate(+1));
document.getElementById('res-today-btn').addEventListener('click', () => changeDate(0));
document.getElementById('res-date-input').addEventListener('change', e => {
  if (e.target.value) { resDate = e.target.value; syncDateNav(); loadReservations(); }
});

function syncDateNav() {
  const label = document.getElementById('res-date-label');
  const today = isoDate(new Date());
  label.textContent = fmtDate(resDate) + (resDate === today ? ' — Today' : '');
  document.getElementById('res-date-input').value = resDate;
}

// Filter tabs
document.getElementById('res-filter-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  resFilter = tab.dataset.filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t === tab));
  renderReservationsTable(window._resRows ?? []);
});

let _resRows = [];

async function loadReservations() {
  if (!restaurant) return;
  syncDateNav();

  document.getElementById('res-body').innerHTML =
    `<tr><td colspan="11" class="empty-state" style="padding-top:24px;">Loading…</td></tr>`;

  const [resQ] = await Promise.all([
    db.from('reservations')
      .select('*, restaurant_tables(table_name)')
      .eq('restaurant_id', restaurant.id)
      .eq('date', resDate)
      .order('time'),
    loadNoShowMap(),
  ]);

  if (resQ.error) {
    document.getElementById('res-body').innerHTML =
      `<tr><td colspan="11" class="empty-state" style="padding-top:24px;color:var(--red);">Failed to load — ${resQ.error.message}</td></tr>`;
    return;
  }

  _resRows = resQ.data ?? [];
  window._resRows = _resRows;
  renderReservationsTable(_resRows);
}

function reminderCellHTML(r) {
  if (!restaurant?.reminders_enabled || r.status !== 'confirmed') {
    return '<span style="color:var(--muted)">—</span>';
  }
  // Only future reservations get reminder UI
  const today = isoDate(new Date());
  if (r.date < today) return '<span style="color:var(--muted)">—</span>';

  if (r.reminder_sent) return `<span class="badge-reminder-sent">&#10003; Sent</span>`;
  return `<button class="btn-send-reminder" onclick="sendReminder('${r.id}')">Send now</button>`;
}

function renderReservationsTable(rows) {
  const body = document.getElementById('res-body');
  body.closest('table')?.classList.toggle('show-table-col', restaurant?.booking_mode === 'tables');
  const filtered = resFilter === 'all' ? rows : rows.filter(r => r.status === resFilter);

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="11" class="empty-state" style="padding-top:24px;">No reservations found</td></tr>`;
    return;
  }

  body.innerHTML = filtered.map(r => {
    const notes = r.notes
      ? (hasAllergyFlag(r.notes) ? allergyBadge() + esc(r.notes).slice(0,35) : esc(r.notes).slice(0,35))
      : '<span style="color:var(--muted)">—</span>';
    const guestArg = `'${r.customer_id ?? ''}','${(r.customer_phone || '').replace(/'/g, "\\'")}','${esc(r.customer_name ?? '').replace(/'/g, "\\'")}'`;
    const tableName = r.restaurant_tables?.table_name ?? '—';
    return `<tr>
      <td class="td-time">${fmtTime(r.time)}</td>
      <td class="td-guest"><span class="guest-link" onclick="openGuestProfile(${guestArg})">${esc(r.customer_name)}</span>${noShowFlagHTML(r)}</td>
      <td class="td-muted col-phone">${esc(r.customer_phone ?? '—')}</td>
      <td>${r.party_size}</td>
      <td class="td-muted col-table">${esc(tableName)}</td>
      <td class="td-muted col-duration">${r.duration_minutes ?? 90} min</td>
      <td class="td-notes" data-fulltext="${esc(r.notes ?? '')}">${notes}</td>
      <td>${reminderCellHTML(r)}</td>
      <td>${sourceBadge(r.source ?? 'manual')}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="td-actions">
        <button class="btn-inline arrived" onclick="quickStatus('${r.id}','arrived')">Arrived</button>
        <button class="btn-inline noshow" onclick="quickStatus('${r.id}','no_show')">No-show</button>
        <button class="btn-inline edit" onclick="openEditModal('${r.id}')" title="Edit">Edit</button>
        ${r.status !== 'cancelled' ? `<button class="btn-inline danger" onclick="cancelReservation('${r.id}')" title="Cancel">Cancel</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function sendReminder(id) {
  const r = _resRows.find(x => x.id === id);
  if (!r) return;
  await db.from('reservations').update({
    reminder_sent: true,
    reminder_sent_at: new Date().toISOString(),
  }).eq('id', id);

  // Convenience: open WhatsApp with prefilled message
  if (r.customer_phone) {
    const msg = `Hi ${r.customer_name}, this is ${restaurant.name} reminding you of your reservation on ${fmtDate(r.date)} at ${fmtTime(r.time)} for ${r.party_size} ${r.party_size === 1 ? 'person' : 'people'}. See you soon!`;
    window.open(whatsappLink(r.customer_phone, msg), '_blank');
  }

  showToast('Reminder marked as sent');
  loadReservations();
}
window.sendReminder = sendReminder;

async function cancelReservation(id) {
  if (!confirm('Cancel this reservation?')) return;
  await db.from('reservations').update({ status: 'cancelled' }).eq('id', id);
  showToast('Reservation cancelled');
  loadReservations();
  if (document.getElementById('view-overview').classList.contains('active')) loadOverview();
}
window.cancelReservation = cancelReservation;

document.getElementById('btn-add-res').addEventListener('click', () => openAddModal());
document.getElementById('btn-add-res-ov')?.addEventListener('click', () => openAddModal());

/* ─── Reservation modal ─────────────────────────────────────────────────────── */
async function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Reservation';
  document.getElementById('modal-res-id').value = '';
  document.getElementById('f-name').value   = '';
  document.getElementById('f-phone').value  = '';
  document.getElementById('f-date').value   = resDate;
  document.getElementById('f-time').value   = '';
  document.getElementById('f-covers').value = 2;
  document.getElementById('f-duration').value = 90;
  document.getElementById('f-notes').value  = '';
  document.getElementById('f-status-row').style.display = 'none';
  document.getElementById('modal-error').textContent = '';
  await loadTableDropdown(null);
  document.getElementById('modal-overlay').classList.add('open');
}

async function openEditModal(id) {
  const { data: r } = await db.from('reservations').select('*').eq('id', id).single();
  if (!r) return;
  document.getElementById('modal-title').textContent    = 'Edit Reservation';
  document.getElementById('modal-res-id').value         = r.id;
  document.getElementById('f-name').value               = r.customer_name ?? '';
  document.getElementById('f-phone').value              = r.customer_phone ?? '';
  document.getElementById('f-date').value               = r.date ?? '';
  document.getElementById('f-time').value               = r.time ? r.time.slice(0,5) : '';
  document.getElementById('f-covers').value             = r.party_size ?? 2;
  document.getElementById('f-duration').value           = r.duration_minutes ?? 90;
  document.getElementById('f-notes').value              = r.notes ?? '';
  document.getElementById('f-status').value             = r.status ?? 'confirmed';
  document.getElementById('f-status-row').style.display = 'block';
  document.getElementById('modal-error').textContent    = '';
  await loadTableDropdown(r.table_id);
  document.getElementById('modal-overlay').classList.add('open');
}

async function loadTableDropdown(selectedTableId) {
  const row = document.getElementById('f-table-row');
  const sel = document.getElementById('f-table');
  if (restaurant?.booking_mode !== 'tables') {
    row.style.display = 'none';
    return;
  }
  const { data: tables } = await db.from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('table_name');
  row.style.display = 'block';
  sel.innerHTML = `<option value="">— No table assigned —</option>` +
    (tables ?? []).map(t => `<option value="${t.id}" ${t.id === selectedTableId ? 'selected' : ''}>${esc(t.table_name)} (seats ${t.capacity})</option>`).join('');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-overlay')) closeModal(); });

document.getElementById('modal-save').addEventListener('click', saveReservation);

async function saveReservation() {
  const id      = document.getElementById('modal-res-id').value;
  const name    = document.getElementById('f-name').value.trim();
  const phone   = document.getElementById('f-phone').value.trim();
  const date    = document.getElementById('f-date').value;
  const time    = document.getElementById('f-time').value;
  const covers  = parseInt(document.getElementById('f-covers').value, 10);
  const dur     = parseInt(document.getElementById('f-duration').value, 10);
  const notes   = document.getElementById('f-notes').value.trim();
  const tableId = document.getElementById('f-table').value || null;
  const status  = id ? (document.getElementById('f-status').value) : 'confirmed';
  const errEl   = document.getElementById('modal-error');

  if (!name)  { errEl.textContent = 'Guest name is required.'; return; }
  if (!date)  { errEl.textContent = 'Date is required.'; return; }
  if (!time)  { errEl.textContent = 'Time is required.'; return; }
  if (!covers || covers < 1) { errEl.textContent = 'Covers must be at least 1.'; return; }

  // Table conflict check (tables mode only)
  if (restaurant?.booking_mode === 'tables' && tableId) {
    const conflict = await checkTableConflict(tableId, date, time, dur, id);
    if (conflict) { errEl.textContent = `Table conflict: another booking overlaps this time slot.`; return; }
  }

  errEl.textContent = '';
  const payload = {
    restaurant_id:   restaurant.id,
    customer_name:   name,
    customer_phone:  phone || null,
    date,
    time,
    party_size:      covers,
    duration_minutes: dur,
    notes:           notes || null,
    table_id:        tableId,
    source:          id ? undefined : 'manual',
    status,
  };
  if (!id) delete payload.status;

  if (id) {
    delete payload.source;
    await db.from('reservations').update(payload).eq('id', id);
    showToast('Reservation updated');
  } else {
    await db.from('reservations').insert(payload);
    showToast('Reservation added');
  }

  closeModal();
  loadReservations();
  if (document.getElementById('view-overview').classList.contains('active')) loadOverview();
}

async function checkTableConflict(tableId, date, time, durationMins, excludeId) {
  const { data: existing } = await db.from('reservations')
    .select('id, time, duration_minutes')
    .eq('restaurant_id', restaurant.id)
    .eq('date', date)
    .eq('table_id', tableId)
    .neq('status', 'cancelled');

  const newStart = timeToMins(time);
  const newEnd   = newStart + durationMins;

  return (existing ?? []).some(r => {
    if (excludeId && r.id === excludeId) return false;
    const exStart = timeToMins(r.time);
    const exEnd   = exStart + (r.duration_minutes ?? 90);
    return newStart < exEnd && newEnd > exStart;
  });
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/* ─── Service Turns ─────────────────────────────────────────────────────────── */
function turnsKey() { return `turns_${restaurant?.id}`; }

function getTurns() {
  if (!restaurant) return [];
  try { return JSON.parse(localStorage.getItem(turnsKey()) ?? '[]') ?? []; }
  catch { return []; }
}

function saveTurnsLocal(turns) {
  localStorage.setItem(turnsKey(), JSON.stringify(turns));
}

function renderTurnsOverview(reservations) {
  const body = document.getElementById('turns-overview-body');
  if (!body) return;
  const turns = getTurns();

  if (!turns.length) {
    body.innerHTML = `<div class="empty-state">No turns configured — <button class="link-btn" onclick="navigate('settings')">add turns in Settings</button></div>`;
    return;
  }

  body.innerHTML = turns.map(t => {
    const booked = reservations
      .filter(r => {
        const rMins = timeToMins(r.time.slice(0, 5));
        return rMins >= timeToMins(t.start) && rMins < timeToMins(t.end);
      })
      .reduce((s, r) => s + (r.party_size ?? 0), 0);
    const avail = Math.max(0, t.capacity - booked);
    const pct   = t.capacity > 0 ? Math.min(100, Math.round(booked / t.capacity * 100)) : 0;
    const level = pct >= 100 ? 'over' : pct >= 75 ? 'full' : pct >= 50 ? 'busy' : 'quiet';
    const levelLabel = pct >= 100 ? 'Full' : pct >= 75 ? 'Almost full' : pct >= 50 ? 'Filling up' : 'Available';
    return `<div class="turn-row">
      <span class="turn-time">${t.start} – ${t.end}</span>
      <div class="turn-bar-wrap">
        <div class="turn-bar-fill level-${level}" style="width:${pct}%"></div>
      </div>
      <div class="turn-stats">
        <strong>${booked}</strong> / ${t.capacity}
        <span class="turn-avail level-${level}">${avail} left</span>
      </div>
      <span class="turn-badge level-${level}">${levelLabel}</span>
    </div>`;
  }).join('');
}

function renderTurnsSettings() {
  const list = document.getElementById('turns-list');
  if (!list) return;
  const turns = getTurns();

  if (!turns.length) {
    list.innerHTML = `<div class="empty-state">No turns configured yet</div>`;
    return;
  }
  list.innerHTML = turns.map((t, i) => `
    <div class="turns-item">
      <span class="turns-item-time">${t.start} – ${t.end}</span>
      <span class="turns-item-cap">${t.capacity} seats</span>
      <button class="btn-trash" onclick="deleteTurn(${i})" title="Remove"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
    </div>
  `).join('');
}

window.deleteTurn = function(index) {
  const turns = getTurns();
  turns.splice(index, 1);
  saveTurnsLocal(turns);
  renderTurnsSettings();
  showToast('Turn removed');
};

document.getElementById('btn-add-turn')?.addEventListener('click', () => {
  const start = document.getElementById('new-turn-start').value;
  const end   = document.getElementById('new-turn-end').value;
  const cap   = parseInt(document.getElementById('new-turn-cap').value, 10);
  if (!start || !end)   { showToast('Select start and end times'); return; }
  if (!cap || cap < 1)  { showToast('Enter a valid seat count'); return; }
  if (timeToMins(start) >= timeToMins(end)) { showToast('End time must be after start time'); return; }
  const turns = getTurns();
  turns.push({ start, end, capacity: cap });
  turns.sort((a, b) => timeToMins(a.start) - timeToMins(b.start));
  saveTurnsLocal(turns);
  document.getElementById('new-turn-start').value = '';
  document.getElementById('new-turn-end').value   = '';
  document.getElementById('new-turn-cap').value   = '';
  renderTurnsSettings();
  showToast('Turn added');
});

/* ─── Settings view ─────────────────────────────────────────────────────────── */
async function loadSettings() {
  if (!restaurant) return;
  document.getElementById('settings-rest-name').textContent = restaurant.name;

  // Info fields
  document.getElementById('s-name').value      = restaurant.name ?? '';
  document.getElementById('s-address').value   = restaurant.address ?? '';
  document.getElementById('s-phone').value     = restaurant.phone_number ?? '';
  document.getElementById('s-timezone').value  = restaurant.timezone ?? '';
  document.getElementById('s-avg-spend').value = Number(restaurant.avg_spend_per_cover ?? 35);

  // Reminders
  document.getElementById('s-reminders-enabled').checked = !!restaurant.reminders_enabled;
  document.getElementById('s-reminder-hours').value      = restaurant.reminder_hours_before ?? 24;

  // Booking mode
  const mode = restaurant.booking_mode ?? 'seats';
  document.getElementById('mode-seats').classList.toggle('active', mode === 'seats');
  document.getElementById('mode-tables').classList.toggle('active', mode === 'tables');
  document.getElementById('tables-card').style.display = mode === 'tables' ? 'block' : 'none';

  // Opening hours
  const { data: oh } = await db.from('opening_hours').select('*').eq('restaurant_id', restaurant.id).order('day_of_week');
  ohData = oh ?? [];
  renderOpeningHours();

  // Capacity grid
  renderCapacityGrid();

  // Closures
  await loadClosures();

  // Tables (if tables mode)
  if (mode === 'tables') await loadTables();

  // Service turns
  renderTurnsSettings();
}

// Mode toggle
document.getElementById('mode-seats').addEventListener('click', () => setBookingMode('seats'));
document.getElementById('mode-tables').addEventListener('click', () => setBookingMode('tables'));
function setBookingMode(mode) {
  restaurant.booking_mode = mode;
  document.getElementById('mode-seats').classList.toggle('active', mode === 'seats');
  document.getElementById('mode-tables').classList.toggle('active', mode === 'tables');
  document.getElementById('tables-card').style.display = mode === 'tables' ? 'block' : 'none';
}

// Save info
document.getElementById('btn-save-info').addEventListener('click', async () => {
  const payload = {
    name:                document.getElementById('s-name').value.trim(),
    address:             document.getElementById('s-address').value.trim() || null,
    phone_number:        document.getElementById('s-phone').value.trim() || null,
    timezone:            document.getElementById('s-timezone').value.trim() || null,
    booking_mode:        restaurant.booking_mode,
    avg_spend_per_cover: Number(document.getElementById('s-avg-spend').value) || 35,
  };
  if (!payload.name) { showToast('Name cannot be empty'); return; }
  await db.from('restaurants').update(payload).eq('id', restaurant.id);
  restaurant = { ...restaurant, ...payload };
  showToast('Restaurant info saved');
  document.getElementById('settings-rest-name').textContent = restaurant.name;
  // Update sidebar display
  if (session.role === 'client') document.getElementById('restaurant-name-display').textContent = restaurant.name;
});

// Save reminders
document.getElementById('btn-save-reminders').addEventListener('click', async () => {
  const payload = {
    reminders_enabled:     document.getElementById('s-reminders-enabled').checked,
    reminder_hours_before: parseInt(document.getElementById('s-reminder-hours').value, 10) || 24,
  };
  await db.from('restaurants').update(payload).eq('id', restaurant.id);
  restaurant = { ...restaurant, ...payload };
  showToast('Reminder settings saved');
});

// Opening hours
function renderOpeningHours() {
  const grid = document.getElementById('oh-grid');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  grid.innerHTML = days.map((day, i) => {
    const oh = ohData.find(h => h.day_of_week === i) ?? { day_of_week: i, open_time: '12:00', close_time: '22:00', max_covers: 80, is_active: false };
    return `<div class="oh-row" data-dow="${i}">
      <span class="oh-day">${day}</span>
      <label class="toggle-wrap" title="${oh.is_active ? 'Active':'Inactive'}">
        <span class="toggle">
          <input type="checkbox" class="oh-active" ${oh.is_active ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </span>
      </label>
      <input type="time" class="oh-open"  value="${oh.open_time?.slice(0,5) ?? '12:00'}">
      <span class="oh-sep">–</span>
      <input type="time" class="oh-close" value="${oh.close_time?.slice(0,5) ?? '22:00'}">
      <input type="number" class="oh-covers" value="${oh.max_covers ?? 0}" min="0" placeholder="Covers">
    </div>`;
  }).join('');
}

document.getElementById('btn-save-oh').addEventListener('click', async () => {
  const rows = document.querySelectorAll('#oh-grid .oh-row');
  const upserts = Array.from(rows).map(row => {
    const dow = parseInt(row.dataset.dow, 10);
    return {
      restaurant_id: restaurant.id,
      day_of_week:   dow,
      is_active:     row.querySelector('.oh-active').checked,
      open_time:     row.querySelector('.oh-open').value || '12:00',
      close_time:    row.querySelector('.oh-close').value || '22:00',
      max_covers:    parseInt(row.querySelector('.oh-covers').value, 10) || 0,
    };
  });
  await db.from('opening_hours').upsert(upserts, { onConflict: 'restaurant_id,day_of_week' });
  const { data: oh } = await db.from('opening_hours').select('*').eq('restaurant_id', restaurant.id).order('day_of_week');
  ohData = oh ?? [];
  renderCapacityGrid();
  showToast('Opening hours saved');
});

// Capacity grid (settings)
function renderCapacityGrid() {
  const grid = document.getElementById('day-cap-grid');
  grid.innerHTML = DAY_NAMES.map((day, i) => {
    const oh = ohData.find(h => h.day_of_week === i);
    const active = oh?.is_active ?? false;
    const cap = oh?.max_covers ?? 0;
    return `<button class="day-cap-btn${!active ? ' inactive' : ''}${selectedDayCap === i ? ' selected' : ''}" data-dow="${i}">
      <span class="dc-day">${day}</span>
      <span class="dc-val">${active ? cap : '—'}</span>
    </button>`;
  }).join('');

  grid.querySelectorAll('.day-cap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dow = parseInt(btn.dataset.dow, 10);
      selectedDayCap = dow;
      const oh = ohData.find(h => h.day_of_week === dow);
      const cap = oh?.max_covers ?? 0;
      const slider = document.getElementById('settings-cap-slider');
      slider.value = cap;
      document.getElementById('settings-cap-val').textContent = cap;
      document.getElementById('cap-editor-label').textContent = DAY_NAMES[dow];
      document.getElementById('cap-editor').style.display = 'flex';
      renderCapacityGrid();
    });
  });
}

document.getElementById('settings-cap-slider').addEventListener('input', e => {
  document.getElementById('settings-cap-val').textContent = e.target.value;
});

document.getElementById('btn-save-day-cap').addEventListener('click', async () => {
  if (selectedDayCap === null) return;
  const cap = parseInt(document.getElementById('settings-cap-slider').value, 10);
  const oh = ohData.find(h => h.day_of_week === selectedDayCap);
  if (oh) {
    await db.from('opening_hours').update({ max_covers: cap }).eq('id', oh.id);
  } else {
    await db.from('opening_hours').upsert({
      restaurant_id: restaurant.id,
      day_of_week:   selectedDayCap,
      open_time:     '12:00',
      close_time:    '22:00',
      max_covers:    cap,
      is_active:     false,
    }, { onConflict: 'restaurant_id,day_of_week' });
  }
  const { data: updated } = await db.from('opening_hours').select('*').eq('restaurant_id', restaurant.id).order('day_of_week');
  ohData = updated ?? [];
  renderCapacityGrid();
  showToast(`Capacity for ${DAY_NAMES[selectedDayCap]} saved`);
});

// Closures
async function loadClosures() {
  const { data } = await db.from('closures').select('*').eq('restaurant_id', restaurant.id).order('date');
  const list = document.getElementById('closure-list');
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">No closed dates set</div>`;
    return;
  }
  list.innerHTML = data.map(c => `
    <div class="closure-item">
      <div>
        <span class="closure-date">${c.date}</span>
        ${c.reason ? `<span class="closure-reason"> — ${esc(c.reason)}</span>` : ''}
      </div>
      <button class="btn-inline danger" onclick="deleteClosure('${c.id}')">Remove</button>
    </div>
  `).join('');
}

document.getElementById('btn-add-closure').addEventListener('click', async () => {
  const date   = document.getElementById('closure-date-input').value;
  const reason = document.getElementById('closure-reason-input').value.trim();
  if (!date) { showToast('Select a date first'); return; }
  await db.from('closures').upsert({ restaurant_id: restaurant.id, date, reason: reason || null }, { onConflict: 'restaurant_id,date' });
  document.getElementById('closure-date-input').value   = '';
  document.getElementById('closure-reason-input').value = '';
  await loadClosures();
  showToast('Closed date added');
});

async function deleteClosure(id) {
  await db.from('closures').delete().eq('id', id);
  await loadClosures();
  showToast('Closed date removed');
}
window.deleteClosure = deleteClosure;

// Tables
async function loadTables() {
  const { data } = await db.from('restaurant_tables').select('*').eq('restaurant_id', restaurant.id).order('table_name');
  const list = document.getElementById('tables-list');
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">No tables set up</div>`;
    return;
  }
  list.innerHTML = data.map(t => `
    <div class="table-item">
      <span class="table-name">${esc(t.table_name)}</span>
      <span class="table-cap">Seats ${t.capacity}</span>
      <label class="toggle-wrap">
        <span class="toggle">
          <input type="checkbox" ${t.is_active ? 'checked' : ''} onchange="toggleTable('${t.id}', this.checked)">
          <span class="toggle-track"></span>
        </span>
      </label>
      <button class="btn-trash" onclick="deleteTable('${t.id}')" title="Delete" aria-label="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
    </div>
  `).join('');
}

document.getElementById('btn-add-table').addEventListener('click', async () => {
  const name = document.getElementById('new-table-name').value.trim();
  const cap  = parseInt(document.getElementById('new-table-cap').value, 10);
  if (!name) { showToast('Enter a table name'); return; }
  if (!cap || cap < 1) { showToast('Enter a valid capacity'); return; }
  await db.from('restaurant_tables').insert({ restaurant_id: restaurant.id, table_name: name, capacity: cap, is_active: true });
  document.getElementById('new-table-name').value = '';
  document.getElementById('new-table-cap').value  = '';
  await loadTables();
  showToast('Table added');
});

async function toggleTable(id, active) {
  await db.from('restaurant_tables').update({ is_active: active }).eq('id', id);
}
async function deleteTable(id) {
  if (!confirm('Delete this table?')) return;
  await db.from('restaurant_tables').delete().eq('id', id);
  await loadTables();
  showToast('Table deleted');
}
window.toggleTable = toggleTable;
window.deleteTable = deleteTable;

/* ═══════════════════════════════════════════════════════════════════════════
   ESCALATION DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
let _activeEscalationId = null;

async function openEscalationModal(id) {
  const { data: e } = await db.from('escalations').select('*').eq('id', id).single();
  if (!e) return;
  _activeEscalationId = id;
  document.getElementById('esc-modal-name').textContent = e.customer_name ?? 'Unknown caller';
  document.getElementById('esc-modal-meta').textContent = `Received at ${e.received_at ?? '—'} on ${e.date}`;
  document.getElementById('esc-modal-type').textContent = e.type ?? 'Special Request';
  document.getElementById('esc-modal-phone').textContent = e.customer_phone ?? '—';

  const phone = e.customer_phone;
  const actionRow = document.getElementById('esc-action-row');
  if (phone) {
    actionRow.style.display = 'flex';
    document.getElementById('esc-action-call').href = telLink(phone);
    document.getElementById('esc-action-whatsapp').href = whatsappLink(phone,
      `Hi ${e.customer_name ?? ''}, this is ${restaurant.name} following up on your call.`);
  } else {
    actionRow.style.display = 'none';
  }

  const noteEl = document.getElementById('esc-modal-note');
  if (e.note) { noteEl.textContent = e.note; noteEl.classList.remove('empty'); }
  else        { noteEl.textContent = 'No additional notes provided.'; noteEl.classList.add('empty'); }

  openOverlay('esc-modal-overlay');
}
window.openEscalationModal = openEscalationModal;

document.getElementById('esc-modal-close').addEventListener('click', () => closeOverlay('esc-modal-overlay'));
document.getElementById('esc-modal-cancel').addEventListener('click', () => closeOverlay('esc-modal-overlay'));
document.getElementById('esc-modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'esc-modal-overlay') closeOverlay('esc-modal-overlay');
});
document.getElementById('esc-modal-resolve').addEventListener('click', async () => {
  if (!_activeEscalationId) return;
  await db.from('escalations').update({ resolved: true }).eq('id', _activeEscalationId);
  closeOverlay('esc-modal-overlay');
  showToast('Escalation resolved');
  loadOverview();
});

/* ═══════════════════════════════════════════════════════════════════════════
   GUEST PROFILE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
let _activeCustomerId = null;

async function openGuestProfile(customerId, fallbackPhone, fallbackName) {
  let customer = null;

  if (customerId) {
    const { data } = await db.from('customers').select('*').eq('id', customerId).single();
    customer = data;
  }
  if (!customer && fallbackPhone) {
    const { data } = await db.from('customers')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('phone', fallbackPhone)
      .maybeSingle();
    customer = data;
  }
  if (!customer) {
    customer = { id: null, name: fallbackName || 'Unknown guest', phone: fallbackPhone, staff_notes: '' };
  }
  _activeCustomerId = customer.id;

  // Load history (by customer_id, falling back to phone)
  let history = [];
  if (customer.id) {
    const { data } = await db.from('reservations')
      .select('*')
      .eq('customer_id', customer.id)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(50);
    history = data ?? [];
  } else if (fallbackPhone) {
    const { data } = await db.from('reservations')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('customer_phone', fallbackPhone)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(50);
    history = data ?? [];
  }

  // Populate
  document.getElementById('guest-modal-name').textContent = customer.name ?? 'Guest';
  document.getElementById('guest-modal-phone').textContent = customer.phone ?? '';

  const phone = customer.phone;
  const actionRow = document.getElementById('guest-action-row');
  if (phone) {
    actionRow.style.display = 'flex';
    document.getElementById('guest-action-call').href = telLink(phone);
    document.getElementById('guest-action-whatsapp').href = whatsappLink(phone, `Hi ${customer.name ?? ''}!`);
  } else {
    actionRow.style.display = 'none';
  }

  const totalVisits = history.filter(r => r.status !== 'cancelled').length;
  const noShows    = history.filter(r => r.status === 'no_show').length;
  const lastVisit  = history.find(r => r.status === 'arrived');
  document.getElementById('gs-visits').textContent  = totalVisits;
  document.getElementById('gs-noshows').textContent = noShows;
  document.getElementById('gs-last').textContent    = lastVisit ? fmtDate(lastVisit.date) : '—';

  // Recurring allergies from past notes
  const allergyHits = new Set();
  history.forEach(r => {
    if (!r.notes) return;
    const lower = r.notes.toLowerCase();
    ALLERGY_KEYWORDS.forEach(k => { if (lower.includes(k)) allergyHits.add(k); });
  });
  const chipsEl = document.getElementById('guest-allergies');
  if (allergyHits.size === 0) {
    chipsEl.innerHTML = `<span style="color:var(--muted);font-size:12.5px;font-style:italic;">None detected</span>`;
  } else {
    chipsEl.innerHTML = [...allergyHits].map(k => `<span class="chip">${k}</span>`).join('');
  }

  document.getElementById('guest-staff-notes').value = customer.staff_notes ?? '';

  const histBody = document.getElementById('guest-history-body');
  if (history.length === 0) {
    histBody.innerHTML = `<tr><td colspan="5" class="empty-state">No history</td></tr>`;
  } else {
    histBody.innerHTML = history.map(r => `
      <tr>
        <td style="white-space:nowrap;">${fmtDateShort(r.date)}</td>
        <td>${fmtTime(r.time)}</td>
        <td>${r.party_size}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="td-muted">${r.notes ? esc(r.notes).slice(0,40) : '—'}</td>
      </tr>`).join('');
  }

  openOverlay('guest-modal-overlay');
}
window.openGuestProfile = openGuestProfile;

document.getElementById('guest-modal-close').addEventListener('click', () => closeOverlay('guest-modal-overlay'));
document.getElementById('guest-modal-cancel').addEventListener('click', () => closeOverlay('guest-modal-overlay'));
document.getElementById('guest-modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'guest-modal-overlay') closeOverlay('guest-modal-overlay');
});
document.getElementById('guest-modal-save').addEventListener('click', async () => {
  if (!_activeCustomerId) { showToast('No customer record to save notes against'); return; }
  await db.from('customers').update({
    staff_notes: document.getElementById('guest-staff-notes').value.trim() || null,
  }).eq('id', _activeCustomerId);
  showToast('Staff notes saved');
});

/* ═══════════════════════════════════════════════════════════════════════════
   CALLS VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
let callsDate = null;       // initialised on first navigation
let callsFilter = 'all';
let _callRows = [];

function syncCallsNav() {
  const today = isoDate(new Date());
  document.getElementById('calls-date-label').textContent =
    fmtDate(callsDate) + (callsDate === today ? ' — Today' : '');
  document.getElementById('calls-date-input').value = callsDate;
}

function changeCallsDate(n) {
  callsDate = n === 0 ? isoDate(new Date()) : addDays(callsDate, n);
  syncCallsNav();
  loadCalls();
}

document.getElementById('calls-prev').addEventListener('click', () => changeCallsDate(-1));
document.getElementById('calls-next').addEventListener('click', () => changeCallsDate(+1));
document.getElementById('calls-today-btn').addEventListener('click', () => changeCallsDate(0));
document.getElementById('calls-date-input').addEventListener('change', e => {
  if (e.target.value) { callsDate = e.target.value; syncCallsNav(); loadCalls(); }
});
document.getElementById('calls-filter-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  callsFilter = tab.dataset.filter;
  document.querySelectorAll('#calls-filter-tabs .filter-tab').forEach(t => t.classList.toggle('active', t === tab));
  renderCallsTable(_callRows);
});

async function loadCalls() {
  if (!restaurant) return;
  if (!callsDate) callsDate = isoDate(new Date());
  syncCallsNav();

  document.getElementById('calls-body').innerHTML =
    `<tr><td colspan="5" class="empty-state" style="padding-top:24px;">Loading…</td></tr>`;

  const { data, error } = await db.from('call_logs')
    .select('*, reservations(customer_name, time, date)')
    .eq('restaurant_id', restaurant.id)
    .eq('call_date', callsDate)
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('calls-body').innerHTML =
      `<tr><td colspan="5" class="empty-state" style="padding-top:24px;color:var(--red);">Failed: ${error.message}</td></tr>`;
    return;
  }
  _callRows = data ?? [];
  renderCallsTable(_callRows);
}

function renderCallsTable(rows) {
  const body = document.getElementById('calls-body');
  const filtered = callsFilter === 'all' ? rows : rows.filter(r => r.outcome === callsFilter);

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state" style="padding-top:24px;">No calls on this date</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(c => {
    const time = c.created_at ? new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
    const linked = c.reservations
      ? `${esc(c.reservations.customer_name)} &middot; ${fmtTime(c.reservations.time)}`
      : '<span style="color:var(--muted)">—</span>';
    return `<tr>
      <td class="td-time">${time}</td>
      <td class="td-muted">${fmtDuration(c.duration_seconds)}</td>
      <td><span class="badge-${c.outcome}">${c.outcome.replace('_',' ')}</span></td>
      <td>${linked}</td>
      <td class="td-actions">
        <button class="btn-inline" onclick="openCallModal('${c.id}')">View transcript</button>
      </td>
    </tr>`;
  }).join('');
}

async function openCallModal(id) {
  const c = _callRows.find(x => x.id === id);
  if (!c) return;
  const time = c.created_at ? new Date(c.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  document.getElementById('call-modal-meta').textContent = `${time} · ${fmtDuration(c.duration_seconds)}`;
  document.getElementById('call-modal-outcome').innerHTML = `<span class="badge-${c.outcome}">${c.outcome.replace('_',' ')}</span>`;
  document.getElementById('call-modal-transcript').textContent = c.transcript ?? '(no transcript captured)';
  const linkedEl = document.getElementById('call-modal-linked');
  if (c.reservations) {
    linkedEl.innerHTML = `<div class="linked-res-banner">&rarr; Created reservation for <strong>${esc(c.reservations.customer_name)}</strong> on ${c.reservations.date} at ${fmtTime(c.reservations.time)}</div>`;
  } else {
    linkedEl.innerHTML = '';
  }
  openOverlay('call-modal-overlay');
}
window.openCallModal = openCallModal;

document.getElementById('call-modal-close').addEventListener('click', () => closeOverlay('call-modal-overlay'));
document.getElementById('call-modal-cancel').addEventListener('click', () => closeOverlay('call-modal-overlay'));
document.getElementById('call-modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'call-modal-overlay') closeOverlay('call-modal-overlay');
});

/* ─── Session restore ────────────────────────────────────────────────────────── */
(function init() {
  const saved = sessionStorage.getItem('sala_session');
  if (saved) {
    try {
      session = JSON.parse(saved);
      bootApp();
    } catch(e) {
      sessionStorage.removeItem('sala_session');
    }
  }
})();
