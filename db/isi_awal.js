require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const koneksi = require('./koneksi');

// 1. Bangun tabel
koneksi.exec(fs.readFileSync(path.join(__dirname, 'skema.sql'), 'utf8'));

// 2. Data awal
const KATA_SANDI = 'Unsil#2026';
const hashSandi = bcrypt.hashSync(KATA_SANDI, 10);

const tambahPengguna = koneksi.prepare(
  `INSERT INTO pengguna (nama_pengguna, kata_sandi_hash, nama_lengkap, peran, nim)
   VALUES (?, ?, ?, ?, ?)`
);
const tambahPerangkat = koneksi.prepare(
  'INSERT INTO perangkat (pengguna_id, kode_perangkat) VALUES (?, ?)'
);

// [nama_pengguna, nama_lengkap, peran, nim, kode_perangkat]
const daftarPengguna = [
  ['admin_prodi', 'Hj. Rini Marlina',    'admin',     null,           'LAPTOP-ADM-01'],
  ['asep.r',      'Dr. Asep Ruhimat',    'dosen',     null,           'LAPTOP-ASEP-01'],
  ['nia.k',       'Dr. Nia Kurniasih',   'dosen',     null,           'LAPTOP-NIA-01'],
  ['dede.r',      'Dede Rahmat',         'mahasiswa', '247006111201', 'HP-DEDE-01'],
  ['neneng.s',    'Neneng Sari',         'mahasiswa', '247006111202', 'HP-NENENG-01'],
  ['yoga.p',      'Yoga Pratama',        'mahasiswa', '247006111203', 'HP-YOGA-01'],
];

const idPengguna = {};
for (const [nama, lengkap, peran, nim, perangkat] of daftarPengguna) {
  const hasil = tambahPengguna.run(nama, hashSandi, lengkap, peran, nim);
  idPengguna[nama] = hasil.lastInsertRowid;
  tambahPerangkat.run(hasil.lastInsertRowid, perangkat);
}

// 2 kelas, dosen pengampu berbeda
const tambahKelas = koneksi.prepare(
  'INSERT INTO kelas_kuliah (kode_mk, nama_mk, dosen_id) VALUES (?, ?, ?)'
);
const kelasJaringan = tambahKelas.run('IF-401', 'Keamanan Jaringan', idPengguna['asep.r']).lastInsertRowid;
const kelasRpl      = tambahKelas.run('IF-402', 'Rekayasa Perangkat Lunak', idPengguna['nia.k']).lastInsertRowid;

// Nilai awal (semua masih draft)
const tambahNilai = koneksi.prepare(
  'INSERT INTO penilaian (kelas_id, mahasiswa_id, skor, status) VALUES (?, ?, ?, ?)'
);
tambahNilai.run(kelasJaringan, idPengguna['dede.r'],   82, 'draft');
tambahNilai.run(kelasJaringan, idPengguna['neneng.s'], 90, 'draft');
tambahNilai.run(kelasJaringan, idPengguna['yoga.p'],   68, 'draft');
tambahNilai.run(kelasRpl,      idPengguna['dede.r'],   77, 'draft');
tambahNilai.run(kelasRpl,      idPengguna['neneng.s'], 85, 'draft');
tambahNilai.run(kelasRpl,      idPengguna['yoga.p'],   73, 'draft');

// Akun layanan untuk Service Nilai
const SECRET_LAYANAN = 'svc-penilaian-rahasia-8642';
koneksi.prepare('INSERT INTO klien_layanan (client_id, secret_hash) VALUES (?, ?)')
  .run('svc-penilaian', bcrypt.hashSync(SECRET_LAYANAN, 10));

console.log('Database akademik siap dipakai.');
console.log('Kata sandi semua pengguna:', KATA_SANDI);
console.log('Klien layanan:', 'svc-penilaian /', SECRET_LAYANAN);