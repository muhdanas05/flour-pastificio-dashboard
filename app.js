/* ============================================================
   Sala Smart — Dashboard App
   Supabase credentials injected by build.js at deploy time.
============================================================ */

const SUPABASE_URL = '%%SUPABASE_URL%%';
const SUPABASE_KEY = '%%SUPABASE_KEY%%';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ══════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════ */
const USERS = {
  'admin':    { password: 'admin2024',    role: 'admin',  restaurantSlug: null },
  'flour':    { password: 'flour2024',    role: 'client', restaurantSlug: 'flour' },
  'brasserie':{ password: 'brasserie2024',role: 'client', restaurantSlug: 'brasserie' },
  'harbour':  { password: 'harbour2024',  role: 'client', restaurantSlug: 'harbour' },
};

let session = null;

function doLogin() {
  const username = document.getElementById('l-user').value.trim().toLowerCase();
  const password = document.getElementById('l-pass').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  const user = USERS[username];
  if (!user || user.password !== password) {
    errEl.textContent = 'Incorrect username or password.';
    return;
  }

  session = { username, role: user.role, restaurantSlug: user.restaurantSlug };
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display    = 'flex';

  document.getElementById('session-user').textContent = username;
  const rb = document.getElementById('session-role-badge');
  rb.textContent = session.role;
  rb.className   = `session-role ${session.role}`;

  init();
}

function doLogout() {
  session = null;
  currentRestaurantId = null;
  currentRestaurant   = null;
  if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }
  document.getElementById('dashboard').style.display    = 'none';
  document.getElementById('login-screen').style.display = '';
  document.getElementById('l-pass').value   = '';
  document.getElementById('login-error').textContent = '';
}

document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('l-user').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

/* ══════════════════════════════════════════════════════════
   DATE HELPERS
══════════════════════════════════════════════════════════ */
const TODAY_DATE = new Date();
TODAY_DATE.setHours(0, 0, 0, 0);

const addDays  = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const isoDate  = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const TODAY    = isoDate(TODAY_DATE);
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const fmtDate = d =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB',
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = t => t ? t.slice(0, 5) : '—';

/* ══════════════════════════════════════════════════════════
   ALLERGY DETECTION
══════════════════════════════════════════════════════════ */
const ALLERGY_KEYWORDS = ['allergy','allergic','intolerant','intolerance','coeliac','celiac',
  'vegan','gluten','nut','shellfish','dairy','lactose','peanut','seafood'];

function hasAllergyFlag(notes) {
  if (!notes) return false;
  const n = notes.toLowerCase();
  return ALLERGY_KEYWORDS.some(k => n.includes(k));
}

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
let currentRestaurantId = null;
let currentRestaurant   = null;
let weeklyChart         = null;
let resDate             = new Date(TODAY_DATE);
let activeFilter        = 'all';
let editingReservation  = null; // null = add mode, object = edit mode

/* ══════════════════════════════════════════════════════════
   HASH ROUTER
══════════════════════════════════════════════════════════ */
const VIEWS = ['overview', 'reservations', 'settings'];

function navigate(view) {
  if (!VIEWS.includes(view)) view = 'overview';
  history.pushState(null, '', '#' + view);
  renderView(view);
}

function renderView(view) {
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = (v === view) ? '' : 'none';
  });
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
  });

  if (!currentRestaurantId) return;

  if (view === 'overview')      loadOverview();
  if (view === 'reservations')  { updateResDateNav(); loadReservations(); }
  if (view === 'settings')      loadSettings();
}

window.addEventListener('popstate', () => {
  const view = (location.hash || '#overview').slice(1);
  renderView(view);
});

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => navigate(tab.dataset.view));
});

