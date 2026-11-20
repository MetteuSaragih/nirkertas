/**
 * Model perhitungan CO2e Nirkertas.
 * Konstanta, rumus, dan skenario di sini sama dengan yang dipakai pada Bab III dan Bab IV laporan.
 *
 * Sumber konstanta:
 *  - Faktor emisi kertas: UK DESNZ, Greenhouse gas reporting: conversion factors 2024,
 *    "Paper (primary material production)" = 1.339,31834 kg CO2e/ton (cradle-to-gate).
 *  - Intensitas karbon listrik Indonesia 2024: Ember (2026) via Our World in Data,
 *    680,25 g CO2e/kWh (basis siklus hidup).
 *  - Intensitas energi: Sustainable Web Design Model v4 (operasional + embodied).
 */

/* ---------- Konstanta ---------- */

export const PAPER = {
  a4AreaM2: 0.21 * 0.297, // 0,06237 m2
  gsm: 80, // HVS 80 g/m2
  get a4Grams() {
    return this.a4AreaM2 * this.gsm // 4,9896 g per lembar A4
  },
  efKgPerKg: 1339.31834 / 1000, // kg CO2e per kg kertas
}

export const GRID_ID = 680.25 // g CO2e/kWh, Indonesia 2024
export const GRID_WORLD_SWDM = 494 // g CO2e/kWh, nilai global bawaan SWDM v4 (untuk sensitivitas)

export const SWDM = {
  operational: { dataCenter: 0.055, network: 0.059, device: 0.08 }, // kWh/GB
  embodied: { dataCenter: 0.012, network: 0.013, device: 0.081 }, // kWh/GB
}

export const swdmKwhPerGB = (includeEmbodied = true) => {
  const o = SWDM.operational
  const e = SWDM.embodied
  const op = o.dataCenter + o.network + o.device // 0,194
  return includeEmbodied ? op + e.dataCenter + e.network + e.device : op // 0,300
}

/** g CO2e untuk sejumlah byte, metode SWDM v4. */
export function digitalGrams(bytes: number, grid = GRID_ID, includeEmbodied = true) {
  const gb = bytes / 1e9
  return gb * swdmKwhPerGB(includeEmbodied) * grid
}

/* ---------- Kondisi awal (before): dokumen cetak ---------- */

export type PaperDoc = { key: string; label: string; size: string; a4Equivalent: number }

export const PAPER_DOCS: PaperDoc[] = [
  { key: 'poster', label: 'Poster publikasi', size: 'A3', a4Equivalent: 2 },
  { key: 'ticket', label: 'Tiket / bukti daftar', size: 'A6', a4Equivalent: 0.25 },
  { key: 'nametag', label: 'Tag nama', size: 'A6', a4Equivalent: 0.25 },
  { key: 'attendance', label: 'Lembar daftar hadir', size: 'A4', a4Equivalent: 1 },
  { key: 'certificate', label: 'Sertifikat', size: 'A4', a4Equivalent: 1 },
]

export type Scenario = {
  participants: number // jumlah pendaftar
  attendanceRate: number // 0-1, porsi pendaftar yang hadir
  posters: number // poster A3 per acara
  rowsPerAttendanceSheet: number // baris tanda tangan per lembar daftar hadir
  eventsPerYear: number
}

export const BASE_SCENARIO: Scenario = {
  participants: 100,
  attendanceRate: 1,
  posters: 5,
  rowsPerAttendanceSheet: 20,
  eventsPerYear: 12,
}

export function paperCounts(s: Scenario): Record<string, number> {
  const attendees = Math.round(s.participants * s.attendanceRate)
  return {
    poster: s.posters,
    ticket: s.participants,
    nametag: attendees,
    attendance: Math.ceil(s.participants / s.rowsPerAttendanceSheet),
    certificate: attendees,
  }
}

