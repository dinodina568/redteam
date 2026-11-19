const fs = require('fs');
const path = require('path');
const LOG_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const file = path.join(LOG_DIR, 'app.log');

function log(event, data = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...data });
  fs.appendFileSync(file, line + '\n');
  if (process.env.NODE_ENV !== 'test') console.log(line);
}
module.exports = { log };
