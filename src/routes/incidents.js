const express = require('express');
const { db } = require('../db');

const r = express.Router();

r.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM incidents WHERE org_id = ? ORDER BY id DESC').all(req.user.org_id));
});

r.post('/', (req, res) => {
  const { title, notes = '', severity = 'medium', monitor_id = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const i = db.prepare('INSERT INTO incidents (org_id,monitor_id,title,notes,severity,created_by) VALUES (?,?,?,?,?,?)')
    .run(req.user.org_id, monitor_id, title, notes, severity, req.user.id);
  res.json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(i.lastInsertRowid));
});

// Workflow: open -> investigating -> resolved (needs owner approval) -> closed
const FLOW = { open: ['investigating'], investigating: ['resolved'], resolved: ['closed'] };

r.patch('/:id/status', (req, res) => {
  const inc = db.prepare('SELECT * FROM incidents WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
  if (!inc) return res.status(404).json({ error: 'insiden tidak ditemukan' });
  const next = req.body.status;
  if (next === 'resolved') {
    if (!(FLOW[inc.status] || []).includes(next)) return res.status(400).json({ error: `tidak bisa ${inc.status} -> ${next}` });
    if (!inc.approved_by) return res.status(403).json({ error: 'butuh approval owner sebelum resolved' });
  }
  db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(next, inc.id);
  res.json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(inc.id));
});

r.post('/:id/approve', (req, res) => {
  if (req.user.role !== 'owner' && req.body.approver_role !== 'owner') return res.status(403).json({ error: 'hanya owner' });
  const inc = db.prepare('SELECT * FROM incidents WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
  if (!inc) return res.status(404).json({ error: 'insiden tidak ditemukan' });
  db.prepare('UPDATE incidents SET approved_by = ? WHERE id = ?').run(req.user.id, inc.id);
  res.json({ message: 'Disetujui' });
});

module.exports = r;
