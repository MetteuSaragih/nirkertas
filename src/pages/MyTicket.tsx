import { useState } from 'react'
import { CalendarDays, CalendarPlus, CircleCheck, Clock, Leaf, MapPin, MonitorPlay, ShieldCheck, Sun, Ticket, Trash2 } from 'lucide-react'
import { Badge, Button, ButtonLink, Card, CategoryBadge, PageHeader } from '../components/ui'
import { QRCode } from '../components/QRCode'
import { getEvent, img } from '../data'
import { cn, nf1 } from '../lib/cn'
import { cancelRegistration, formatDateTime, useDB } from '../lib/store'
import { encodeTicket } from '../lib/ticket'
import { PAPER } from '../lib/carbon'

/** Membuat berkas .ics agar acara masuk ke kalender perangkat (tanpa layanan pihak ketiga). */
function downloadIcs(title: string, location: string, code: string) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nirkertas//ID',
    'BEGIN:VEVENT',
    `UID:${code}@nirkertas`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:Kode e-tiket ${code}. Tunjukkan QR di aplikasi Nirkertas.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${code}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function MyTicket() {
  const { registrations } = useDB()
  const tickets = registrations.filter((r) => getEvent(r.eventId))
  const [selected, setSelected] = useState<string | null>(null)
  const ticket = tickets.find((t) => t.code === selected) ?? tickets[0]

  if (!ticket) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Ticket className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Belum ada e-tiket</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Daftar ke salah satu acara, lalu e-tiket ber-QR Code akan tersimpan di sini.</p>
        <ButtonLink to="/acara" className="mt-6">
          Jelajahi acara
        </ButtonLink>
      </div>
    )
  }

  const event = getEvent(ticket.eventId)!
  const used = Boolean(ticket.checkedInAt)
  // Tiket A6 = 1/4 lembar A4
  const savedG = tickets.length * 0.25 * PAPER.a4Grams * PAPER.efKgPerKg

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Tiket saya"
        title="E-tiket acara"
        description="Tunjukkan QR Code kepada panitia saat registrasi ulang. Tidak perlu mencetak tiket."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">E-tiket · {tickets.length}</p>
          <ul className="space-y-3" aria-label="Daftar e-tiket">
            {tickets.map((t) => {
              const e = getEvent(t.eventId)!
              const active = t.code === ticket.code
              return (
                <li key={t.code}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(t.code)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition dark:bg-slate-900',
                      active ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                    )}
                  >
                    <img src={img(e.image, 200)} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm leading-snug font-semibold text-slate-900 dark:text-slate-100">{e.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {e.day} {e.month} · {t.checkedInAt ? 'Sudah hadir' : 'Aktif'}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-6 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:ring-emerald-800/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              <Leaf className="size-4" aria-hidden /> Kontribusimu
            </p>
            <p className="mt-1 text-sm text-emerald-900/75 dark:text-emerald-300/80">
              {tickets.length} e-tiket menggantikan {tickets.length} tiket cetak A6, setara ± {nf1.format(savedG)} g CO2e produksi kertas yang dihindari.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
          <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700/80">
            <div className="relative bg-emerald-950 p-6 text-white sm:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-950/85 to-teal-900/70" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold tracking-[0.2em] text-lime-300 uppercase">E-Tiket · nirkertas</p>
                  <Badge tone="lime" className="bg-lime-300 text-emerald-950 ring-0">
                    {used ? <CircleCheck className="size-3.5" aria-hidden /> : <ShieldCheck className="size-3.5" aria-hidden />}
                    {used ? 'Sudah digunakan' : 'Aktif'}
                  </Badge>
                </div>
                <h2 className="mt-4 text-xl leading-snug font-bold sm:text-2xl">{event.title}</h2>
                <p className="mt-1 text-sm text-emerald-100/80">{event.organizer}</p>
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                {[
                  { icon: CalendarDays, l: 'Tanggal', v: event.date },
                  { icon: Clock, l: 'Waktu', v: event.time },
                  { icon: event.mode === 'Daring' ? MonitorPlay : MapPin, l: 'Lokasi', v: event.location },
                  { icon: CircleCheck, l: 'Presensi', v: ticket.checkedInAt ? formatDateTime(ticket.checkedInAt) : 'Belum' },
                ].map(({ icon: Icon, l, v }) => (
                  <div key={l}>
                    <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Icon className="size-3.5" aria-hidden /> {l}
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{v}</dd>
                  </div>
                ))}
                <div className="col-span-2 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Nama peserta</dt>
                  <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{ticket.name}</dd>
                  <dd className="text-xs text-slate-500 dark:text-slate-400">
                    {ticket.nim} · {ticket.prodi}
                  </dd>
                </div>
              </dl>
              <div className="hidden sm:block">
                <CategoryBadge category={event.category} />
              </div>
            </div>

            <div className="relative flex items-center">
              <span className="absolute -left-4 size-8 rounded-full bg-slate-50 ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-700" aria-hidden />
              <div className="perforation mx-6 h-1 flex-1" aria-hidden />
              <span className="absolute -right-4 size-8 rounded-full bg-slate-50 ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-700" aria-hidden />
            </div>

            <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
              <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <QRCode value={encodeTicket(ticket)} className="size-48 sm:size-52" label={`QR Code tiket ${ticket.code}`} />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs text-slate-500 dark:text-slate-400">Kode tiket</p>
                <p className="font-mono text-xl font-bold tracking-wider text-slate-900 dark:text-slate-100">{ticket.code}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Diterbitkan {formatDateTime(ticket.registeredAt)}</p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                  <Sun className="size-3.5" aria-hidden /> Naikkan kecerahan layar saat dipindai
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Simpan tiket</p>
              <div className="mt-4 space-y-2">
                <Button variant="secondary" className="w-full" onClick={() => downloadIcs(event.title, event.location, ticket.code)}>
                  <CalendarPlus className="size-4" aria-hidden /> Tambah ke kalender
                </Button>
                {!used && (
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => {
                      if (window.confirm('Batalkan pendaftaran ini? E-tiket akan dihapus.')) cancelRegistration(ticket.code)
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden /> Batalkan pendaftaran
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Cukup tunjukkan layar ini. Tiket tidak perlu dicetak.</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Petunjuk masuk</p>
              <ol className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                {['Datang 15–30 menit sebelum acara dimulai.', 'Buka halaman ini dan tampilkan QR Code.', 'Panitia memindai, presensi tercatat otomatis.', 'E-sertifikat dapat diunduh setelah presensi.'].map(
                  (s, i) => (
                    <li key={s} className="flex gap-3">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">{i + 1}</span>
                      {s}
                    </li>
                  ),
                )}
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
