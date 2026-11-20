/**
 * E-sertifikat dibuat di peramban dengan Canvas saat diminta, lalu diunduh sebagai PNG.
 * Tidak ada berkas yang disimpan di server dan tidak ada permintaan jaringan.
 */
import qrcode from 'qrcode-generator'
import { fnv1a } from './ticket'

export type CertificateData = {
  certificateNo: string
  name: string
  nim: string
  eventTitle: string
  eventDate: string
  organizer: string
  code: string
}

export function certificateVerifyText(d: CertificateData) {
  const body = `NKTCERT|${d.certificateNo}|${d.code}|${d.nim}`
  return `${body}|${fnv1a('nirkertas' + body)}`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function renderCertificate(d: CertificateData): Promise<Blob> {
  const W = 1754 // A4 lanskap, 150 dpi
  const H = 1240
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const font = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#047857'
  ctx.lineWidth = 6
  ctx.strokeRect(48, 48, W - 96, H - 96)
  ctx.strokeStyle = '#a7f3d0'
  ctx.lineWidth = 2
  ctx.strokeRect(68, 68, W - 136, H - 136)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#047857'
  ctx.font = `600 28px ${font}`
  ctx.fillText('NIRKERTAS · E-SERTIFIKAT', W / 2, 170)

  ctx.fillStyle = '#022c22'
  ctx.font = `700 76px ${font}`
  ctx.fillText('SERTIFIKAT KEHADIRAN', W / 2, 280)

  ctx.fillStyle = '#475569'
  ctx.font = `400 30px ${font}`
  ctx.fillText(`Nomor: ${d.certificateNo}`, W / 2, 335)
  ctx.fillText('Diberikan kepada', W / 2, 440)

  ctx.fillStyle = '#022c22'
  ctx.font = `700 64px ${font}`
  ctx.fillText(d.name, W / 2, 530)
  ctx.fillStyle = '#475569'
  ctx.font = `400 30px ${font}`
  ctx.fillText(`NIM ${d.nim}`, W / 2, 580)

  ctx.fillText('atas kehadirannya sebagai peserta pada kegiatan', W / 2, 670)
  ctx.fillStyle = '#022c22'
  ctx.font = `600 40px ${font}`
  wrap(ctx, d.eventTitle, W - 520).forEach((l, i) => ctx.fillText(l, W / 2, 735 + i * 52))
  ctx.fillStyle = '#475569'
  ctx.font = `400 30px ${font}`
  ctx.fillText(`${d.eventDate} · ${d.organizer}`, W / 2, 870)

  // QR verifikasi
  const qr = qrcode(0, 'M')
  qr.addData(certificateVerifyText(d))
  qr.make()
  const n = qr.getModuleCount()
  const cell = Math.floor(200 / n)
  const qx = W - 140 - cell * n
  const qy = H - 140 - cell * n
  ctx.fillStyle = '#022c22'
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, cell, cell)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'
  ctx.font = `400 22px ${font}`
  ctx.fillText(`Kode tiket: ${d.code}`, 140, H - 170)
  ctx.fillText('Dokumen ini diterbitkan secara digital tanpa cetak kertas.', 140, H - 135)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar'))), 'image/png'))
}

export async function downloadCertificate(d: CertificateData) {
  const blob = await renderCertificate(d)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${d.certificateNo.replace(/\//g, '-')}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
