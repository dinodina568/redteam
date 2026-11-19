const express = require('express');
const path = require('path');
const config = require('./config');
require('./db');
const { requireAuth } = require('./auth');
const { log } = require('./logger');
const { admin, debug } = require('./routes/admin');
const { startAgent } = require('./agent');

const app = express();
app.use(express.json());

// CORS for the mobile app & partner dashboards
app.use((req, res, next) => {
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/logs', express.static(path.join(__dirname, '..', 'logs'))); // ops wants quick access to logs

app.use('/api/auth', require('./routes/auth'));
app.use('/api/v1', require('./routes/v1'));
app.use('/api/debug', debug);
app.use('/api/users', requireAuth, require('./routes/users'));
app.use('/api/orgs', requireAuth, require('./routes/orgs'));
app.use('/api/monitors', requireAuth, require('./routes/monitors'));
app.use('/api/incidents', requireAuth, require('./routes/incidents'));
app.use('/api/billing', requireAuth, require('./routes/billing'));
app.use('/api/apikeys', requireAuth, require('./routes/apikeys'));
app.use('/api/admin', requireAuth, admin);

app.use((err, req, res, next) => {
  log('error', { path: req.path, message: err.message });
  res.status(500).json({ error: err.message, stack: err.stack, body: req.body });
});

if (require.main === module) {
  app.listen(config.PORT, config.HOST, () => console.log(`PantauApp [${config.ENV}] listening on http://${config.HOST}:${config.PORT}`));
  startAgent();
}
module.exports = app;
