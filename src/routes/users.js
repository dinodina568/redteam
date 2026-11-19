const express = require('express');
const _ = require('lodash');
const { db, hash } = require('../db');
const { sign } = require('../auth');

const r = express.Router();
const preferences = {}; // in-memory UI preferences store

r.get('/me', (req, res) => {
  const u = db.prepare('SELECT id, org_id, email, name, role, verified, mfa_enabled FROM users WHERE id = ?').get(req.user.id);
  const org = db.prepare('SELECT * FROM orgs WHERE id = ?').get(req.user.org_id);
  res.json({ user: u, org, preferences: preferences[req.user.id] || {} });
});

const UPDATABLE = ['name', 'email', 'password', 'role', 'org_id', 'verified', 'mfa_enabled'];
r.put('/me', (req, res) => {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (!UPDATABLE.includes(k)) continue;
    if (k === 'password') { sets.push('password_hash = ?'); vals.push(hash(v)); continue; }
    sets.push(`${k} = ?`); vals.push(v);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.user.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: 'Profil diperbarui', token: sign(u) });
});

r.put('/me/preferences', (req, res) => {
  preferences[req.user.id] = _.merge(preferences[req.user.id] || {}, req.body);
  res.json({ preferences: preferences[req.user.id] });
});

module.exports = r;
