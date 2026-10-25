const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const k = require('./konfigurasi');

// Access token user: berisi sub (id user) dan role
function buatTokenAkses(pengguna) {
  return jwt.sign(
    { sub: String(pengguna.id), role: pengguna.peran, nama: pengguna.nama_pengguna },
    k.rahasiaJwt,
    { algorithm: 'HS256', expiresIn: k.umurTokenAkses }
  );
}

// Token layanan: role khusus "service"
function buatTokenLayanan(clientId) {
  return jwt.sign(
    { sub: clientId, role: 'service' },
    k.rahasiaJwt,
    { algorithm: 'HS256', expiresIn: k.umurTokenLayanan }
  );
}

// Cek tanda tangan + masa berlaku. Lempar error kalau tidak valid.
function periksa(token) {
  return jwt.verify(token, k.rahasiaJwt, { algorithms: ['HS256'] });
}

// Refresh token = string acak. Di DB hanya disimpan hash-nya.
function buatRefresh() {
  return crypto.randomBytes(48).toString('hex');
}
function hashRefresh(teks) {
  return crypto.createHash('sha256').update(teks).digest('hex');
}

module.exports = { buatTokenAkses, buatTokenLayanan, periksa, buatRefresh, hashRefresh };