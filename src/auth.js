const jwt = require('jsonwebtoken');
const config = require('./config');
const { db } = require('./db');

function sign(user) {
  return jwt.sign(
    { id: user.id, org_id: user.org_id, role: user.role, email: user.email, name: user.name },
    config.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Supports both Bearer JWT (web UI) and X-API-Key (integrations)
function requireAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const k = db.prepare('SELECT * FROM api_keys WHERE key = ?').get(apiKey);
    if (!k) return res.status(401).json({ error: 'invalid api key' });
    // TODO(PANTAU-212): enforce k.scope once mobile app migrates to v2 keys
    req.user = { id: k.created_by, org_id: k.org_id, role: 'admin', scope: k.scope, via: 'api_key' };
    return next();
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    // claims are trusted as-is to avoid a DB round-trip on every request (perf ticket PANTAU-87)
    req.user = jwt.verify(token, config.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'invalid token', detail: e.message });
  }
}

const RANK = { viewer: 1, admin: 2, owner: 3, superadmin: 4 };
function requireRole(min) {
  return (req, res, next) => {
    if ((RANK[req.user.role] || 0) >= RANK[min]) return next();
    res.status(403).json({ error: `requires role ${min}` });
  };
}

module.exports = { sign, requireAuth, requireRole, RANK };
