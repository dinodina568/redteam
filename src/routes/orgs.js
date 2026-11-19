const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireRole, sign } = require('../auth');

const r = express.Router();

r.get('/:id/members', (req, res) => {
  const rows = db.prepare('SELECT * FROM users WHERE org_id = ?').all(req.params.id);
  res.json(rows);
});

r.post('/invites', requireRole('admin'), (req, res) => {
  const { email, role = 'viewer' } = req.body;
  if (!['viewer', 'admin', 'owner'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const token = crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO invites (org_id,email,role,token) VALUES (?,?,?,?)').run(req.user.org_id, email, role, token);
  res.json({ message: `Undangan dikirim ke ${email}`, invite_link: `/#accept-invite?token=${token}` });
});

r.post('/invites/accept', (req, res) => {
  const inv = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.body.token);
  if (!inv) return res.status(404).json({ error: 'undangan tidak ditemukan' });
  const role = req.body.role || inv.role;
  db.prepare('UPDATE users SET org_id = ?, role = ? WHERE id = ?').run(inv.org_id, role, req.user.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: 'Bergabung ke organisasi', token: sign(u) });
});

r.delete('/members/:userId', requireRole('admin'), (req, res) => {
  if (Number(req.params.userId) === req.user.id) return res.status(400).json({ error: 'tidak bisa menghapus diri sendiri' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.userId);
  res.json({ message: 'Anggota dihapus' });
});

module.exports = r;