/* ══════════════════════════════════════════════════════════
   INIT — called after login
══════════════════════════════════════════════════════════ */
async function init() {
  const statusMsg = document.getElementById('status-msg');
  const errorMsg  = document.getElementById('error-msg');
  const sel       = document.getElementById('client-select');
  const labelEl   = document.getElementById('client-bar-label');

  statusMsg.style.display = '';
  errorMsg.style.display  = 'none';
  statusMsg.textContent   = 'Loading…';

  if (session.role === 'admin') {
    const { data, error } = await db.from('restaurants').select('*').order('name');
    if (error || !data?.length) {
      statusMsg.style.display = 'none';
      errorMsg.style.display  = '';
      errorMsg.textContent = error ? `DB error: ${error.message}` : 'No restaurants found.';
      return;
    }

    sel.innerHTML = '';
    for (const r of data) {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      opt.dataset.slug    = r.slug || '';
      opt.dataset.address = r.address || '';
      opt.dataset.agent   = r.agent_name || 'AI';
      opt.dataset.mode    = r.booking_mode || 'seats';
      sel.appendChild(opt);
    }
    statusMsg.style.display = 'none';
    sel.style.display       = '';
    labelEl.textContent     = 'Client';
    sel.onchange = () => switchRestaurant(sel.value);
    await switchRestaurant(data[0].id);

  } else {
    const { data, error } = await db.from('restaurants').select('*')
      .eq('slug', session.restaurantSlug).maybeSingle();
    if (error || !data) {
      statusMsg.style.display = 'none';
      errorMsg.style.display  = '';
      errorMsg.textContent    = `Restaurant not found.`;
      return;
    }

    const opt = document.createElement('option');
    opt.value = data.id;
    opt.textContent = data.name;
    opt.dataset.slug    = data.slug || '';
    opt.dataset.address = data.address || '';
    opt.dataset.agent   = data.agent_name || 'AI';
    opt.dataset.mode    = data.booking_mode || 'seats';
    sel.appendChild(opt);

    statusMsg.style.display = 'none';
    sel.style.display       = 'none';
    labelEl.textContent     = data.name;

    await switchRestaurant(data.id);
  }
}

async function switchRestaurant(id) {
  currentRestaurantId = id;
  const sel = document.getElementById('client-select');
  const opt = Array.from(sel.options).find(o => o.value === id);
  if (opt) sel.value = id;

  // Load full restaurant record
  const { data } = await db.from('restaurants').select('*').eq('id', id).maybeSingle();
  currentRestaurant = data;

  // Populate header
  document.getElementById('client-name').textContent    = currentRestaurant?.name    || '—';
  document.getElementById('client-address').textContent = currentRestaurant?.address || '';
  document.getElementById('hdr-date').textContent =
    TODAY_DATE.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('agent-badge-text').textContent =
    `${currentRestaurant?.agent_name || 'AI'}, AI Receptionist`;

  // Go to overview
  resDate = new Date(TODAY_DATE);
  const view = (location.hash || '#overview').slice(1);
  renderView(VIEWS.includes(view) ? view : 'overview');
}

/* ══════════════════════════════════════════════════════════
   VIEW 1 — OVERVIEW
══════════════════════════════════════════════════════════ */
async function loadOverview() {
  if (!currentRestaurantId) return;
  const sevenAgo = isoDate(addDays(TODAY_DATE, -6));

  const [resRes, escRes, weeklyRes, hoursRes] = await Promise.all([
    db.from('reservations').select('*')
      .eq('restaurant_id', currentRestaurantId)
      .gte('date', isoDate(addDays(TODAY_DATE, -6)))
      .lte('date', TODAY)
      .order('date').order('time'),
    db.from('escalations').select('*')
      .eq('restaurant_id', currentRestaurantId)
      .eq('resolved', false)
      .order('date', { ascending: false }),
    db.from('reservations').select('date,party_size,status')
      .eq('restaurant_id', currentRestaurantId)
      .gte('date', sevenAgo).lte('date', TODAY),
    db.from('opening_hours').select('*')
      .eq('restaurant_id', currentRestaurantId),
  ]);

  const allRes   = resRes.data  || [];
  const escs     = escRes.data  || [];
  const weekly   = weeklyRes.data || [];
  const hours    = hoursRes.data  || [];

  const todayRes = allRes.filter(r => r.date === TODAY && r.status !== 'cancelled');
  const todayCovers = todayRes.reduce((s, r) => s + (r.party_size || 0), 0);

  const noShowsWeek = weekly.filter(r => r.status === 'no_show').length;

  // Stats
  document.getElementById('stat-reservations').textContent = todayRes.length;
  document.getElementById('stat-covers').textContent       = todayCovers;
  document.getElementById('stat-escalations').textContent  = escs.length;
  document.getElementById('stat-noshows').textContent      = noShowsWeek;

  // Availability bar
  const todayDow  = TODAY_DATE.getDay();
  const todayHour = hours.find(h => h.day_of_week === todayDow && h.is_active);
  renderAvailability(todayHour, todayCovers);

  // Allergy flags from today's reservations
  const allergyRes = todayRes.filter(r => hasAllergyFlag(r.notes));
  renderAllergyFlags(allergyRes);

  // Escalations panel
  renderEscalations(escs);

  // Today's reservations table
  renderTodayTable(todayRes);

  // Weekly chart — group by date
  const chartData = buildWeeklyChartData(weekly, sevenAgo);
  renderChart(chartData);
}

