const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : fs.readFileSync(examplePath, 'utf8');
if (!/JWT_SECRET="?[^"\r\n]{32,}"?/.test(env) || env.includes('replace-with-a-random-secret')) {
  env = env.replace(/JWT_SECRET=.*$/m, `JWT_SECRET="${crypto.randomBytes(48).toString('hex')}"`);
}
if (env.includes('replace-with-64-hex-characters') || !/CHAT_ENCRYPTION_KEY="?[a-f0-9]{64}"?/i.test(env)) {
  env = env.replace(/CHAT_ENCRYPTION_KEY=.*$/m, `CHAT_ENCRYPTION_KEY="${crypto.randomBytes(32).toString('hex')}"`);
}
if (!/^DATABASE_URL=/m.test(env)) env += '\nDATABASE_URL="file:./dev.db"\n';
if (!/^PORT=/m.test(env)) env += '\nPORT=5000\n';
fs.writeFileSync(envPath, env, { mode: 0o600 });
console.log('Local .env file is ready. Encryption key generated and saved.');
