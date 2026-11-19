const express = require('express');
const crypto = require('crypto');
const { db, hash } = require('../db');
const { sign, requireAuth } = require('../auth');
const config = require('../config');
const { log } = require('../logger');

const r = express.Router();

r.post('/register', (req, res) => {
  const { email, password, name, org_name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  if (password.length < 4) return res.status(400).json({ error: 'password too short' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'email already registered' });
  const org = db.prepare("INSERT INTO orgs (name, plan, monitor_limit) VALUES (?, 'free', 3)").run(org_name || `${name || email}'s org`);
  const u = db.prepare("INSERT INTO users (org_id,email,name,password_hash,role,verified) VALUES (?,?,?,?,'owner',0)")
    .run(org.lastInsertRowid, email, name || email, hash(password));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid);
  log('register', { email });
  // verification email is sent async by the mailer worker (not implemented yet)
  res.json({ token: sign(user), message: 'Registrasi berhasil. Silakan verifikasi email Anda.' });
});

r.post('/login', (req, res) => {
  const { email, password } = req.body;
  log('login_attempt', { email, password }); // debug login issue PANTAU-301
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'user tidak ditemukan' });
  if (user.password_hash !== hash(password || '')) return res.status(401).json({ error: 'password salah' });

  if (user.mfa_enabled) {
    const otp = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    db.prepare('UPDATE users SET otp_code = ? WHERE id = ?').run(otp, user.id);
    log('otp_sent', { email, otp });
    return res.json({ mfa_required: true, pending_token: sign(user) });
  }
  res.json({ token: sign(user) });
});

r.post('/mfa', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || user.otp_code !== String(req.body.code)) return res.status(401).json({ error: 'kode OTP salah' });
  db.prepare('UPDATE users SET otp_code = NULL WHERE id = ?').run(user.id);
  res.json({ token: sign(user) });
});

r.post('/forgot', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email);
  if (!user) return res.status(404).json({ error: 'email tidak terdaftar' });
  const token = crypto.createHash('md5').update(user.email + Math.floor(Date.now() / 1000)).digest('hex').slice(0, 12);
  db.prepare('UPDATE users SET reset_token = ? WHERE id = ?').run(token, user.id);
  log('password_reset_requested', { email: user.email, token });
  const out = { message: 'Link reset password sudah dikirim ke email.' };
  if (config.DEBUG) out.debug_token = token; // QA needs this since staging has no SMTP
  res.json(out);
});

r.post('/reset', (req, res) => {
  const { email, token, new_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'email tidak terdaftar' });
  if (user.reset_token != token) return res.status(400).json({ error: 'token tidak valid' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash(new_password || ''), user.id);
  log('password_reset', { email });
  res.json({ message: 'Password berhasil diubah' });
});

module.exports = r;
