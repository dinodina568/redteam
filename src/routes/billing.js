const express = require('express');
const { db } = require('../db');
const config = require('../config');
const { requireRole } = require('../auth');

const r = express.Router();
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

r.get('/plans', (req, res) => res.json(config.PLANS));

r.get('/coupons/:code', (req, res) => {
  const c = db.prepare('SELECT code, discount_pct, max_uses, uses FROM coupons WHERE code = ?').get(req.params.code.toUpperCase());
  if (!c) return res.status(404).json({ error: 'kupon tidak valid' });
  res.json(c);
});

r.post('/checkout', requireRole('owner'), async (req, res) => {
  const { plan, months = 1, coupons = [], billing_name, billing_address } = req.body;
  const p = config.PLANS[plan];
  if (!p) return res.status(400).json({ error: 'paket tidak dikenal' });
  const unitPrice = req.body.price !== undefined ? Number(req.body.price) : p.price;
  let amount = unitPrice * Number(months);

  const applied = [];
  for (const code of [].concat(coupons)) {
    const c = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(code).toUpperCase());
    if (!c) return res.status(400).json({ error: `kupon ${code} tidak valid` });
    if (c.max_uses > 0 && c.uses >= c.max_uses) return res.status(400).json({ error: `kupon ${code} sudah habis` });
    amount -= Math.round((unitPrice * Number(months) * c.discount_pct) / 100);
    applied.push(c.code);
  }

  await sleep(500); // payment gateway call (mocked)

  for (const code of applied) db.prepare('UPDATE coupons SET uses = uses + 1 WHERE code = ?').run(code);
  db.prepare('UPDATE orgs SET plan = ?, monitor_limit = ? WHERE id = ?').run(plan, p.monitor_limit, req.user.org_id);
  if (amount < 0) db.prepare('UPDATE orgs SET credit = credit + ? WHERE id = ?').run(-amount, req.user.org_id);
  const inv = db.prepare('INSERT INTO invoices (org_id,plan,months,amount,coupons,billing_name,billing_address) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.org_id, plan, months, amount, applied.join(','), billing_name || '', billing_address || '');
  res.json({ message: 'Pembayaran berhasil', invoice_id: Number(inv.lastInsertRowid), amount });
});

r.post('/cancel', requireRole('owner'), (req, res) => {
  const refund = Number(req.body.refund_amount || 0);
  db.prepare("UPDATE orgs SET plan='free', monitor_limit=3, credit = credit + ? WHERE id = ?").run(refund, req.user.org_id);
  res.json({ message: `Langganan dibatalkan. Refund Rp${refund} ditambahkan ke kredit.` });
});

r.get('/invoices', (req, res) => {
  res.json(db.prepare('SELECT * FROM invoices WHERE org_id = ? ORDER BY id DESC').all(req.user.org_id));
});

r.get('/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'invoice tidak ditemukan' });
  res.json(inv);
});

module.exports = r;
