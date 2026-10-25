const koneksi = require('./koneksi');

const baris = koneksi
  .prepare('SELECT waktu, subjek, metode, endpoint, perangkat, keputusan, alasan FROM jejak_audit ORDER BY id DESC LIMIT 20')
  .all();

console.table(baris);