function renderAvailability(hourRow, bookedCovers) {
  const availEl  = document.getElementById('avail-available');
  const bookedEl = document.getElementById('avail-booked');
  const totalEl  = document.getElementById('avail-total');
  const barEl    = document.getElementById('avail-bar');
  const statusEl = document.getElementById('avail-status');

  bookedEl.textContent = bookedCovers;

  if (!hourRow || !hourRow.max_covers) {
    totalEl.textContent    = '—';
    availEl.textContent    = '—';
    barEl.style.width      = '0%';
    barEl.style.background = 'var(--border-md)';
    statusEl.className     = 'avail-status warn';
    statusEl.textContent   = 'Opening hours not configured — go to Settings to set today\'s capacity.';
    return;
  }

  const total     = hourRow.max_covers;
  const available = Math.max(0, total - bookedCovers);
  const pct       = Math.min(100, Math.round((bookedCovers / total) * 100));

  totalEl.textContent  = total;
  availEl.textContent  = available;
  barEl.style.width    = pct + '%';

  if (pct >= 100) {
    barEl.style.background = 'var(--red)';
    statusEl.className     = 'avail-status full';
    statusEl.textContent   = 'Fully booked — AI is blocking new reservations for today.';
  } else if (pct >= 80) {
    barEl.style.background = 'var(--amber)';
    statusEl.className     = 'avail-status warn';
    statusEl.textContent   = `Almost full — ${available} cover${available !== 1 ? 's' : ''} remaining.`;
  } else {
    barEl.style.background = 'var(--green)';
    statusEl.className     = 'avail-status ok';
    statusEl.textContent   = `${available} cover${available !== 1 ? 's' : ''} available today.`;
  }
}

function renderAllergyFlags(rows) {
  const badge = document.getElementById('allergy-badge');
  const body  = document.getElementById('allergy-body');
  badge.textContent = `${rows.length} flagged`;

  if (!rows.length) {
    body.innerHTML = '<div class="no-items">No allergy flags today</div>';
    return;
  }
  body.innerHTML = rows.map(r => `
    <div class="allergy-row">
      <div>
        <div class="allergy-name">${esc(r.customer_name)} <span class="allergy-time">${fmtTime(r.time)}</span></div>
        <div class="allergy-phone">${r.customer_phone || ''}</div>
      </div>
      <span class="red-pill">${esc(r.notes)}</span>
    </div>`).join('');
}

function renderEscalations(escs) {
  const badge = document.getElementById('esc-badge');
  const body  = document.getElementById('esc-body');
  badge.textContent = `${escs.length} pending`;

  if (!escs.length) {
    body.innerHTML = '<div class="no-items">No pending escalations</div>';
    return;
  }
  body.innerHTML = escs.map(e => `
    <div class="esc-row" id="esc-${e.id}">
      <div class="esc-top">
        <div>
          <div class="esc-name">${esc(e.customer_name || 'Unknown')}</div>
          <div class="esc-phone">${e.customer_phone || ''}</div>
        </div>
        <span class="esc-type-pill">${esc(e.type || 'Other')}</span>
      </div>
      <div class="esc-note">${esc(e.note || '')}</div>
      <div class="esc-ts">Received ${e.received_at || ''}</div>
      <div class="esc-actions">
        <button class="btn-icon resolve" onclick="resolveEscalation('${e.id}')">Mark resolved</button>
      </div>
    </div>`).join('');
}

