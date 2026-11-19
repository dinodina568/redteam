// Central configuration.
// NOTE(dev): defaults are here so the app "just works" locally. Override via env in prod.
const fs = require('fs');
const path = require('path');

// tiny .env loader (avoid adding dotenv dependency)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

module.exports = {
  ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '127.0.0.1',
  JWT_SECRET: process.env.JWT_SECRET || 'secret123',
  DEBUG: (process.env.DEBUG || 'true') === 'true',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || 'Pantau#Mail2024',
  PAYMENT_GATEWAY_KEY: process.env.PAYMENT_GATEWAY_KEY || 'pg_test_DEMO_ONLY_9f8e7d6c5b4a',
  INTERNAL_AGENT_PORT: parseInt(process.env.INTERNAL_AGENT_PORT || '9100', 10),
  INTERNAL_AGENT_TOKEN: process.env.INTERNAL_AGENT_TOKEN || 'agent-token-dev-001',
  PLANS: {
    free: { name: 'Free', price: 0, monitor_limit: 3 },
    pro: { name: 'Pro', price: 150000, monitor_limit: 20 },
    enterprise: { name: 'Enterprise', price: 1000000, monitor_limit: 1000 },
  },
};
