require('dotenv').config({ quiet: true });
const express = require('express');
const koneksi = require('../db/koneksi');
const { penjaga, hanyaPeran } = require('../umum/penjaga');

const app = express();
app.use(express.json());
app.use(penjaga); // semua endpoint wajib lolos gateway secret + token

const port = Number(process.env.NILAI_PORT || 3001);
const urlGateway = process.env.GATEWAY_URL || 'http://localhost:3000';

// ---------- GET /nilai ----------
// Mahasiswa: nilai miliknya. Dosen: nilai di kelas yang diampu.
app.get('/nilai', hanyaPeran('mahasiswa', 'dosen'), (req, res) => {
  const { sub, role } = req.identitas;
  let baris;

  if (role === 'mahasiswa') {
    baris = koneksi.prepare(
      `SELECT n.id, k.kode_mk, k.nama_mk, n.skor, n.status
         FROM penilaian n JOIN kelas_kuliah k ON k.id = n.kelas_id
        WHERE n.mahasiswa_id = ?`
    ).all(Number(sub));
  } else {
    const kelasId = req.query.kelas_id ? Number(req.query.kelas_id) : null;
    baris = koneksi.prepare(
      `SELECT n.id, n.kelas_id, k.kode_mk, p.nama_lengkap AS mahasiswa, p.nim, n.skor, n.status
         FROM penilaian n
         JOIN kelas_kuliah k ON k.id = n.kelas_id
         JOIN pengguna p ON p.id = n.mahasiswa_id
        WHERE k.dosen_id = ? AND (? IS NULL OR n.kelas_id = ?)`
    ).all(Number(sub), kelasId, kelasId);
  }

  res.json({ jumlah: baris.length, data: baris });
});

// ---------- PUT /nilai/:id ----------
app.put('/nilai/:id', hanyaPeran('dosen'), (req, res) => {
  const skor = req.body && req.body.skor;
  if (typeof skor !== 'number' || skor < 0 || skor > 100) {
    return res.status(400).json({ pesan: 'skor harus berupa angka 0 sampai 100' });
  }

  // Syarat (draft + kelas milik dosen ini) ikut dicek lagi di SQL
  const hasil = koneksi.prepare(
    `UPDATE penilaian SET skor = ?
      WHERE id = ? AND status = 'draft'
        AND kelas_id IN (SELECT id FROM kelas_kuliah WHERE dosen_id = ?)`
  ).run(skor, Number(req.params.id), Number(req.identitas.sub));

  if (hasil.changes === 0) {
    return res.status(409).json({ pesan: 'Tidak bisa diubah: nilai tidak ditemukan, sudah final, atau bukan kelas Anda' });
  }
  res.json({ pesan: 'Nilai diperbarui', id: Number(req.params.id), skor });
});

// ---------- Ambil token layanan dari gateway ----------
async function ambilTokenLayanan() {
  const resp = await fetch(`${urlGateway}/auth/service`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SERVICE_CLIENT_ID,
      client_secret: process.env.SERVICE_CLIENT_SECRET,
    }),
  });
  if (!resp.ok) throw new Error(`gagal mengambil token layanan (${resp.status})`);
  return (await resp.json()).access_token;
}

// ---------- POST /kelas/:id/finalisasi ----------
app.post('/kelas/:id/finalisasi', hanyaPeran('dosen'), async (req, res) => {
  const kelasId = Number(req.params.id);
  const dosenId = Number(req.identitas.sub);

  const kelas = koneksi.prepare('SELECT id FROM kelas_kuliah WHERE id = ? AND dosen_id = ?').get(kelasId, dosenId);
  if (!kelas) return res.status(403).json({ pesan: 'Ditolak: bukan kelas yang Anda ampu' });

  const daftar = koneksi.prepare(
    `SELECT id, mahasiswa_id, skor FROM penilaian
      WHERE kelas_id = ? AND status = 'draft' AND skor IS NOT NULL`
  ).all(kelasId);
  if (daftar.length === 0) return res.status(409).json({ pesan: 'Tidak ada nilai draft untuk difinalisasi' });

  const jadikanFinal = koneksi.prepare("UPDATE penilaian SET status = 'final' WHERE id = ?");
  const kembalikan   = koneksi.prepare("UPDATE penilaian SET status = 'draft' WHERE id = ?");
  koneksi.transaction(() => daftar.forEach((d) => jadikanFinal.run(d.id)))();

  try {
    const tokenLayanan = await ambilTokenLayanan();
    // Panggilan antar-service WAJIB lewat gateway (bukan langsung ke port 3002)
    const resp = await fetch(`${urlGateway}/transkrip/sinkron`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLayanan}` },
      body: JSON.stringify({
        kelas_id: kelasId,
        nilai: daftar.map((d) => ({ mahasiswa_id: d.mahasiswa_id, skor: d.skor })),
      }),
    });
    if (!resp.ok) throw new Error(`gateway menolak sinkron (${resp.status})`);
    res.json({ pesan: 'Finalisasi berhasil, transkrip tersinkron', jumlah_nilai: daftar.length });
  } catch (err) {
    koneksi.transaction(() => daftar.forEach((d) => kembalikan.run(d.id)))();
    res.status(502).json({ pesan: 'Sinkron ke transkrip gagal, finalisasi dibatalkan', detail: err.message });
  }
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Service Nilai berjalan di http://127.0.0.1:${port}`);
});