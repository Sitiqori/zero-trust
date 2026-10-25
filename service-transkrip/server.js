require('dotenv').config({ quiet: true });
const express = require('express');
const koneksi = require('../db/koneksi');
const { penjaga, hanyaPeran } = require('../umum/penjaga');

const app = express();
app.use(express.json());
app.use(penjaga); // gateway secret + token wajib

const port = Number(process.env.TRANSKRIP_PORT || 3002);

// ---------- GET /transkrip/:nim ----------
app.get('/transkrip/:nim', hanyaPeran('mahasiswa', 'admin'), (req, res) => {
  const { sub, role } = req.identitas;

  // Mahasiswa hanya boleh melihat NIM miliknya sendiri
  if (role === 'mahasiswa') {
    const aku = koneksi.prepare('SELECT nim FROM pengguna WHERE id = ?').get(Number(sub));
    if (!aku || aku.nim !== req.params.nim) {
      return res.status(403).json({ pesan: 'Ditolak: hanya boleh melihat transkrip sendiri' });
    }
  }

  const mhs = koneksi.prepare(
    "SELECT id, nama_lengkap, nim FROM pengguna WHERE nim = ? AND peran = 'mahasiswa'"
  ).get(req.params.nim);
  if (!mhs) return res.status(404).json({ pesan: 'NIM tidak ditemukan' });

  const matkul = koneksi.prepare(
    `SELECT k.kode_mk, k.nama_mk, t.skor, t.disinkron_pada
       FROM transkrip_akhir t JOIN kelas_kuliah k ON k.id = t.kelas_id
      WHERE t.mahasiswa_id = ?`
  ).all(mhs.id);

  res.json({ mahasiswa: { nama: mhs.nama_lengkap, nim: mhs.nim }, mata_kuliah: matkul });
});

// ---------- POST /transkrip/sinkron ----------
// Hanya token layanan. Token user (admin sekalipun) ditolak oleh hanyaPeran('service').
app.post('/transkrip/sinkron', hanyaPeran('service'), (req, res) => {
  const { kelas_id, nilai } = req.body || {};
  if (!Number.isInteger(kelas_id) || !Array.isArray(nilai) || nilai.length === 0) {
    return res.status(400).json({ pesan: 'Format salah: butuh kelas_id (angka) dan nilai (array)' });
  }
  if (!koneksi.prepare('SELECT 1 FROM kelas_kuliah WHERE id = ?').get(kelas_id)) {
    return res.status(404).json({ pesan: 'Kelas tidak ditemukan' });
  }

  const simpan = koneksi.prepare(
    `INSERT INTO transkrip_akhir (mahasiswa_id, kelas_id, skor, disinkron_pada)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (mahasiswa_id, kelas_id)
     DO UPDATE SET skor = excluded.skor, disinkron_pada = excluded.disinkron_pada`
  );
  const waktu = new Date().toISOString();

  koneksi.transaction(() => {
    for (const n of nilai) simpan.run(n.mahasiswa_id, kelas_id, n.skor, waktu);
  })();

  res.json({ pesan: 'Transkrip tersinkron', jumlah: nilai.length });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Service Transkrip berjalan di http://127.0.0.1:${port}`);
});