function renderTodayTable(rows) {
  const tbody = document.getElementById('today-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);font-style:italic;padding:24px 0">No reservations today</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="td-name">${esc(r.customer_name)}</td>
      <td>${fmtTime(r.time)}</td>
      <td>${r.party_size}</td>
      <td>${r.notes ? `<span class="red-pill" style="font-size:0.5rem">${esc(r.notes)}</span>` : '<span class="td-none">—</span>'}</td>
      <td>${r.customer_phone ? `<a class="td-phone" href="https://wa.me/${r.customer_phone.replace(/\D/g,'')}" target="_blank">${esc(r.customer_phone)}</a>` : '<span class="td-none">—</span>'}</td>
      <td><span class="status-badge ${r.status}">${r.status.replace('_',' ')}</span></td>
      <td>
        <div class="row-actions">
          ${r.status === 'confirmed' ? `<button class="btn-icon arrived" onclick="setStatus('${r.id}','arrived','overview')">Arrived</button>` : ''}
          ${r.status === 'confirmed' ? `<button class="btn-icon no-show" onclick="setStatus('${r.id}','no_show','overview')">No-show</button>` : ''}
          <button class="btn-icon" onclick="openEditModal(${JSON.stringify(r).replace(/"/g,'&quot;')})">Edit</button>
        </div>
      </td>
    </tr>`).join('');
}

function buildWeeklyChartData(rows, fromDate) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = isoDate(addDays(new Date(fromDate + 'T00:00:00'), i));
    const dayRows = rows.filter(r => r.date === d && r.status !== 'cancelled');
    days.push({
      date: d,
      reservations: dayRows.length,
      covers: dayRows.reduce((s, r) => s + (r.party_size || 0), 0),
    });
  }
  return days;
}

/* ══════════════════════════════════════════════════════════
   CHART
══════════════════════════════════════════════════════════ */
function renderChart(data) {
  const labels = data.map(d =>
    new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
  );
  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(document.getElementById('weeklyChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Reservations',
          data: data.map(d => d.reservations),
          backgroundColor: 'rgba(197,150,58,0.14)',
          borderColor:     'rgba(197,150,58,0.70)',
          borderWidth: 1.5, borderRadius: 3, borderSkipped: false,
        },
        {
          label: 'Covers',
          data: data.map(d => d.covers),
          backgroundColor: 'rgba(45,106,79,0.12)',
          borderColor:     'rgba(45,106,79,0.60)',
          borderWidth: 1.5, borderRadius: 3, borderSkipped: false,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#FFFDF8',
          borderColor: 'rgba(160,82,45,0.18)', borderWidth: 1,
          titleColor: '#1A1A1A', bodyColor: '#8A7A6A',
          titleFont: { family: "'Inter',sans-serif", size: 11, weight: '500' },
          bodyFont:  { family: "'Inter',sans-serif", size: 11, weight: '300' },
          padding: 12, cornerRadius: 6,
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8A7A6A', font: { family: "'Inter',sans-serif", size: 11 } }, border: { display: false } },
        y: { grid: { color: 'rgba(160,82,45,0.07)' }, ticks: { color: '#8A7A6A', font: { family: "'Inter',sans-serif", size: 11 }, stepSize: 1 }, border: { display: false }, beginAtZero: true },
      },
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 500, easing: 'easeOutQuart' },
    }
  });
}

/* ══════════════════════════════════════════════════════════
   VIEW 2 — RESERVATIONS
══════════════════════════════════════════════════════════ */

// Date nav
function updateResDateNav() {
  const iso     = isoDate(resDate);
  const isToday = iso === TODAY;
  const label   = isToday ? 'Today' : fmtDate(iso);
  document.getElementById('res-date-label').textContent = label;
  document.getElementById('res-date-picker').value      = iso;
  document.getElementById('res-today-btn').className    = isToday ? 'rdn-btn active' : 'rdn-btn';
}

function shiftResDate(n) { resDate = addDays(resDate, n); updateResDateNav(); loadReservations(); }
function goResToday()    { resDate = new Date(TODAY_DATE); updateResDateNav(); loadReservations(); }
function pickResDate(v)  { if (!v) return; resDate = new Date(v + 'T00:00:00'); updateResDateNav(); loadReservations(); }

async function loadReservations() {
  if (!currentRestaurantId) return;
  const iso = isoDate(resDate);

  let q = db.from('reservations').select('*')
    .eq('restaurant_id', currentRestaurantId)
    .eq('date', iso)
    .order('time');

  if (activeFilter !== 'all') q = q.eq('status', activeFilter);

  const { data } = await q;
  renderReservationsTable(data || []);
}

function setFilter(f) {
  activeFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.filter === f));
  loadReservations();
}

function renderReservationsTable(rows) {
  const tbody = document.getElementById('res-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);font-style:italic;padding:24px 0">No reservations for this date</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="td-name">${esc(r.customer_name)}</td>
      <td>${fmtTime(r.time)}</td>
      <td>${r.party_size}</td>
      <td>${r.customer_phone ? `<a class="td-phone" href="https://wa.me/${r.customer_phone.replace(/\D/g,'')}" target="_blank">${esc(r.customer_phone)}</a>` : '<span class="td-none">—</span>'}</td>
      <td class="td-notes">${r.notes ? esc(r.notes) : '<span class="td-none">—</span>'}</td>
      <td><span class="status-badge ${r.status}">${r.status.replace('_',' ')}</span></td>
      <td><span class="source-badge ${r.source}">${r.source}</span></td>
      <td>
        <div class="row-actions">
          ${r.status === 'confirmed' ? `<button class="btn-icon arrived" onclick="setStatus('${r.id}','arrived','reservations')">Arrived</button>` : ''}
          ${r.status === 'confirmed' ? `<button class="btn-icon no-show" onclick="setStatus('${r.id}','no_show','reservations')">No-show</button>` : ''}
          <button class="btn-icon" onclick="openEditModal(${JSON.stringify(r).replace(/"/g,'&quot;')})">Edit</button>
          ${r.status !== 'cancelled' ? `<button class="btn-icon no-show" onclick="cancelReservation('${r.id}')">Cancel</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

