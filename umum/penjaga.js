require('dotenv').config({ quiet: true });
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Bandingkan dua teks dengan aman (tidak bocor lewat waktu respons)
function samaAman(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Pemeriksaan 1 + 2: gateway secret, lalu token
function penjaga(req, res, next) {
  if (!samaAman(req.header('X-Gateway-Secret'), process.env.GATEWAY_SECRET)) {
    return res.status(403).json({ pesan: 'Ditolak: gateway secret tidak valid (akses langsung ke layanan)' });
  }

  const [skema, token] = (req.header('Authorization') || '').split(' ');
  if (skema !== 'Bearer' || !token) {
    return res.status(401).json({ pesan: 'Ditolak: access token tidak ada' });
  }

  try {
    req.identitas = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    return res.status(401).json({ pesan: 'Ditolak: token tidak valid atau kedaluwarsa' });
  }
}

// Pembatas peran di tingkat endpoint (lapis kedua setelah Policy Engine)
function hanyaPeran(...diizinkan) {
  return (req, res, next) => {
    if (!diizinkan.includes(req.identitas.role)) {
      return res.status(403).json({ pesan: `Ditolak: peran '${req.identitas.role}' tidak boleh mengakses endpoint ini` });
    }
    next();
  };
}

module.exports = { penjaga, hanyaPeran };