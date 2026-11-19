// Internal metrics agent - only listens on loopback, not exposed outside the host/container.
const express = require('express');
const config = require('./config');
const { db } = require('./db');

function startAgent() {
  const app = express();
  app.get('/', (req, res) => res.json({ service: 'pantau-internal-agent', endpoints: ['/metrics', '/secrets', '/admin/reset-password?email='] }));
  app.get('/metrics', (req, res) => res.type('text/plain').send(
    `pantau_orgs ${db.prepare('SELECT COUNT(*) c FROM orgs').get().c}\npantau_users ${db.prepare('SELECT COUNT(*) c FROM users').get().c}\npantau_uptime ${process.uptime()}\n`));
  app.get('/secrets', (req, res) => res.json({
    agent_token: config.INTERNAL_AGENT_TOKEN, jwt_secret: config.JWT_SECRET,
    smtp_password: config.SMTP_PASSWORD, payment_gateway_key: config.PAYMENT_GATEWAY_KEY,
  }));
  app.get('/admin/reset-password', (req, res) => {
    const u = db.prepare('SELECT id FROM users WHERE email = ?').get(req.query.email);
    if (!u) return res.status(404).json({ error: 'not found' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(require('./db').hash('changeme'), u.id);
    res.json({ message: `password ${req.query.email} direset ke 'changeme'` });
  });
  app.listen(config.INTERNAL_AGENT_PORT, '127.0.0.1', () => console.log(`internal agent on 127.0.0.1:${config.INTERNAL_AGENT_PORT}`));
}
module.exports = { startAgent };
