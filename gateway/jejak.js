const koneksi = require('../db/koneksi');

const sisipkan = koneksi.prepare(
  `INSERT INTO jejak_audit (waktu, subjek, metode, endpoint, perangkat, keputusan, alasan)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

function catat({ subjek, metode, endpoint, perangkat, keputusan, alasan }) {
  const waktu = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const siapa = subjek || 'anonim';
  sisipkan.run(waktu, siapa, metode, endpoint, perangkat || null, keputusan, alasan);
  console.log(
    `[AUDIT] ${waktu} | ${siapa} | ${metode} ${endpoint} | ${perangkat || '-'} | ${keputusan.toUpperCase()} | ${alasan}`
  );
}

module.exports = { catat };