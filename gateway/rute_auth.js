const express = require('express');
const bcrypt = require('bcryptjs');
const koneksi = require('../db/koneksi');
const k = require('./konfigurasi');
const jejak = require('./jejak');
const tkn = require('./token');

const rute = express.Router();

const cariPengguna   = koneksi.prepare('SELECT * FROM pengguna WHERE nama_pengguna = ?');
const cariPenggunaId = koneksi.prepare('SELECT * FROM pengguna WHERE id = ?');
const cekPerangkat   = koneksi.prepare(
  'SELECT 1 FROM perangkat WHERE pengguna_id = ? AND kode_perangkat = ?'
);
const simpanRefresh  = koneksi.prepare(
  'INSERT INTO sesi_refresh (pengguna_id, token_hash, kedaluwarsa) VALUES (?, ?, ?)'
);
const cariRefresh    = koneksi.prepare('SELECT * FROM sesi_refresh WHERE token_hash = ?');
const cabutRefresh   = koneksi.prepare('UPDATE sesi_refresh SET dicabut = 1 WHERE id = ?');
const cariKlien      = koneksi.prepare('SELECT * FROM klien_layanan WHERE client_id = ?');

const sekarangDetik = () => Math.floor(Date.now() / 1000);

// ---------- POST /auth/login ----------
rute.post('/login', (req, res) => {
  const { nama_pengguna, kata_sandi } = req.body || {};
  const perangkat = req.header('X-Device-ID');
  const catat = (keputusan, alasan) =>
    jejak.catat({ subjek: nama_pengguna, metode: 'POST', endpoint: '/auth/login', perangkat, keputusan, alasan });

  if (!nama_pengguna || !kata_sandi) {
    catat('deny', 'nama_pengguna atau kata_sandi tidak dikirim');
    return res.status(400).json({ pesan: 'Data login tidak lengkap' });
  }

  const pengguna = cariPengguna.get(nama_pengguna);
  // Pesan ke client sengaja sama untuk "user tidak ada" dan "sandi salah"
  if (!pengguna || !bcrypt.compareSync(kata_sandi, pengguna.kata_sandi_hash)) {
    catat('deny', 'kredensial tidak valid');
    return res.status(401).json({ pesan: 'Kredensial tidak valid' });
  }

  if (!perangkat || !cekPerangkat.get(pengguna.id, perangkat)) {
    catat('deny', 'perangkat tidak terdaftar untuk pengguna ini');
    return res.status(403).json({ pesan: 'Perangkat tidak terdaftar' });
  }

  const tokenAkses = tkn.buatTokenAkses(pengguna);
  const refresh = tkn.buatRefresh();
  simpanRefresh.run(pengguna.id, tkn.hashRefresh(refresh), sekarangDetik() + k.umurRefreshDetik);

  catat('allow', 'login berhasil');
  res.json({ access_token: tokenAkses, refresh_token: refresh, berlaku_akses: '10 menit' });
});

// ---------- POST /auth/refresh ----------
rute.post('/refresh', (req, res) => {
  const { refresh_token } = req.body || {};
  const perangkat = req.header('X-Device-ID');
  const catat = (subjek, keputusan, alasan) =>
    jejak.catat({ subjek, metode: 'POST', endpoint: '/auth/refresh', perangkat, keputusan, alasan });

  const baris = refresh_token ? cariRefresh.get(tkn.hashRefresh(refresh_token)) : null;
  if (!baris) {
    catat('anonim', 'deny', 'refresh token tidak dikenal');
    return res.status(401).json({ pesan: 'Refresh token tidak valid' });
  }
  const pengguna = cariPenggunaId.get(baris.pengguna_id);
  if (baris.dicabut) {
    catat(pengguna.nama_pengguna, 'deny', 'refresh token sudah dicabut');
    return res.status(401).json({ pesan: 'Refresh token sudah dicabut' });
  }
  if (baris.kedaluwarsa < sekarangDetik()) {
    catat(pengguna.nama_pengguna, 'deny', 'refresh token kedaluwarsa');
    return res.status(401).json({ pesan: 'Refresh token kedaluwarsa' });
  }

  catat(pengguna.nama_pengguna, 'allow', 'access token baru diterbitkan');
  res.json({ access_token: tkn.buatTokenAkses(pengguna), berlaku_akses: '10 menit' });
});

// ---------- POST /auth/logout ----------
rute.post('/logout', (req, res) => {
  const { refresh_token } = req.body || {};
  const perangkat = req.header('X-Device-ID');
  const catat = (subjek, keputusan, alasan) =>
    jejak.catat({ subjek, metode: 'POST', endpoint: '/auth/logout', perangkat, keputusan, alasan });

  const baris = refresh_token ? cariRefresh.get(tkn.hashRefresh(refresh_token)) : null;
  if (!baris || baris.dicabut || baris.kedaluwarsa < sekarangDetik()) {
    catat('anonim', 'deny', 'refresh token tidak valid / sudah dicabut');
    return res.status(401).json({ pesan: 'Refresh token tidak valid' });
  }

  cabutRefresh.run(baris.id);
  catat(cariPenggunaId.get(baris.pengguna_id).nama_pengguna, 'allow', 'refresh token dicabut (logout)');
  res.json({ pesan: 'Logout berhasil' });
});

// ---------- POST /auth/service ----------
rute.post('/service', (req, res) => {
  const { client_id, client_secret } = req.body || {};
  const catat = (keputusan, alasan) =>
    jejak.catat({ subjek: client_id, metode: 'POST', endpoint: '/auth/service', keputusan, alasan });

  const klien = client_id ? cariKlien.get(client_id) : null;
  if (!klien || !client_secret || !bcrypt.compareSync(client_secret, klien.secret_hash)) {
    catat('deny', 'client_id / client_secret tidak valid');
    return res.status(401).json({ pesan: 'Kredensial layanan tidak valid' });
  }

  catat('allow', 'token layanan diterbitkan');
  res.json({ access_token: tkn.buatTokenLayanan(klien.client_id), berlaku_akses: '5 menit' });
});

module.exports = rute;