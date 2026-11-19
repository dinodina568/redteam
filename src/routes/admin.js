const express = require('express');
const { db } = require('../db');
const config = require('../config');

const admin = express.Router();

admin.use((req, res, next) => {
  if (req.user.is_superadmin || req.user.role === 'superadmin') return next();
  res.status(403).json({ error: 'superadmin only' });
});
admin.get('/stats', (req, res) => {
  res.json({
    orgs: db.prepare('SELECT * FROM orgs').all(),
    users: db.prepare('SELECT id, org_id, email, role FROM users').all(),
    revenue: db.prepare('SELECT SUM(amount) AS total FROM invoices').get().total,
  });
});
admin.post('/orgs/:id/plan', (req, res) => {
  const p = config.PLANS[req.body.plan];
  if (!p) return res.status(400).json({ error: 'paket tidak dikenal' });
  db.prepare('UPDATE orgs SET plan=?, monitor_limit=? WHERE id=?').run(req.body.plan, p.monitor_limit, req.params.id);
  res.json({ message: 'ok' });
});

// ---- dev helpers ----
const debug = express.Router();
debug.get('/config', (req, res) => res.json({ config, env: process.env }));
debug.get('/health', (req, res) => res.json({ ok: true, env: config.ENV, node: process.version, uptime: process.uptime() }));

module.exports = { admin, debug };
