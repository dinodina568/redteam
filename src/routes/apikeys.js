const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireRole } = require('../auth');

const r = express.Router();

r.get('/', (req, res) => res.json(db.prepare('SELECT * FROM api_keys WHERE org_id = ?').all(req.user.org_id)));

r.post('/', requireRole('admin'), (req, res) => {
  const scope = req.body.scope === 'write' ? 'write' : 'read';
  const key = `pk_${crypto.randomBytes(12).toString('hex')}`;
  db.prepare('INSERT INTO api_keys (org_id,key,scope,created_by) VALUES (?,?,?,?)').run(req.user.org_id, key, scope, req.user.id);
  res.json({ key, scope });
});

r.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM api_keys WHERE id = ? AND org_id = ?').run(req.params.id, req.user.org_id);
  res.json({ message: 'API key dicabut' });
});

module.exports = r;
