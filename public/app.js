// PantauApp SPA (vanilla JS)
const $ = (s) => document.querySelector(s);
const app = $('#app');
let ME = null;

const token = () => localStorage.getItem('token');
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 3500); }
const fmt = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const form = (el) => Object.fromEntries(new FormData(el).entries());
const isRole = (...r) => ME && r.includes(ME.user.role);

// ---------------- auth screens ----------------
function viewLogin() {
  app.innerHTML = `
  <div class="card auth"><h2>Masuk ke PantauApp</h2>
    <form id="f"><input name="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required><button>Masuk</button></form>
    <p class="muted"><a href="#register">Daftar</a> · <a href="#forgot">Lupa password?</a></p></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/auth/login', { method: 'POST', body: form(e.target) });
      if (d.mfa_required) { localStorage.setItem('token', d.pending_token); location.hash = '#mfa'; return; }
      localStorage.setItem('token', d.token); location.hash = '#dashboard';
    } catch (err) { toast(err.message); }
  };
}
function viewMfa() {
  app.innerHTML = `<div class="card auth"><h2>Verifikasi 2 Langkah</h2><p class="muted">Masukkan 4 digit kode OTP yang dikirim ke email Anda.</p>
    <form id="f"><input name="code" maxlength="4" placeholder="0000" required><button>Verifikasi</button></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try { const d = await api('/auth/mfa', { method: 'POST', body: form(e.target) }); localStorage.setItem('token', d.token); location.hash = '#dashboard'; }
    catch (err) { toast(err.message); }
  };
}
function viewRegister() {
  app.innerHTML = `<div class="card auth"><h2>Buat akun</h2>
    <form id="f"><input name="name" placeholder="Nama"><input name="org_name" placeholder="Nama organisasi"><input name="email" placeholder="Email" required><input name="password" type="password" placeholder="Password (min 8 karakter)" minlength="8" required><button>Daftar</button></form>
    <p class="muted"><a href="#login">Sudah punya akun?</a></p></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try { const d = await api('/auth/register', { method: 'POST', body: form(e.target) }); localStorage.setItem('token', d.token); toast(d.message); location.hash = '#dashboard'; }
    catch (err) { toast(err.message); }
  };
}
function viewForgot() {
  app.innerHTML = `<div class="card auth"><h2>Lupa password</h2>
    <form id="f"><input name="email" placeholder="Email" required><button>Kirim link reset</button></form>
    <hr><h3>Sudah punya token?</h3>
    <form id="r"><input name="email" placeholder="Email"><input name="token" placeholder="Token reset"><input name="new_password" type="password" placeholder="Password baru"><button>Reset</button></form></div>`;
  $('#f').onsubmit = async (e) => { e.preventDefault(); try { const d = await api('/auth/forgot', { method: 'POST', body: form(e.target) }); toast(d.message); } catch (err) { toast(err.message); } };
  $('#r').onsubmit = async (e) => { e.preventDefault(); try { const d = await api('/auth/reset', { method: 'POST', body: form(e.target) }); toast(d.message); location.hash = '#login'; } catch (err) { toast(err.message); } };
}

// ---------------- monitors ----------------
async function viewDashboard() {
  const monitors = await api('/monitors');
  const atLimit = monitors.length >= ME.org.monitor_limit;
  app.innerHTML = `
  <div class="grid">
    <div class="card"><div class="muted">Organisasi</div><h2>${ME.org.name}</h2><div class="muted">Paket ${ME.org.plan} · kredit ${fmt(ME.org.credit)}</div></div>
    <div class="card"><div class="muted">Monitor</div><h2>${monitors.length} / ${ME.org.monitor_limit}</h2><div class="muted">${monitors.filter((m) => m.status === 'up').length} up · ${monitors.filter((m) => m.status === 'down').length} down</div></div>
  </div>
  <div class="card"><div class="row"><input id="q" placeholder="Cari monitor..."><button class="ghost" id="search" style="flex:0">Cari</button></div>
    <div class="table-wrap"><table><thead><tr><th>Nama</th><th>URL</th><th>Status</th><th>Respon</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
  ${isRole('admin', 'owner') ? (atLimit
    ? `<div class="card"><h3>Batas paket tercapai</h3><p class="muted">Upgrade paket untuk menambah monitor. <a href="#billing">Lihat paket</a></p></div>`
    : `<div class="card"><h3>Tambah monitor</h3><form id="add"><div class="row"><input name="name" placeholder="Nama" required><input name="url" placeholder="https://..." type="url" required><input name="interval_sec" type="number" value="60" min="30"></div><button>Simpan</button> <button type="button" class="ghost" id="test">Tes URL</button></form><pre id="out" hidden></pre></div>`) : ''}`;
  const render = (list) => {
    $('#rows').innerHTML = list.map((m) => `<tr><td>${m.name}</td><td class="muted">${m.url}</td><td><span class="pill ${m.status}">${m.status}</span></td><td>${m.last_response_ms ?? '-'} ms</td>
      <td><button class="ghost" data-check="${m.id}">Cek</button> ${isRole('admin', 'owner') ? `<button class="danger" data-del="${m.id}">Hapus</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Belum ada monitor</td></tr>';
  };
  render(monitors);
  $('#search').onclick = async () => render(await api('/monitors/search?q=' + encodeURIComponent($('#q').value)));
  app.onclick = async (e) => {
    const c = e.target.dataset.check, d = e.target.dataset.del;
    try {
      if (c) { const r = await api(`/monitors/${c}/check`, { method: 'POST' }); toast(`${r.monitor}: HTTP ${r.status} (${r.ms} ms)`); route(); }
      if (d && confirm('Hapus monitor?')) { await api(`/monitors/${d}`, { method: 'DELETE' }); route(); }
    } catch (err) { toast(err.message); }
  };
  if ($('#add')) {
    $('#add').onsubmit = async (e) => { e.preventDefault(); try { await api('/monitors', { method: 'POST', body: form(e.target) }); toast('Monitor ditambahkan'); route(); } catch (err) { toast(err.message); } };
    $('#test').onclick = async () => { const r = await api('/monitors/test', { method: 'POST', body: { url: $('#add').url.value } }); const o = $('#out'); o.hidden = false; o.textContent = JSON.stringify(r, null, 2); };
  }
}

// ---------------- incidents ----------------
async function viewIncidents() {
  const list = await api('/incidents');
  const next = { open: 'investigating', investigating: 'resolved', resolved: 'closed' };
  app.innerHTML = `<div class="card"><h2>Insiden</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Judul</th><th>Catatan</th><th>Severity</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map((i) => `<tr><td>${i.id}</td><td>${i.title}</td><td>${i.notes || ''}</td><td>${i.severity}</td><td>${i.status}${i.approved_by ? ' ✓' : ''}</td><td>
      ${next[i.status] && (next[i.status] !== 'closed' || isRole('owner')) ? `<button class="ghost" data-id="${i.id}" data-to="${next[i.status]}">→ ${next[i.status]}</button>` : ''}
      ${i.status === 'investigating' && !i.approved_by && isRole('owner') ? `<button data-approve="${i.id}">Approve</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="card"><h3>Laporkan insiden</h3><form id="f"><input name="title" placeholder="Judul" required><textarea name="notes" placeholder="Catatan (boleh pakai <b>format</b>)"></textarea>
    <select name="severity"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select><button>Buat</button></form></div>`;
  app.onclick = async (e) => {
    try {
      if (e.target.dataset.to) { await api(`/incidents/${e.target.dataset.id}/status`, { method: 'PATCH', body: { status: e.target.dataset.to } }); route(); }
      if (e.target.dataset.approve) { await api(`/incidents/${e.target.dataset.approve}/approve`, { method: 'POST' }); route(); }
    } catch (err) { toast(err.message); }
  };
  $('#f').onsubmit = async (e) => { e.preventDefault(); try { await api('/incidents', { method: 'POST', body: form(e.target) }); route(); } catch (err) { toast(err.message); } };
}

// ---------------- team ----------------
async function viewTeam() {
  const members = await api(`/orgs/${ME.user.org_id}/members`);
  app.innerHTML = `<div class="card"><h2>Anggota tim</h2><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>
    ${members.map((m) => `<tr><td>${m.name}</td><td>${m.email}</td><td>${m.role}</td><td>${isRole('admin', 'owner') && m.id !== ME.user.id && m.role !== 'owner' ? `<button class="danger" data-del="${m.id}">Keluarkan</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div></div>
  ${isRole('admin', 'owner') ? `<div class="card"><h3>Undang anggota</h3><form id="inv"><div class="row"><input name="email" type="email" placeholder="email@perusahaan.com" required>
    <select name="role"><option value="viewer">viewer</option><option value="admin">admin</option>${isRole('owner') ? '<option value="owner">owner</option>' : ''}</select></div><button>Kirim undangan</button></form><pre id="link" hidden></pre></div>` : ''}
  <div class="card"><h3>Terima undangan</h3><form id="acc"><input name="token" placeholder="Token undangan" value="${new URLSearchParams(location.hash.split('?')[1]).get('token') || ''}"><button>Gabung</button></form></div>`;
  app.onclick = async (e) => { if (e.target.dataset.del && confirm('Keluarkan anggota?')) { try { await api(`/orgs/members/${e.target.dataset.del}`, { method: 'DELETE' }); route(); } catch (err) { toast(err.message); } } };
  if ($('#inv')) $('#inv').onsubmit = async (e) => { e.preventDefault(); try { const d = await api('/orgs/invites', { method: 'POST', body: form(e.target) }); const l = $('#link'); l.hidden = false; l.textContent = location.origin + d.invite_link; } catch (err) { toast(err.message); } };
  $('#acc').onsubmit = async (e) => { e.preventDefault(); try { const d = await api('/orgs/invites/accept', { method: 'POST', body: form(e.target) }); localStorage.setItem('token', d.token); toast(d.message); location.hash = '#dashboard'; } catch (err) { toast(err.message); } };
}

// ---------------- billing ----------------
async function viewBilling() {
  const [plans, invoices] = await Promise.all([api('/billing/plans'), api('/billing/invoices')]);
  app.innerHTML = `<div class="grid">${Object.entries(plans).map(([k, p]) => `<div class="card"><h3>${p.name}</h3><h2>${fmt(p.price)}<span class="muted">/bln</span></h2><p class="muted">${p.monitor_limit} monitor</p>
    ${ME.org.plan === k ? '<b>Paket aktif</b>' : isRole('owner') && p.price > 0 ? `<button data-plan="${k}" data-price="${p.price}">Pilih</button>` : ''}</div>`).join('')}</div>
  ${isRole('owner') ? `<div class="card" id="co" hidden><h3>Checkout <span id="pname"></span></h3><form id="f"><div class="row"><select name="months"><option>1</option><option>3</option><option>6</option><option>12</option></select><input name="coupon" placeholder="Kode kupon"></div>
    <input name="billing_name" placeholder="Nama di invoice"><input name="billing_address" placeholder="Alamat penagihan"><p>Total: <b id="total"></b></p><button>Bayar</button></form></div>
    ${ME.org.plan !== 'free' ? `<div class="card"><h3>Batalkan langganan</h3><p class="muted">Sisa masa aktif akan dikembalikan sebagai kredit (prorata 30 hari).</p><button class="danger" id="cancel">Batalkan</button></div>` : ''}` : ''}
  <div class="card"><h3>Invoice</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Paket</th><th>Bulan</th><th>Jumlah</th><th>Kupon</th><th>Tanggal</th></tr></thead><tbody>
    ${invoices.map((i) => `<tr><td><a href="/api/billing/invoices/${i.id}" data-inv="${i.id}">${i.id}</a></td><td>${i.plan}</td><td>${i.months}</td><td>${fmt(i.amount)}</td><td>${i.coupons || '-'}</td><td>${i.created_at}</td></tr>`).join('')}</tbody></table></div></div>`;
  let sel = null;
  const calc = async () => {
    const f = form($('#f')); let total = sel.price * f.months;
    if (f.coupon) { try { const c = await api('/billing/coupons/' + f.coupon); total -= (total * c.discount_pct) / 100; } catch { } }
    $('#total').textContent = fmt(total);
  };
  app.onclick = (e) => { if (e.target.dataset.plan) { sel = { plan: e.target.dataset.plan, price: Number(e.target.dataset.price) }; $('#co').hidden = false; $('#pname').textContent = sel.plan; calc(); } };
  if ($('#f')) {
    $('#f').onchange = calc;
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const f = form(e.target);
      try { const d = await api('/billing/checkout', { method: 'POST', body: { plan: sel.plan, price: sel.price, months: Number(f.months), coupons: f.coupon ? [f.coupon] : [], billing_name: f.billing_name, billing_address: f.billing_address } }); toast(d.message + ' — ' + fmt(d.amount)); route(); }
      catch (err) { toast(err.message); }
    };
  }
  if ($('#cancel')) $('#cancel').onclick = async () => {
    const last = invoices[0]; if (!last) return;
    const daysUsed = Math.floor((Date.now() - new Date(last.created_at + 'Z')) / 864e5);
    const refund = Math.max(0, Math.round(last.amount * (1 - daysUsed / (30 * last.months))));
    if (!confirm(`Refund ${fmt(refund)}. Lanjutkan?`)) return;
    try { const d = await api('/billing/cancel', { method: 'POST', body: { refund_amount: refund } }); toast(d.message); route(); } catch (err) { toast(err.message); }
  };
}

// ---------------- settings ----------------
async function viewSettings() {
  const keys = await api('/apikeys');
  app.innerHTML = `<div class="card"><h2>Profil</h2><form id="p"><input name="name" value="${ME.user.name}"><input name="email" value="${ME.user.email}"><input name="password" type="password" placeholder="Password baru (opsional)"><button>Simpan</button></form>
    <p class="muted">Role: ${ME.user.role} · Email ${ME.user.verified ? 'terverifikasi' : 'belum terverifikasi'} · 2FA ${ME.user.mfa_enabled ? 'aktif' : 'nonaktif'}</p></div>
  <div class="card"><h3>Tampilan</h3><form id="pref"><div class="row"><select name="theme"><option>system</option><option>light</option><option>dark</option></select><select name="timezone"><option>Asia/Jakarta</option><option>Asia/Makassar</option><option>Asia/Jayapura</option></select></div><button>Simpan preferensi</button></form></div>
  <div class="card"><h3>API keys</h3><div class="table-wrap"><table><tbody>${keys.map((k) => `<tr><td><code>${k.key}</code></td><td>${k.scope}</td></tr>`).join('')}</tbody></table></div>
    ${isRole('admin', 'owner') ? `<form id="k" class="row" style="margin-top:10px"><select name="scope"><option value="read">read-only</option><option value="write">read-write</option></select><button style="flex:0">Buat key</button></form>` : ''}</div>`;
  $('#p').onsubmit = async (e) => { e.preventDefault(); const b = form(e.target); if (!b.password) delete b.password; try { const d = await api('/users/me', { method: 'PUT', body: b }); localStorage.setItem('token', d.token); toast(d.message); boot(); } catch (err) { toast(err.message); } };
  $('#pref').onsubmit = async (e) => { e.preventDefault(); await api('/users/me/preferences', { method: 'PUT', body: { ui: form(e.target) } }); toast('Preferensi disimpan'); };
  if ($('#k')) $('#k').onsubmit = async (e) => { e.preventDefault(); const d = await api('/apikeys', { method: 'POST', body: form(e.target) }); toast('Key dibuat: ' + d.key); route(); };
}

async function viewAdmin() {
  const s = await api('/admin/stats');
  app.innerHTML = `<div class="card"><h2>Admin platform</h2><p>Total revenue: <b>${fmt(s.revenue)}</b></p><pre>${JSON.stringify(s, null, 2)}</pre></div>`;
}

// ---------------- router ----------------
const ROUTES = { login: viewLogin, mfa: viewMfa, register: viewRegister, forgot: viewForgot, dashboard: viewDashboard, incidents: viewIncidents, team: viewTeam, billing: viewBilling, settings: viewSettings, admin: viewAdmin, 'accept-invite': viewTeam };
const PUBLIC = ['login', 'register', 'forgot', 'mfa'];

async function boot() {
  ME = null;
  if (token()) { try { ME = await api('/users/me'); } catch { localStorage.removeItem('token'); } }
  $('#nav').hidden = !ME;
  $('#nav-admin').hidden = !(ME && ME.user.role === 'superadmin');
  route();
}
async function route() {
  const name = (location.hash.slice(1).split('?')[0]) || (ME ? 'dashboard' : 'login');
  if (!ME && !PUBLIC.includes(name)) return viewLogin();
  app.onclick = null;
  try { await (ROUTES[name] || viewDashboard)(); } catch (err) { app.innerHTML = `<div class="card">Error: ${err.message}</div>`; }
}
window.addEventListener('hashchange', () => (['dashboard', 'login'].includes(location.hash.slice(1)) ? boot() : route()));
$('#logout').onclick = (e) => { e.preventDefault(); localStorage.removeItem('token'); location.hash = '#login'; boot(); };
boot();