/* ══════════════════════════════════════════════════════════
   RESERVATION MODAL (Add / Edit)
══════════════════════════════════════════════════════════ */
function openAddModal() {
  editingReservation = null;
  document.getElementById('modal-title').textContent  = 'New Reservation';
  document.getElementById('modal-name').value         = '';
  document.getElementById('modal-date').value         = isoDate(resDate);
  document.getElementById('modal-time').value         = '';
  document.getElementById('modal-covers').value       = '2';
  document.getElementById('modal-phone').value        = '';
  document.getElementById('modal-notes').value        = '';
  document.getElementById('modal-status-wrap').style.display = 'none';
  populateTableSelect(null);
  showModal();
}

function openEditModal(r) {
  editingReservation = r;
  document.getElementById('modal-title').textContent  = 'Edit Reservation';
  document.getElementById('modal-name').value         = r.customer_name  || '';
  document.getElementById('modal-date').value         = r.date           || '';
  document.getElementById('modal-time').value         = r.time ? r.time.slice(0,5) : '';
  document.getElementById('modal-covers').value       = r.party_size     || 1;
  document.getElementById('modal-phone').value        = r.customer_phone || '';
  document.getElementById('modal-notes').value        = r.notes          || '';
  document.getElementById('modal-status').value       = r.status         || 'confirmed';
  document.getElementById('modal-status-wrap').style.display = '';
  populateTableSelect(r.table_id);
  showModal();
}

