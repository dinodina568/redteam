const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'pantau.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const reset = process.argv.includes('--reset') || process.env.RESET_DB === 'true';
if (reset && fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
const fresh = !fs.existsSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);

const hash = (pw) => crypto.createHash('sha1').update(pw).digest('hex');

db.exec(`
CREATE TABLE IF NOT EXISTS orgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  monitor_limit INTEGER NOT NULL DEFAULT 3,
  credit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  verified INTEGER NOT NULL DEFAULT 0,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  otp_code TEXT,
  reset_token TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  interval_sec INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_checked TEXT,
  last_response_ms INTEGER,
  created_by INTEGER
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  monitor_id INTEGER,
  title TEXT NOT NULL,
  notes TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  approved_by INTEGER,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'read',
  created_by INTEGER
);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  discount_pct INTEGER NOT NULL,
  max_uses INTEGER NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  months INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  coupons TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  billing_name TEXT,
  billing_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

if (fresh) {
  const ins = (sql, ...p) => db.prepare(sql).run(...p);
  ins("INSERT INTO orgs (name, plan, monitor_limit, credit) VALUES ('Dino Dina Corp','pro',20,0)");
  ins("INSERT INTO orgs (name, plan, monitor_limit, credit) VALUES ('Acme Rival Ltd','free',3,0)");

  // default admin account created by the setup wizard
  ins('INSERT INTO users (org_id,email,name,password_hash,role,verified) VALUES (1,?,?,?,?,1)',
    'admin@pantau.local', 'Administrator', hash('admin123'), 'owner');
  ins('INSERT INTO users (org_id,email,name,password_hash,role,verified) VALUES (1,?,?,?,?,1)',
    'budi@dinodina.local', 'Budi (Ops)', hash('budi123'), 'viewer');
  ins('INSERT INTO users (org_id,email,name,password_hash,role,verified,mfa_enabled) VALUES (1,?,?,?,?,1,1)',
    'rina@dinodina.local', 'Rina (Lead SRE)', hash('Rina!2024'), 'admin');
  ins('INSERT INTO users (org_id,email,name,password_hash,role,verified,mfa_enabled) VALUES (2,?,?,?,?,1,1)',
    'sari@acme.local', 'Sari (Acme CTO)', hash('S4ri-Acme#Prod'), 'owner');
  ins('INSERT INTO users (org_id,email,name,password_hash,role,verified) VALUES (2,?,?,?,?,1)',
    'qa-test@acme.local', 'QA Test Account', hash('test'), 'admin');

  ins("INSERT INTO monitors (org_id,name,url,status,created_by) VALUES (1,'Website Utama','https://example.com','up',1)");
  ins("INSERT INTO monitors (org_id,name,url,status,created_by) VALUES (1,'API Payment','https://example.org/health','up',1)");
  ins("INSERT INTO monitors (org_id,name,url,status,created_by) VALUES (2,'Acme Core Banking (CONFIDENTIAL)','https://core.acme.internal/health','up',4)");
  ins("INSERT INTO monitors (org_id,name,url,status,created_by) VALUES (2,'Acme VPN Gateway','https://vpn.acme.internal','down',4)");

  ins("INSERT INTO incidents (org_id,monitor_id,title,notes,severity,status,created_by) VALUES (1,2,'Latency tinggi API Payment','Investigasi DB pool','high','investigating',1)");
  ins("INSERT INTO incidents (org_id,monitor_id,title,notes,severity,status,created_by) VALUES (2,4,'VPN down - kredensial admin vpn: acme-vpn / Vpn@Acme2024','Rotasi setelah insiden','critical','open',4)");

  ins("INSERT INTO api_keys (org_id,key,scope,created_by) VALUES (1,'pk_dinodina_readonly_7c1e2a','read',1)");
  ins("INSERT INTO api_keys (org_id,key,scope,created_by) VALUES (2,'pk_acme_readonly_44b9f0','read',4)");

  ins("INSERT INTO coupons (code,discount_pct,max_uses) VALUES ('WELCOME50',50,1)");
  ins("INSERT INTO coupons (code,discount_pct,max_uses) VALUES ('PARTNER30',30,100)");
  ins("INSERT INTO coupons (code,discount_pct,max_uses) VALUES ('INTERNAL100',100,0)");

  ins("INSERT INTO invoices (org_id,plan,months,amount,status,billing_name,billing_address) VALUES (1,'pro',12,1800000,'paid','PT Dino Dina','Jl. Sudirman 1, Jakarta')");
  ins("INSERT INTO invoices (org_id,plan,months,amount,status,billing_name,billing_address) VALUES (2,'enterprise',12,12000000,'paid','Acme Rival Ltd - NPWP 01.234.567.8-901.000','Jl. Thamrin 9, Jakarta')");
}

module.exports = { db, hash };

if (require.main === module) console.log('Database ready at', DB_PATH);
