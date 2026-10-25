# Sistem Nilai: Zero Trust Security

Tugas Praktikum Individu Keamanan Informasi, Informatika Universitas Siliwangi.
API gateway sebagai Policy Enforcement Point (NIST SP 800-207) di depan Service Nilai dan Service Transkrip.

## Arsitektur
Client → Gateway :3000 (PEP + Policy Engine + audit log) → Service Nilai :3001 / Service Transkrip :3002 → SQLite.
Panggilan Service Nilai ke Service Transkrip juga lewat gateway.

## Cara menjalankan
1. `npm install`
2. Salin `.env.example` menjadi `.env`, lalu isi `JWT_SECRET` dan `GATEWAY_SECRET`.
3. `npm run db:siap` (membuat database dan data awal)
4. Jalankan di 3 terminal terpisah:
   - `npm run gateway`
   - `npm run nilai`
   - `npm run transkrip`
5. Semua request dikirim ke `http://localhost:3000` (Postman / curl).
6. Lihat audit log: `npm run audit`

Jam akses ubah/finalisasi nilai diatur lewat `JAM_BUKA` dan `JAM_TUTUP` di `.env` (restart gateway setelah mengubah).

## Akun data awal
Kata sandi semua pengguna: `Unsil#2026`

| Nama pengguna | Peran | NIM | Device ID |
|---|---|---|---|
| admin_prodi | admin | - | LAPTOP-ADM-01 |
| asep.r | dosen (IF-401 Keamanan Jaringan) | - | LAPTOP-ASEP-01 |
| nia.k | dosen (IF-402 RPL) | - | LAPTOP-NIA-01 |
| dede.r | mahasiswa | 247006111201 | HP-DEDE-01 |
| neneng.s | mahasiswa | 247006111202 | HP-NENENG-01 |
| yoga.p | mahasiswa | 247006111203 | HP-YOGA-01 |

Klien layanan: `svc-penilaian` / `svc-penilaian-rahasia-8642`

## Endpoint
| Endpoint | Siapa | Kondisi |
|---|---|---|
| POST /auth/login | semua | kredensial valid + device terdaftar |
| POST /auth/refresh, /auth/logout | semua | refresh token valid, belum dicabut |
| POST /auth/service | Service Nilai | client ID + secret valid |
| GET /nilai | mahasiswa, dosen | mhs: miliknya; dosen: kelas yang diampu |
| PUT /nilai/:id | dosen | kelas diampu, belum final, jam akses |
| POST /kelas/:id/finalisasi | dosen | kelas diampu, jam akses, lalu sinkron transkrip |
| GET /transkrip/:nim | mahasiswa, admin | mhs: NIM sendiri; admin: semua |
| POST /transkrip/sinkron | token layanan saja | token user mana pun ditolak |

Header wajib untuk request user: `Authorization: Bearer <token>` dan `X-Device-ID`.