async function populateTableSelect(selectedId) {
  const wrap = document.getElementById('modal-table-wrap');
  const sel  = document.getElementById('modal-table');

  if (!currentRestaurant || currentRestaurant.booking_mode !== 'tables') {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  const { data } = await db.from('restaurant_tables').select('*')
    .eq('restaurant_id', currentRestaurantId).eq('is_active', true).order('table_name');

  sel.innerHTML = '<option value="">No table assigned</option>' +
    (data || []).map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${esc(t.table_name)} (seats ${t.capacity})</option>`).join('');
}

function showModal() {
  const bd = document.getElementById('modal-backdrop');
  bd.style.display = 'flex';
  requestAnimationFrame(() => bd.classList.add('open'));
}

function closeModal() {
  const bd = document.getElementById('modal-backdrop');
  bd.classList.remove('open');
  setTimeout(() => { bd.style.display = 'none'; }, 200);
}

async function saveReservation() {
  const name    = document.getElementById('modal-name').value.trim();
  const date    = document.getElementById('modal-date').value;
  const time    = document.getElementById('modal-time').value;
  const covers  = parseInt(document.getElementById('modal-covers').value, 10);
  const phone   = document.getElementById('modal-phone').value.trim();
  const notes   = document.getElementById('modal-notes').value.trim();
  const tableId = document.getElementById('modal-table')?.value || null;
  const status  = document.getElementById('modal-status')?.value || 'confirmed';

  if (!name || !date || !time || !covers) {
    alert('Name, date, time and covers are required.');
    return;
  }

  const payload = {
    restaurant_id:  currentRestaurantId,
    customer_name:  name,
    date,
    time,
    party_size:     covers,
    customer_phone: phone || null,
    notes:          notes || null,
    table_id:       tableId || null,
    source:         editingReservation ? editingReservation.source : 'manual',
    status,
  };

  const btn = document.getElementById('modal-save-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  let error;
  if (editingReservation) {
    ({ error } = await db.from('reservations').update(payload).eq('id', editingReservation.id));
  } else {
    ({ error } = await db.from('reservations').insert(payload));
  }

  btn.disabled    = false;
  btn.textContent = 'Save';

  if (error) { alert('Error saving: ' + error.message); return; }

  closeModal();
  const activeView = (location.hash || '#overview').slice(1);
  if (activeView === 'overview')     loadOverview();
  if (activeView === 'reservations') loadReservations();
}

/* ══════════════════════════════════════════════════════════
   STATUS UPDATES
══════════════════════════════════════════════════════════ */
async function setStatus(id, status, refreshView) {
  await db.from('reservations').update({ status }).eq('id', id);
  if (refreshView === 'overview')     loadOverview();
  if (refreshView === 'reservations') loadReservations();
}

async function cancelReservation(id) {
  if (!confirm('Cancel this reservation?')) return;
  await setStatus(id, 'cancelled', 'reservations');
}

async function resolveEscalation(id) {
  await db.from('escalations').update({ resolved: true }).eq('id', id);
  const row = document.getElementById('esc-' + id);
  if (row) row.remove();

  // Update badge count
  const body  = document.getElementById('esc-body');
  const badge = document.getElementById('esc-badge');
  const remaining = body.querySelectorAll('.esc-row').length;
  badge.textContent = `${remaining} pending`;
  if (!remaining) body.innerHTML = '<div class="no-items">No pending escalations</div>';
}

/* ══════════════════════════════════════════════════════════
   VIEW 3 — SETTINGS
══════════════════════════════════════════════════════════ */
async function loadSettings() {
  if (!currentRestaurantId) return;

  const [hoursRes, closuresRes, tablesRes] = await Promise.all([
    db.from('opening_hours').select('*').eq('restaurant_id', currentRestaurantId),
    db.from('closures').select('*').eq('restaurant_id', currentRestaurantId).order('date'),
    db.from('restaurant_tables').select('*').eq('restaurant_id', currentRestaurantId).order('table_name'),
  ]);

  renderRestaurantInfo();
  renderOpeningHours(hoursRes.data || []);
  renderClosures(closuresRes.data || []);
  renderTablesSection(tablesRes.data || []);
}

function renderRestaurantInfo() {
  if (!currentRestaurant) return;
  document.getElementById('set-name').value    = currentRestaurant.name    || '';
  document.getElementById('set-address').value = currentRestaurant.address || '';
  document.getElementById('set-tz').value      = currentRestaurant.timezone || '';

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === (currentRestaurant.booking_mode || 'seats'));
  });

  // Show/hide tables section based on mode
  const tablesSection = document.getElementById('tables-section');
  if (tablesSection) tablesSection.style.display =
    currentRestaurant.booking_mode === 'tables' ? '' : 'none';
}

async function saveRestaurantInfo() {
  const name    = document.getElementById('set-name').value.trim();
  const address = document.getElementById('set-address').value.trim();
  const tz      = document.getElementById('set-tz').value.trim();
  const msg     = document.getElementById('info-save-msg');

  const { error } = await db.from('restaurants').update({ name, address, timezone: tz })
    .eq('id', currentRestaurantId);

  if (error) { showSaveMsg(msg, 'Error: ' + error.message, false); return; }

  currentRestaurant = { ...currentRestaurant, name, address, timezone: tz };
  document.getElementById('client-name').textContent    = name;
  document.getElementById('client-address').textContent = address;
  showSaveMsg(msg, 'Saved ✓', true);
}

async function setBookingMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));

  await db.from('restaurants').update({ booking_mode: mode }).eq('id', currentRestaurantId);
  currentRestaurant = { ...currentRestaurant, booking_mode: mode };

  const tablesSection = document.getElementById('tables-section');
  if (tablesSection) tablesSection.style.display = mode === 'tables' ? '' : 'none';
}

function renderOpeningHours(rows) {
  const container = document.getElementById('hours-container');
  // Build a map: day_of_week → row
  const map = {};
  rows.forEach(r => { map[r.day_of_week] = r; });

  // Mon–Sun display order: 1,2,3,4,5,6,0
  const order = [1,2,3,4,5,6,0];

  container.innerHTML = order.map(dow => {
    const h = map[dow] || {};
    const active = h.is_active !== false;
    return `
    <div class="hours-row" data-dow="${dow}">
      <span class="hours-day">${DAY_NAMES[dow].slice(0,3)}</span>
      <input class="hours-input" type="time" value="${h.open_time  ? h.open_time.slice(0,5)  : ''}" ${!active?'disabled':''} placeholder="09:00">
      <input class="hours-input" type="time" value="${h.close_time ? h.close_time.slice(0,5) : ''}" ${!active?'disabled':''} placeholder="22:00">
      <input class="hours-covers" type="number" min="0" value="${h.max_covers || ''}" ${!active?'disabled':''} placeholder="60">
      <label class="toggle">
        <input type="checkbox" ${active?'checked':''} onchange="toggleHoursDay(this, ${dow})">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }).join('');
}