export function beforeEvent(s: Scenario) {
  const counts = paperCounts(s)
  const rows = PAPER_DOCS.map((d) => {
    const qty = counts[d.key]
    const sheetsA4 = qty * d.a4Equivalent
    const grams = sheetsA4 * PAPER.a4Grams
    const co2g = grams * PAPER.efKgPerKg // g kertas x kg/kg = g CO2e
    return { ...d, qty, sheetsA4, grams, co2g }
  })
  const sheetsA4 = rows.reduce((a, r) => a + r.sheetsA4, 0)
  const grams = rows.reduce((a, r) => a + r.grams, 0)
  const co2g = rows.reduce((a, r) => a + r.co2g, 0)
  return { rows, sheetsA4, grams, co2g }
}

/* ---------- Kondisi setelah sistem (after): transfer data ---------- */

/**
 * Bobot transfer per halaman (byte terkompresi Brotli), diukur pada situs produksi
 * https://nirkertas.vercel.app (20 November 2026) dengan Resource Timing API, kunjungan tanpa cache.
 * Nilai = HTML + seluruh JS/CSS yang dimuat rute tersebut + gambar yang dimuat setelah halaman digulir penuh.
 */
export const PAGE_WEIGHT = {
  landing: 358_545,
  events: 473_254,
  eventDetail: 193_006,
  ticket: 119_447, // 110.005 kode + 9.442 thumbnail AVIF
  certificate: 110_509,
  organizerEvents: 114_271,
  organizerDashboard: 216_699,
  participants: 112_238,
  scanner: 113_385,
  scannerFallback: 42_839, // pustaka jsQR, dimuat hanya bila BarcodeDetector tidak tersedia
  impact: 217_882,
  cachedVisit: 1_054, // kunjungan ulang: aset immutable diambil dari cache, hanya HTML
}

export type DigitalAssumptions = {
  cached: boolean // false = setiap kunjungan dihitung tanpa cache (batas atas)
  fallbackShare: number // porsi sesi pemindai yang memuat jsQR
  scannerDevices: number // perangkat panitia yang memindai
}

export const BASE_DIGITAL: DigitalAssumptions = { cached: false, fallbackShare: 1, scannerDevices: 2 }

/**
 * Perjalanan pengguna per acara.
 * Peserta: (1) buka katalog, (2) buka detail & daftar, (3) buka e-tiket setelah daftar,
 *          (4) tampilkan e-tiket saat hadir, (5) unduh e-sertifikat (dibuat lokal, 0 byte).
 * Panitia: buat acara, pantau dashboard, daftar peserta, pindai (per perangkat), kalkulator dampak.
 */
export function afterEvent(s: Scenario, a: DigitalAssumptions = BASE_DIGITAL, grid = GRID_ID, includeEmbodied = true) {
  const w = PAGE_WEIGHT
  const v = (bytes: number) => (a.cached ? w.cachedVisit : bytes)
  const attendees = Math.round(s.participants * s.attendanceRate)
  const perRegistrant = w.events + w.eventDetail + v(w.ticket)
  const perAttendee = v(w.ticket) + v(w.certificate)
  const participantBytes = perRegistrant * s.participants + perAttendee * attendees
  const organizerBytes =
    w.organizerEvents + w.organizerDashboard + w.participants + w.impact +
    a.scannerDevices * (w.scanner + a.fallbackShare * w.scannerFallback)
  const bytes = participantBytes + organizerBytes
  const co2g = digitalGrams(bytes, grid, includeEmbodied)
  return { perRegistrant, perAttendee, participantBytes, organizerBytes, bytes, co2g }
}

export function compare(s: Scenario = BASE_SCENARIO, a: DigitalAssumptions = BASE_DIGITAL, grid = GRID_ID, includeEmbodied = true) {
  const before = beforeEvent(s)
  const after = afterEvent(s, a, grid, includeEmbodied)
  const savedG = before.co2g - after.co2g
  return {
    before,
    after,
    savedG,
    savedPct: before.co2g > 0 ? (savedG / before.co2g) * 100 : 0,
    yearlySavedKg: (savedG * s.eventsPerYear) / 1000,
  }
}
