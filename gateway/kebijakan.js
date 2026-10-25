const koneksi = require('../db/koneksi');
const k = require('./konfigurasi');

// Atribut yang dibaca dari database
const perangkatTerdaftar = koneksi.prepare(
  'SELECT 1 FROM perangkat WHERE pengguna_id = ? AND kode_perangkat = ?'
);
const ambilPengguna = koneksi.prepare('SELECT id, nim FROM pengguna WHERE id = ?');
const ambilKelas = koneksi.prepare('SELECT id, dosen_id FROM kelas_kuliah WHERE id = ?');
const ambilNilai = koneksi.prepare(
  `SELECT n.id, n.status, kl.dosen_id
     FROM penilaian n JOIN kelas_kuliah kl ON kl.id = n.kelas_id
    WHERE n.id = ?`
);

const izinkan = (alasan) => ({ izin: true, kode: 200, alasan });
const tolak = (kode, alasan) => ({ izin: false, kode, alasan });

// Verifikasi konteks: jam akses (rentang diatur lewat .env)
function dalamJamAkses() {
  const jam = new Date().getHours();
  return jam >= k.jamBuka && jam < k.jamTutup;
}
const teksJam = () => `${k.jamBuka}.00-${k.jamTutup}.00`;

// Fungsi utama: mengembalikan { izin, kode, alasan }
function putuskan({ identitas, metode, jalur, query, perangkat }) {
  const peran = identitas.role;
  const idUser = Number(identitas.sub);

  // ---- Verifikasi konteks: perangkat terdaftar (khusus request dari user) ----
  if (peran !== 'service') {
    if (!perangkat) return tolak(403, 'header X-Device-ID tidak dikirim');
    if (!perangkatTerdaftar.get(idUser, perangkat)) {
      return tolak(403, 'perangkat tidak terdaftar untuk pengguna ini');
    }
  }

  const path = jalur.length > 1 ? jalur.replace(/\/+$/, '') : jalur;
  let m;

  // ---- GET /nilai ----
  if (metode === 'GET' && path === '/nilai') {
    if (peran !== 'mahasiswa' && peran !== 'dosen') {
      return tolak(403, `peran ${peran} tidak boleh melihat nilai`);
    }
    if (peran === 'dosen' && query.kelas_id) {
      const kelas = ambilKelas.get(Number(query.kelas_id));
      if (!kelas || kelas.dosen_id !== idUser) {
        return tolak(403, 'kelas yang diminta bukan kelas yang diampu dosen ini');
      }
    }
    return izinkan(peran === 'mahasiswa'
      ? 'mahasiswa melihat nilai miliknya'
      : 'dosen melihat nilai kelas yang diampu');
  }

  // ---- PUT /nilai/:id ----
  if (metode === 'PUT' && (m = path.match(/^\/nilai\/(\d+)$/))) {
    if (peran !== 'dosen') return tolak(403, `peran ${peran} tidak boleh mengubah nilai`);
    if (!dalamJamAkses()) return tolak(403, `di luar jam akses (${teksJam()})`);

    const nilai = ambilNilai.get(Number(m[1]));
    if (!nilai) return tolak(404, 'data nilai tidak ditemukan');
    if (nilai.dosen_id !== idUser) return tolak(403, 'nilai ini bukan di kelas yang diampu dosen ini');
    if (nilai.status === 'final') return tolak(409, 'nilai sudah final, tidak boleh diubah');
    return izinkan('dosen mengubah nilai draft di kelas yang diampu');
  }

  // ---- POST /kelas/:id/finalisasi ----
  if (metode === 'POST' && (m = path.match(/^\/kelas\/(\d+)\/finalisasi$/))) {
    if (peran !== 'dosen') return tolak(403, `peran ${peran} tidak boleh memfinalisasi nilai`);
    if (!dalamJamAkses()) return tolak(403, `di luar jam akses (${teksJam()})`);

    const kelas = ambilKelas.get(Number(m[1]));
    if (!kelas) return tolak(404, 'kelas tidak ditemukan');
    if (kelas.dosen_id !== idUser) return tolak(403, 'kelas ini bukan yang diampu dosen ini');
    return izinkan('dosen memfinalisasi kelas yang diampu');
  }

  // ---- GET /transkrip/:nim ----
  if (metode === 'GET' && (m = path.match(/^\/transkrip\/(\d+)$/))) {
    if (peran === 'admin') return izinkan('admin melihat transkrip seluruh mahasiswa');
    if (peran === 'mahasiswa') {
      const aku = ambilPengguna.get(idUser);
      if (aku && aku.nim === m[1]) return izinkan('mahasiswa melihat transkrip miliknya');
      return tolak(403, 'mahasiswa hanya boleh melihat transkrip dengan NIM sendiri');
    }
    return tolak(403, `peran ${peran} tidak boleh melihat transkrip`);
  }

  // ---- POST /transkrip/sinkron ----
  if (metode === 'POST' && path === '/transkrip/sinkron') {
    if (peran === 'service') return izinkan('Service Nilai menyinkronkan transkrip');
    return tolak(403, `token ${peran} ditolak: hanya token layanan yang boleh sinkron`);
  }

  // ---- Selain yang didefinisikan di atas: tolak (deny by default) ----
  return tolak(403, `tidak ada kebijakan yang mengizinkan ${metode} ${path}`);
}

module.exports = { putuskan };