function toggleHoursDay(checkbox, dow) {
  const row = checkbox.closest('.hours-row');
  row.querySelectorAll('input[type="time"], input[type="number"]').forEach(el => {
    el.disabled = !checkbox.checked;
  });
}

async function saveOpeningHours() {
  const rows   = document.querySelectorAll('#hours-container .hours-row');
  const msg    = document.getElementById('hours-save-msg');
  const upserts = [];

  rows.forEach(row => {
    const dow      = parseInt(row.dataset.dow, 10);
    const inputs   = row.querySelectorAll('input');
    const open     = inputs[0].value;
    const close    = inputs[1].value;
    const covers   = parseInt(inputs[2].value, 10) || 0;
    const active   = inputs[3].checked;

    if (!open || !close) return;
    upserts.push({
      restaurant_id: currentRestaurantId,
      day_of_week:   dow,
      open_time:     open,
      close_time:    close,
      max_covers:    covers,
      is_active:     active,
    });
  });

  const { error } = await db.from('opening_hours')
    .upsert(upserts, { onConflict: 'restaurant_id,day_of_week' });

  showSaveMsg(msg, error ? 'Error: ' + error.message : 'Saved ✓', !error);
}

function renderClosures(rows) {
  const list = document.getElementById('closures-list');
  if (!rows.length) {
    list.innerHTML = '<div class="no-items" style="padding:14px 0">No closed dates configured</div>';
    return;
  }
  list.innerHTML = rows.map(c => `
    <div class="closure-row" id="cl-${c.id}">
      <div>
        <div class="closure-date">${fmtDate(c.date)}</div>
        ${c.reason ? `<div class="closure-reason">${esc(c.reason)}</div>` : ''}
      </div>
      <button class="closure-remove" onclick="removeClosure('${c.id}')">Remove</button>
    </div>`).join('');
}

