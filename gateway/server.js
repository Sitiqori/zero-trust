const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const k = require('./konfigurasi');
const ruteAuth = require('./rute_auth');
const pelindung = require('./pelindung');

const app = express();
app.disable('x-powered-by');

// /auth/* ditangani gateway sendiri (body JSON hanya dibaca di sini)
app.use('/auth', express.json(), ruteAuth);

// Semua request lain wajib lolos PEP + Policy Engine dulu
app.use(pelindung);

// Pembuat proxy: menambahkan X-Gateway-Secret saat meneruskan request
function buatProxy(port) {
  return createProxyMiddleware({
    target: `http://127.0.0.1:${port}`,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('X-Gateway-Secret', k.rahasiaGateway);
      },
      error: (err, req, res) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ pesan: 'Layanan tujuan tidak dapat dihubungi' }));
      },
    },
  });
}
const proxyNilai = buatProxy(k.portNilai);
const proxyTranskrip = buatProxy(k.portTranskrip);

// Tentukan tujuan berdasarkan path
app.use((req, res, next) => {
  if (req.path === '/nilai' || req.path.startsWith('/nilai/') || req.path.startsWith('/kelas/')) {
    return proxyNilai(req, res, next);
  }
  if (req.path.startsWith('/transkrip/')) {
    return proxyTranskrip(req, res, next);
  }
  res.status(404).json({ pesan: 'Endpoint tidak ditemukan' });
});

app.listen(k.portGateway, () => {
  console.log(`Gateway berjalan di http://localhost:${k.portGateway}`);
});