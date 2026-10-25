require('dotenv').config({ quiet: true });

module.exports = {
  portGateway:    Number(process.env.GATEWAY_PORT || 3000),
  portNilai:      Number(process.env.NILAI_PORT || 3001),
  portTranskrip:  Number(process.env.TRANSKRIP_PORT || 3002),

  rahasiaJwt:     process.env.JWT_SECRET,
  rahasiaGateway: process.env.GATEWAY_SECRET,

  jamBuka:  Number(process.env.JAM_BUKA ?? 7),
  jamTutup: Number(process.env.JAM_TUTUP ?? 21),

  umurTokenAkses:   '10m',
  umurTokenLayanan: '5m',
  umurRefreshDetik: 24 * 60 * 60,   // 1 hari
};