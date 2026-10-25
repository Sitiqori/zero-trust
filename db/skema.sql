DROP TABLE IF EXISTS jejak_audit;
DROP TABLE IF EXISTS sesi_refresh;
DROP TABLE IF EXISTS klien_layanan;
DROP TABLE IF EXISTS transkrip_akhir;
DROP TABLE IF EXISTS penilaian;
DROP TABLE IF EXISTS kelas_kuliah;
DROP TABLE IF EXISTS perangkat;
DROP TABLE IF EXISTS pengguna;

CREATE TABLE pengguna (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_pengguna    TEXT NOT NULL UNIQUE,
  kata_sandi_hash  TEXT NOT NULL,
  nama_lengkap     TEXT NOT NULL,
  peran            TEXT NOT NULL CHECK (peran IN ('mahasiswa','dosen','admin')),
  nim              TEXT UNIQUE            -- hanya untuk mahasiswa
);

CREATE TABLE perangkat (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pengguna_id    INTEGER NOT NULL REFERENCES pengguna(id),
  kode_perangkat TEXT NOT NULL
);

CREATE TABLE kelas_kuliah (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  kode_mk   TEXT NOT NULL,
  nama_mk   TEXT NOT NULL,
  dosen_id  INTEGER NOT NULL REFERENCES pengguna(id)   -- dosen pengampu
);

CREATE TABLE penilaian (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kelas_id      INTEGER NOT NULL REFERENCES kelas_kuliah(id),
  mahasiswa_id  INTEGER NOT NULL REFERENCES pengguna(id),
  skor          REAL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final'))
);

CREATE TABLE transkrip_akhir (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  mahasiswa_id   INTEGER NOT NULL REFERENCES pengguna(id),
  kelas_id       INTEGER NOT NULL REFERENCES kelas_kuliah(id),
  skor           REAL NOT NULL,
  disinkron_pada TEXT NOT NULL,
  UNIQUE (mahasiswa_id, kelas_id)
);

CREATE TABLE sesi_refresh (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pengguna_id  INTEGER NOT NULL REFERENCES pengguna(id),
  token_hash   TEXT NOT NULL,
  kedaluwarsa  INTEGER NOT NULL,          -- epoch detik
  dicabut      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE klien_layanan (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    TEXT NOT NULL UNIQUE,
  secret_hash  TEXT NOT NULL
);

CREATE TABLE jejak_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu      TEXT NOT NULL,
  subjek     TEXT NOT NULL,
  metode     TEXT,
  endpoint   TEXT NOT NULL,
  perangkat  TEXT,
  keputusan  TEXT NOT NULL CHECK (keputusan IN ('allow','deny')),
  alasan     TEXT NOT NULL
);