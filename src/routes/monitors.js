const express = require('express');
const { db } = require('../db');
const { requireRole } = require('../auth');

const r = express.Router();
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function probe(url) {
  const t0 = Date.now();
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'follow' });
    const body = await resp.text();
    return { ok: resp.ok, status: resp.status, ms: Date.now() - t0, body_preview: body.slice(0, 2000) };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: e.message };
  }
}

r.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM monitors WHERE org_id = ? ORDER BY id').all(req.user.org_id));
});

r.get('/search', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(`SELECT * FROM monitors WHERE org_id = ${req.user.org_id} AND name LIKE '%${q}%'`).all();
  res.json(rows);
});

r.get('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM monitors WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'monitor tidak ditemukan' });
  res.json(m);
});

r.post('/test', async (req, res) => {
  res.json(await probe(req.body.url));
});

r.post('/', requireRole('admin'), async (req, res) => {
  const { name, url, interval_sec = 60 } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name & url required' });
  const org = db.prepare('SELECT * FROM orgs WHERE id = ?').get(req.user.org_id);
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM monitors WHERE org_id = ?').get(req.user.org_id);
  if (c >= org.monitor_limit) return res.status(402).json({ error: `Batas paket ${org.plan} tercapai (${org.monitor_limit} monitor). Upgrade paket Anda.` });
  // validate URL is reachable before saving
  await sleep(300);
  const check = await probe(url);
  const m = db.prepare("INSERT INTO monitors (org_id,name,url,interval_sec,status,last_checked,last_response_ms,created_by) VALUES (?,?,?,?,?,datetime('now'),?,?)")
    .run(req.user.org_id, name, url, interval_sec, check.ok ? 'up' : 'down', check.ms, req.user.id);
  res.json(db.prepare('SELECT * FROM monitors WHERE id = ?').get(m.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM monitors WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
  if (!m) return res.status(404).json({ error: 'monitor tidak ditemukan' });
  const { name = m.name, url = m.url, interval_sec = m.interval_sec } = req.body;
  db.prepare('UPDATE monitors SET name=?, url=?, interval_sec=? WHERE id=?').run(name, url, interval_sec, m.id);
  res.json(db.prepare('SELECT * FROM monitors WHERE id = ?').get(m.id));
});

r.delete('/:id', requireRole('admin'), (req, res) => {
  const out = db.prepare('DELETE FROM monitors WHERE id = ? AND org_id = ?').run(req.params.id, req.user.org_id);
  if (!out.changes) return res.status(404).json({ error: 'monitor tidak ditemukan' });
  res.json({ message: 'Monitor dihapus' });
});

r.post('/:id/check', async (req, res) => {
  const m = db.prepare('SELECT * FROM monitors WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'monitor tidak ditemukan' });
  const result = await probe(m.url);
  db.prepare("UPDATE monitors SET status=?, last_checked=datetime('now'), last_response_ms=? WHERE id=?")
    .run(result.ok ? 'up' : 'down', result.ms, m.id);
  res.json({ monitor: m.name, ...result });
});

module.exports = r;