async function addClosure() {
  const dateEl   = document.getElementById('new-closure-date');
  const reasonEl = document.getElementById('new-closure-reason');
  const msg      = document.getElementById('closures-save-msg');

  if (!dateEl.value) { showSaveMsg(msg, 'Pick a date', false); return; }

  const { data, error } = await db.from('closures').insert({
    restaurant_id: currentRestaurantId,
    date:   dateEl.value,
    reason: reasonEl.value.trim() || null,
  }).select().single();

  if (error) { showSaveMsg(msg, 'Error: ' + error.message, false); return; }

  dateEl.value   = '';
  reasonEl.value = '';
  showSaveMsg(msg, 'Added ✓', true);

  // Append to list
  const list = document.getElementById('closures-list');
  const noItems = list.querySelector('.no-items');
  if (noItems) list.innerHTML = '';
  list.insertAdjacentHTML('beforeend', `
    <div class="closure-row" id="cl-${data.id}">
      <div>
        <div class="closure-date">${fmtDate(data.date)}</div>
        ${data.reason ? `<div class="closure-reason">${esc(data.reason)}</div>` : ''}
      </div>
      <button class="closure-remove" onclick="removeClosure('${data.id}')">Remove</button>
    </div>`);
}

async function removeClosure(id) {
  await db.from('closures').delete().eq('id', id);
  const el = document.getElementById('cl-' + id);
  if (el) el.remove();
  const list = document.getElementById('closures-list');
  if (!list.querySelector('.closure-row'))
    list.innerHTML = '<div class="no-items" style="padding:14px 0">No closed dates configured</div>';
}

function renderTablesSection(rows) {
  const list = document.getElementById('tables-list');
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = '<div class="no-items" style="padding:14px 0">No tables configured</div>';
    return;
  }
  list.innerHTML = rows.map(t => `
    <div class="table-row" id="tbl-${t.id}">
      <div>
        <div class="table-name">${esc(t.table_name)}</div>
        <div class="table-cap">Seats ${t.capacity}</div>
      </div>
      <button class="table-remove" onclick="removeTable('${t.id}')">Remove</button>
    </div>`).join('');
}

async function addTable() {
  const nameEl = document.getElementById('new-table-name');
  const capEl  = document.getElementById('new-table-cap');
  const msg    = document.getElementById('tables-save-msg');

  const name = nameEl.value.trim();
  const cap  = parseInt(capEl.value, 10);

  if (!name || !cap) { showSaveMsg(msg, 'Enter a name and capacity', false); return; }

  const { data, error } = await db.from('restaurant_tables').insert({
    restaurant_id: currentRestaurantId,
    table_name: name,
    capacity:   cap,
    is_active:  true,
  }).select().single();

  if (error) { showSaveMsg(msg, 'Error: ' + error.message, false); return; }

  nameEl.value = '';
  capEl.value  = '';
  showSaveMsg(msg, 'Added ✓', true);

  const list    = document.getElementById('tables-list');
  const noItems = list.querySelector('.no-items');
  if (noItems) list.innerHTML = '';
  list.insertAdjacentHTML('beforeend', `
    <div class="table-row" id="tbl-${data.id}">
      <div>
        <div class="table-name">${esc(data.table_name)}</div>
        <div class="table-cap">Seats ${data.capacity}</div>
      </div>
      <button class="table-remove" onclick="removeTable('${data.id}')">Remove</button>
    </div>`);
}

async function removeTable(id) {
  await db.from('restaurant_tables').delete().eq('id', id);
  const el = document.getElementById('tbl-' + id);
  if (el) el.remove();
  const list = document.getElementById('tables-list');
  if (!list.querySelector('.table-row'))
    list.innerHTML = '<div class="no-items" style="padding:14px 0">No tables configured</div>';
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function showSaveMsg(el, text, ok) {
  el.textContent  = text;
  el.className    = `save-msg ${ok ? 'ok' : 'err'}`;
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// Close modal on backdrop click
document.getElementById('modal-backdrop').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(t => {
  t.addEventListener('click', () => setFilter(t.dataset.filter));
});
