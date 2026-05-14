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
let resDate      = isoDate(new Date());
let resFilter    = 'all';
let todayCapacity = 0;     // session-only slider value
let selectedDayCap = null; // settings capacity editor — which day index is selected
let ohData       = [];     // opening_hours rows for current restaurant

/* ─── Utility ──────────────────────────────────────────────────────────────── */
function isoDate(d) {
  return d.toISOString().split('T')[0];
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
function navigate(view) {
  ['overview','reservations','settings'].forEach(v => {
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
  if (active === 'settings')     loadSettings();
}

document.querySelectorAll('.nav-item[data-view]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.view));
});

window.addEventListener('hashchange', () => {
  const v = location.hash.replace('#','');
  if (['overview','reservations','settings'].includes(v)) navigate(v);
});

/* ─── Overview ─────────────────────────────────────────────────────────────── */
async function loadOverview() {
  if (!restaurant) return;
  const today = isoDate(new Date());

  document.getElementById('ov-date-label').textContent = fmtDate(today);

  const [resResult, escResult, ohResult] = await Promise.all([
    db.from('reservations')
      .select('*')
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
  const noShows     = allRes.filter(r => r.status === 'no_show').length;

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

  // Today's reservations
  const sorted = [...activeRes].sort((a,b) => a.time.localeCompare(b.time));
  const resBody = document.getElementById('ov-res-body');
  document.getElementById('ov-res-count').textContent = sorted.length;

  if (sorted.length === 0) {
    resBody.innerHTML = `<tr><td colspan="7" class="empty-state">No reservations today</td></tr>`;
  } else {
    resBody.innerHTML = sorted.map(r => {
      const notes = r.notes ? (hasAllergyFlag(r.notes) ? allergyBadge() + esc(r.notes).slice(0,40) : esc(r.notes).slice(0,40)) : '<span style="color:var(--muted)">—</span>';
      return `<tr>
        <td class="td-time">${fmtTime(r.time)}</td>
        <td class="td-guest">${esc(r.customer_name)}</td>
        <td>${r.party_size}</td>
        <td class="td-muted">${r.duration_minutes ?? 90} min</td>
        <td class="td-notes">${notes}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="td-actions">
          <button class="btn-inline arrived" onclick="quickStatus('${r.id}','arrived')">Arrived</button>
          <button class="btn-inline noshow" onclick="quickStatus('${r.id}','no_show')">No-show</button>
          <button class="btn-inline" onclick="openEditModal('${r.id}')">Edit</button>
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
      <div class="escalation-item">
        <div class="escalation-info">
          <div class="escalation-name">${esc(e.customer_name ?? 'Unknown')}</div>
          <div class="escalation-meta">${esc(e.type ?? '')} &middot; ${esc(e.received_at ?? '')}</div>
          ${e.note ? `<div class="escalation-note">${esc(e.note)}</div>` : ''}
        </div>
        <button class="btn-inline resolve" onclick="resolveEscalation('${e.id}')">Resolve</button>
      </div>
    `).join('');
  }
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
document.getElementById('res-prev').addEventListener('click', () => { resDate = addDays(resDate, -1); syncDateNav(); loadReservations(); });
document.getElementById('res-next').addEventListener('click', () => { resDate = addDays(resDate, +1); syncDateNav(); loadReservations(); });
document.getElementById('res-today-btn').addEventListener('click', () => { resDate = isoDate(new Date()); syncDateNav(); loadReservations(); });
document.getElementById('res-date-input').addEventListener('change', e => { resDate = e.target.value; syncDateNav(); loadReservations(); });

function syncDateNav() {
  document.getElementById('res-date-label').textContent = fmtDate(resDate);
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

  const { data } = await db.from('reservations')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('date', resDate)
    .order('time');

  _resRows = data ?? [];
  window._resRows = _resRows;
  renderReservationsTable(_resRows);
}

function renderReservationsTable(rows) {
  const body = document.getElementById('res-body');
  const filtered = resFilter === 'all' ? rows : rows.filter(r => r.status === resFilter);

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="9" class="empty-state" style="padding-top:24px;">No reservations found</td></tr>`;
    return;
  }

  body.innerHTML = filtered.map(r => {
    const notes = r.notes
      ? (hasAllergyFlag(r.notes) ? allergyBadge() + esc(r.notes).slice(0,35) : esc(r.notes).slice(0,35))
      : '<span style="color:var(--muted)">—</span>';
    return `<tr>
      <td class="td-time">${fmtTime(r.time)}</td>
      <td class="td-guest">${esc(r.customer_name)}</td>
      <td class="td-muted">${esc(r.customer_phone ?? '—')}</td>
      <td>${r.party_size}</td>
      <td class="td-muted">${r.duration_minutes ?? 90} min</td>
      <td class="td-notes">${notes}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${sourceBadge(r.source ?? 'manual')}</td>
      <td class="td-actions">
        <button class="btn-inline" onclick="openEditModal('${r.id}')">Edit</button>
        ${r.status !== 'cancelled' ? `<button class="btn-inline danger" onclick="cancelReservation('${r.id}')">Cancel</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function cancelReservation(id) {
  if (!confirm('Cancel this reservation?')) return;
  await db.from('reservations').update({ status: 'cancelled' }).eq('id', id);
  showToast('Reservation cancelled');
  loadReservations();
  if (document.getElementById('view-overview').classList.contains('active')) loadOverview();
}
window.cancelReservation = cancelReservation;

document.getElementById('btn-add-res').addEventListener('click', () => openAddModal());

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

/* ─── Settings view ─────────────────────────────────────────────────────────── */
async function loadSettings() {
  if (!restaurant) return;
  document.getElementById('settings-rest-name').textContent = restaurant.name;

  // Info fields
  document.getElementById('s-name').value     = restaurant.name ?? '';
  document.getElementById('s-address').value  = restaurant.address ?? '';
  document.getElementById('s-phone').value    = restaurant.phone_number ?? '';
  document.getElementById('s-timezone').value = restaurant.timezone ?? '';

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
    name:         document.getElementById('s-name').value.trim(),
    address:      document.getElementById('s-address').value.trim() || null,
    phone_number: document.getElementById('s-phone').value.trim() || null,
    timezone:     document.getElementById('s-timezone').value.trim() || null,
    booking_mode: restaurant.booking_mode,
  };
  if (!payload.name) { showToast('Name cannot be empty'); return; }
  await db.from('restaurants').update(payload).eq('id', restaurant.id);
  restaurant = { ...restaurant, ...payload };
  showToast('Restaurant info saved');
  document.getElementById('settings-rest-name').textContent = restaurant.name;
  // Update sidebar display
  if (session.role === 'client') document.getElementById('restaurant-name-display').textContent = restaurant.name;
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
      <button class="btn-inline danger" onclick="deleteTable('${t.id}')">Delete</button>
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
