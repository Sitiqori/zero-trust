const tkn = require('./token');
const jejak = require('./jejak');
const kebijakan = require('./kebijakan');

function pelindung(req, res, next) {
  const metode = req.method;
  const jalur = req.path;
  const perangkat = req.header('X-Device-ID');

  const catat = (subjek, keputusan, alasan) =>
    jejak.catat({ subjek, metode, endpoint: jalur, perangkat, keputusan, alasan });

  // 1. Wajib membawa access token
  const [skema, token] = (req.header('Authorization') || '').split(' ');
  if (skema !== 'Bearer' || !token) {
    catat('anonim', 'deny', 'access token tidak ada');
    return res.status(401).json({ pesan: 'Ditolak: access token tidak ada' });
  }

  // 2. Verifikasi tanda tangan dan masa berlaku token
  let identitas;
  try {
    identitas = tkn.periksa(token);
  } catch (err) {
    const alasan = err.name === 'TokenExpiredError'
      ? 'access token kedaluwarsa'
      : 'access token tidak valid';
    catat('anonim', 'deny', alasan);
    return res.status(401).json({ pesan: `Ditolak: ${alasan}` });
  }

  // 3. Minta keputusan ke Policy Engine
  const subjek = identitas.role === 'service'
    ? `service:${identitas.sub}`
    : (identitas.nama || identitas.sub);

  const keputusan = kebijakan.putuskan({
    identitas, metode, jalur, query: req.query, perangkat,
  });

  // 4. Catat ke audit log (allow maupun deny)
  catat(subjek, keputusan.izin ? 'allow' : 'deny', keputusan.alasan);

  if (!keputusan.izin) {
    return res.status(keputusan.kode).json({ pesan: `Ditolak oleh Policy Engine: ${keputusan.alasan}` });
  }
  next(); // lanjut ke proxy
}

module.exports = pelindung;