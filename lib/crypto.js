
const crypto = require('node:crypto');
function key() {
  const raw = process.env.CHAT_ENCRYPTION_KEY || '';
  const value = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (value.length !== 32) throw new Error('CHAT_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return value;
}
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}
function decrypt(record) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
module.exports = { encrypt, decrypt };
