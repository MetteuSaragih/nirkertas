import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, CameraOff, CircleAlert, CircleCheck, CircleX, Keyboard, RefreshCw } from 'lucide-react'
import { Avatar, Button, Card, Input, PageHeader, Select } from '../../components/ui'
import { events } from '../../data'
import { cn } from '../../lib/cn'
import { checkIn, formatDateTime, useDB, type CheckInResult } from '../../lib/store'
import { decodeTicket } from '../../lib/ticket'

/** Interval deteksi: 4 kali per detik, bukan setiap frame, untuk menghemat CPU dan baterai. */
const SCAN_INTERVAL_MS = 250

type Detector = (source: HTMLVideoElement) => Promise<string | null>

type BarcodeDetectorLike = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> }

/**
 * Memilih detektor QR:
 * 1. BarcodeDetector bawaan peramban (Chrome/Edge Android & desktop) - tanpa unduhan tambahan.
 * 2. Bila tidak tersedia, pustaka jsQR dimuat secara dinamis (code splitting) hanya saat dibutuhkan.
 */
async function createDetector(): Promise<Detector> {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
  if (BD) {
    const d = new BD({ formats: ['qr_code'] })
    return async (video) => {
      const codes = await d.detect(video)
      return codes[0]?.rawValue ?? null
    }
  }
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return async (video) => {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return null
    const scale = Math.min(1, 640 / w) // perkecil frame agar dekode ringan
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

export function Scanner() {
  const openEvents = events.filter((e) => e.status !== 'Selesai')
  const [eventId, setEventId] = useState(openEvents[0].id)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [manual, setManual] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedRef = useRef(false)
  const eventRef = useRef(eventId)
  eventRef.current = eventId
  pausedRef.current = result !== null

  const db = useDB()
  const regs = db.registrations.filter((r) => r.eventId === eventId)
  const hadir = db.checkins.filter((c) => c.eventId === eventId)
  const event = events.find((e) => e.id === eventId)!

  function handleText(text: string) {
    const decoded = decodeTicket(text)
    setResult(checkIn(decoded, decoded ? decoded.code : text, eventRef.current))
  }

  // Kamera dan loop deteksi hanya berjalan saat kamera dinyalakan; dihentikan saat halaman ditinggalkan.
  useEffect(() => {
    if (!cameraOn) return
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
        if (stopped) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        const detect = await createDetector()
        const tick = async () => {
          if (stopped) return
          if (!pausedRef.current && video.readyState >= 2) {
            try {
              const text = await detect(video)
              if (text && !pausedRef.current) handleText(text)
            } catch {
              /* frame gagal dibaca, lanjut ke frame berikutnya */
            }
          }
          timer = window.setTimeout(tick, SCAN_INTERVAL_MS)
        }
        tick()
      } catch (err) {
        setCameraError(err instanceof Error && err.name === 'NotAllowedError' ? 'Izin kamera ditolak. Gunakan input kode manual.' : 'Kamera tidak dapat dibuka di perangkat ini. Gunakan input kode manual.')
        setCameraOn(false)
      }
    })()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [cameraOn])

  const onManual = (e: FormEvent) => {
    e.preventDefault()
    if (!manual.trim()) return
    handleText(manual)
    setManual('')
  }

  const frame =
    result?.kind === 'ok' ? 'border-lime-300' : result?.kind === 'dup' ? 'border-amber-300' : result ? 'border-rose-400' : 'border-white'

  return (
    <div className="space-y-6">
      <PageHeader title="Pindai QR presensi" description="Arahkan kamera ke QR Code pada e-tiket peserta, atau ketik kode tiket. Presensi langsung tercatat." />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="mb-4 max-w-md">
            <label htmlFor="acara-pindai" className="mb-1.5 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Acara
            </label>
            <Select
              id="acara-pindai"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value)
                setResult(null)
              }}
            >
              {openEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950 shadow-lift">
            <video ref={videoRef} className={cn('absolute inset-0 size-full object-cover', !cameraOn && 'hidden')} muted playsInline />
            {cameraOn && (
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                <span className="size-2 rounded-full bg-rose-500" /> Kamera aktif
              </div>
            )}
            <div className="absolute inset-0 grid place-items-center">
              <div className="relative size-48 sm:size-60">
                {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
                  <span key={c} className={cn('absolute size-10 transition-colors', frame, c)} aria-hidden />
                ))}
                {cameraOn && !result && (
                  <span className="absolute inset-x-3 h-0.5 rounded-full bg-lime-300 shadow-[0_0_16px_4px_rgba(190,242,100,0.6)] motion-safe:animate-scan" aria-hidden />
                )}
                {result && (
                  <div className="absolute inset-0 grid place-items-center">
                    {result.kind === 'ok' && <CircleCheck className="size-20 text-lime-300" aria-hidden />}
                    {result.kind === 'dup' && <CircleAlert className="size-20 text-amber-300" aria-hidden />}
                    {(result.kind === 'invalid' || result.kind === 'wrong-event') && <CircleX className="size-20 text-rose-400" aria-hidden />}
                  </div>
                )}
              </div>
            </div>
            <p className="absolute inset-x-0 bottom-5 px-4 text-center text-sm text-white/80">
              {result ? 'Ketuk “Pindai berikutnya” untuk lanjut' : cameraOn ? 'Posisikan QR Code di dalam bingkai' : cameraError ?? 'Nyalakan kamera untuk mulai memindai'}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {result ? (
              <Button size="lg" className="flex-1" onClick={() => setResult(null)}>
                <RefreshCw className="size-4" aria-hidden /> Pindai berikutnya
              </Button>
            ) : (
              <Button size="lg" className="flex-1" variant={cameraOn ? 'secondary' : 'primary'} onClick={() => { setCameraError(null); setCameraOn((v) => !v) }}>
                {cameraOn ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />}
                {cameraOn ? 'Matikan kamera' : 'Nyalakan kamera'}
              </Button>
            )}
            <form onSubmit={onManual} className="flex flex-1 gap-2">
              <label htmlFor="kode-manual" className="sr-only">
                Masukkan kode tiket manual
              </label>
              <div className="relative flex-1">
                <Keyboard className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input id="kode-manual" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="NKT-XXXX-XXXX" className="h-12 pl-10 font-mono uppercase" />
              </div>
              <Button type="submit" variant="secondary" size="lg">
                Cek
              </Button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div aria-live="polite">
            {!result && (
              <Card className="p-6 text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Menunggu pemindaian</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hasil validasi tiket akan muncul di sini.</p>
              </Card>
            )}
            {result?.kind === 'ok' && (
              <Card className="border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800/60 dark:bg-emerald-900/30">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  <CircleCheck className="size-5" aria-hidden /> Tiket valid · presensi tercatat
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar name={result.checkin.name} className="size-12 bg-white text-sm dark:bg-slate-800" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{result.checkin.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">NIM {result.checkin.nim}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-white p-3 text-xs dark:bg-slate-800">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Kode tiket</dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">{result.checkin.code}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Waktu check-in</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(result.checkin.at)}</dd>
                  </div>
                </dl>
              </Card>
            )}
            {result?.kind === 'dup' && (
              <Card className="border-amber-200 bg-amber-50 p-6 dark:border-amber-800/60 dark:bg-amber-900/30">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                  <CircleAlert className="size-5" aria-hidden /> Tiket sudah digunakan
                </p>
                <p className="mt-3 text-sm text-amber-900/80 dark:text-amber-200/80">
                  <b>{result.checkin.name}</b> telah check-in pada {formatDateTime(result.checkin.at)}. Tidak perlu dipindai ulang.
                </p>
                <p className="mt-3 font-mono text-xs text-amber-900/70 dark:text-amber-300/70">{result.checkin.code}</p>
              </Card>
            )}
            {(result?.kind === 'invalid' || result?.kind === 'wrong-event') && (
              <Card className="border-rose-200 bg-rose-50 p-6 dark:border-rose-800/60 dark:bg-rose-900/30">
                <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
                  <CircleX className="size-5" aria-hidden /> {result.kind === 'wrong-event' ? 'Tiket untuk acara lain' : 'Tiket tidak valid'}
                </p>
                <p className="mt-3 text-sm text-rose-900/80 dark:text-rose-200/80">
                  {result.kind === 'wrong-event'
                    ? `Tiket ini terdaftar untuk "${events.find((e) => e.id === result.eventId)?.title ?? result.eventId}".`
                    : 'QR atau kode tidak dikenali, atau checksum tidak cocok. Arahkan peserta ke meja bantuan.'}
                </p>
                <p className="mt-3 font-mono text-xs text-rose-900/70 dark:text-rose-300/70">{result.code}</p>
              </Card>
            )}
          </div>

          <Card className="p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Presensi tercatat (perangkat ini)</p>
                <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {hadir.length}
                  <span className="text-base font-medium text-slate-400"> / {Math.max(regs.length, hadir.length)} pendaftar lokal</span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {event.title}. Setiap pindaian menggantikan 1 baris tanda tangan di daftar hadir kertas.
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Riwayat pindai</p>
            {hadir.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Belum ada presensi untuk acara ini.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {hadir.slice(0, 8).map((c) => (
                  <li key={c.code} className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      <CircleCheck className="size-4" aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">{c.name}</p>
                    <span className="text-xs text-slate-400">{formatDateTime(c.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
