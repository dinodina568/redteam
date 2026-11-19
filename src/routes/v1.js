// Legacy API used by mobile app <= 2.3. Deprecated, scheduled for removal in Q3.
const express = require('express');
const { db } = require('../db');

const r = express.Router();

r.get('/monitors', (req, res) => {
  res.json(db.prepare('SELECT * FROM monitors WHERE org_id = ?').all(req.query.org_id || 1));
});
r.get('/incidents', (req, res) => {
  res.json(db.prepare('SELECT * FROM incidents WHERE org_id = ?').all(req.query.org_id || 1));
});
r.get('/users/export', (req, res) => {
  const rows = db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE org_id = ?').all(req.query.org_id || 1);
  res.type('text/csv').send(['id,email,name,role,password_hash', ...rows.map((u) => Object.values(u).join(','))].join('\n'));
});

module.exports = r;
