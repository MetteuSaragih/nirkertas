import { useState } from 'react'
import { Award, CalendarCheck, Download, Eye, Hourglass, Leaf, ShieldCheck, Ticket } from 'lucide-react'
import { Badge, Button, ButtonLink, Card, CategoryBadge, PageHeader, StatCard } from '../components/ui'
import { LogoMark } from '../components/Illustrations'
import { QRCode } from '../components/QRCode'
import { getEvent, university } from '../data'
import { cn, nf1 } from '../lib/cn'
import { formatDateTime, issueCertificate, useDB, type Registration } from '../lib/store'
import { certificateVerifyText, downloadCertificate } from '../lib/certificate'
import { PAPER } from '../lib/carbon'

export function Certificates() {
  const { registrations } = useDB()
  const list = registrations.filter((r) => getEvent(r.eventId))
  const attended = list.filter((r) => r.checkedInAt)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cert = attended.find((r) => r.code === selected) ?? attended[0]

  async function download(r: Registration) {
    const issued = issueCertificate(r.code)
    if (!issued?.certificateNo) return
    const e = getEvent(r.eventId)!
    setBusy(true)
    try {
      await downloadCertificate({
        certificateNo: issued.certificateNo,
        name: issued.name,
        nim: issued.nim,
        eventTitle: e.title,
        eventDate: e.date,
        organizer: e.organizer,
        code: issued.code,
      })
    } finally {
      setBusy(false)
    }
  }

  const savedG = attended.length * PAPER.a4Grams * PAPER.efKgPerKg

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Riwayat & sertifikat"
        title="Acara yang kamu ikuti"
        description="E-sertifikat terbuka otomatis setelah QR e-tiketmu dipindai panitia. Sertifikat dibuat langsung di perangkatmu, tanpa cetak."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Ticket} label="Acara didaftar" value={String(list.length)} hint="Tersimpan di perangkat ini" />
        <StatCard icon={CalendarCheck} label="Presensi tercatat" value={String(attended.length)} accent="lime" hint="Sertifikat dapat diunduh" />
        <StatCard icon={Leaf} label="Kertas sertifikat dihindari" value={nf1.format(savedG)} unit="g CO2e" accent="teal" hint={`${attended.length} lembar A4`} />
      </div>

      {list.length === 0 ? (
        <Card className="mt-8 p-10 text-center">
          <p className="font-semibold text-slate-900 dark:text-slate-100">Belum ada riwayat acara</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Daftar acara terlebih dahulu. Setelah presensi, sertifikat muncul di sini.</p>
          <ButtonLink to="/acara" className="mt-5">
            Jelajahi acara
          </ButtonLink>
        </Card>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Riwayat acara</h2>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((r) => {
                const e = getEvent(r.eventId)!
                const ok = Boolean(r.checkedInAt)
                return (
                  <li key={r.code} className={cn('p-5 transition-colors', cert?.code === r.code && 'bg-emerald-50/50 dark:bg-emerald-900/20')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CategoryBadge category={e.category} />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{e.date}</span>
                        </div>
                        <p className="mt-2 text-sm leading-snug font-semibold text-slate-900 dark:text-slate-100">{e.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {e.organizer} · {ok ? `hadir ${formatDateTime(r.checkedInAt!)}` : 'belum presensi'}
                        </p>
                      </div>
                      {ok ? (
                        <Badge tone="emerald">
                          <ShieldCheck className="size-3.5" aria-hidden /> Tersedia
                        </Badge>
                      ) : (
                        <Badge tone="amber">
                          <Hourglass className="size-3.5" aria-hidden /> Menunggu presensi
                        </Badge>
                      )}
                    </div>
                    {ok && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant={cert?.code === r.code ? 'primary' : 'secondary'} onClick={() => setSelected(r.code)}>
                          <Eye className="size-4" aria-hidden /> Pratinjau
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => download(r)}>
                          <Download className="size-4" aria-hidden /> Unduh PNG
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>

          <div className="lg:sticky lg:top-24 lg:self-start">
            {cert ? (
              <CertificatePreview r={cert} onDownload={() => download(cert)} busy={busy} />
            ) : (
              <Card className="p-8 text-center">
                <Award className="mx-auto size-8 text-emerald-600" aria-hidden />
                <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">Sertifikat belum tersedia</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tunjukkan QR e-tiket kepada panitia saat acara. Setelah dipindai, sertifikat terbuka di sini.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CertificatePreview({ r, onDownload, busy }: { r: Registration; onDownload: () => void; busy: boolean }) {
  const e = getEvent(r.eventId)!
  const no = r.certificateNo ?? 'Nomor terbit saat diunduh'
  return (
    <>
      <div className="rounded-3xl bg-gradient-to-br from-emerald-100 via-white to-lime-50 p-3 shadow-lift ring-1 ring-slate-200/80 dark:from-emerald-900/40 dark:via-slate-800 dark:to-slate-800 dark:ring-slate-700/80 sm:p-5">
        <article aria-label={`Pratinjau e-sertifikat ${e.title}`} className="relative aspect-[1.414/1] overflow-hidden rounded-xl bg-white ring-1 ring-emerald-200">
          <div className="absolute inset-2 rounded-lg border border-emerald-600/30 sm:inset-3" aria-hidden />
          <div className="relative flex h-full flex-col items-center justify-between px-6 py-5 text-center sm:px-10 sm:py-8">
            <div className="flex items-center gap-2">
              <LogoMark className="size-5 sm:size-7" />
              <span className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase sm:text-xs">{university}</span>
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[0.3em] text-emerald-700 uppercase sm:text-xs">Sertifikat Kehadiran</p>
              <p className="mt-1 text-[8px] text-slate-500 sm:mt-2 sm:text-[11px]">Diberikan kepada</p>
              <p className="mt-0.5 text-base font-extrabold tracking-tight text-emerald-950 sm:mt-1 sm:text-3xl">{r.name}</p>
              <p className="mx-auto mt-1 max-w-sm text-[8px] leading-relaxed text-slate-600 sm:mt-2 sm:text-xs">
                NIM {r.nim}, atas kehadirannya sebagai <b>Peserta</b> dalam kegiatan
                <br />
                <span className="font-semibold text-slate-800">{e.title}</span>
                <br />
                yang diselenggarakan oleh {e.organizer} pada {e.date}.
              </p>
            </div>
            <div className="flex w-full items-end justify-between">
              <p className="max-w-[45%] text-left text-[7px] text-slate-500 sm:text-[10px]">Diterbitkan secara digital oleh Nirkertas tanpa cetak kertas.</p>
              <div className="flex flex-col items-center">
                <QRCode
                  value={certificateVerifyText({ certificateNo: no, name: r.name, nim: r.nim, eventTitle: e.title, eventDate: e.date, organizer: e.organizer, code: r.code })}
                  className="size-10 sm:size-16"
                  label="QR Code verifikasi sertifikat"
                />
                <p className="mt-0.5 font-mono text-[6px] text-slate-500 sm:text-[9px]">{no}</p>
              </div>
            </div>
          </div>
        </article>
      </div>
      <Button className="mt-4 w-full" onClick={onDownload} disabled={busy}>
        <Download className="size-4" aria-hidden /> {busy ? 'Membuat sertifikat…' : 'Unduh e-sertifikat (PNG)'}
      </Button>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
        QR pada sertifikat memuat nomor sertifikat, kode tiket, dan NIM beserta checksum.
      </p>
    </>
  )
}
