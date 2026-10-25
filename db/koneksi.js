require('dotenv').config();
const path = require('path');
const BetterSqlite = require('better-sqlite3');

const lokasi = path.resolve(process.env.DB_PATH || './db/akademik.db');
const koneksi = new BetterSqlite(lokasi);
koneksi.pragma('journal_mode = WAL'); 

module.exports = koneksi;