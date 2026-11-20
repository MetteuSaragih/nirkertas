/**
 * Format isi QR e-tiket.
 *
 *   NKT1|<kode>|<eventId>|<nim>|<nama>|<checksum>
 *
 * Isi QR memuat data minimum yang dibutuhkan panitia untuk presensi, sehingga
 * pemindai di perangkat lain tidak memerlukan server untuk membaca tiket.
 * Checksum (FNV-1a 32-bit) mendeteksi QR yang rusak atau diketik ulang dengan salah.
 * Checksum ini bukan tanda tangan kriptografis; pengamanan penuh membutuhkan backend.
 */
import qrcode from 'qrcode-generator'
import type { Registration } from './store'

const VERSION = 'NKT1'
const SALT = 'nirkertas'

export function fnv1a(str: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const clean = (s: string) => s.replace(/\|/g, ' ').trim()

export function encodeTicket(r: Pick<Registration, 'code' | 'eventId' | 'nim' | 'name'>) {
  const body = [VERSION, r.code, r.eventId, clean(r.nim), clean(r.name)].join('|')
  return `${body}|${fnv1a(SALT + body)}`
}

export type DecodedTicket = { code: string; eventId: string; nim: string; name: string }

export function decodeTicket(text: string): DecodedTicket | null {
  const parts = text.trim().split('|')
  if (parts.length !== 6 || parts[0] !== VERSION) return null
  const body = parts.slice(0, 5).join('|')
  if (fnv1a(SALT + body) !== parts[5]) return null
  const [, code, eventId, nim, name] = parts
  return { code, eventId, nim, name }
}

/** Membuat QR Code sebagai satu path SVG (tanpa berkas gambar, tanpa permintaan jaringan). */
export function qrPath(text: string) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      if (!qr.isDark(r, c)) {
        c++
        continue
      }
      const start = c
      while (c < n && qr.isDark(r, c)) c++
      d += `M${start} ${r}h${c - start}v1h-${c - start}z`
    }
  }
  return { d, size: n }
}
