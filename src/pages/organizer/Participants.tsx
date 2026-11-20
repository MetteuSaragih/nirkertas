import { useMemo, useState } from 'react'
import { Award, CircleCheck, Clock, Download, Search, UserCheck, Users } from 'lucide-react'
import { Avatar, Badge, Button, ButtonLink, Card, Input, PageHeader, Select, StatCard } from '../../components/ui'
import { allEvents } from '../../data'
import { formatDateTime, useDB, type Registration } from '../../lib/store'

type Status = 'Semua' | 'Hadir' | 'Terdaftar'

function toCsv(rows: Registration[]) {
  const head = ['kode_tiket', 'nama', 'nim', 'prodi', 'angkatan', 'email', 'terdaftar', 'check_in', 'no_sertifikat']
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const body = rows.map((r) =>
    [r.code, r.name, r.nim, r.prodi, r.angkatan, r.email, r.registeredAt, r.checkedInAt ?? '', r.certificateNo ?? ''].map(esc).join(','),
  )
  return [head.join(','), ...body].join('\r\n')
}

export function Participants() {
  const events = allEvents()
  const { registrations } = useDB()
  const [eventId, setEventId] = useState(events[0].id)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<Status>('Semua')

  const all = registrations.filter((r) => r.eventId === eventId)
  const hadir = all.filter((r) => r.checkedInAt).length
  const sertifikat = all.filter((r) => r.certificateNo).length

  const list = useMemo(
    () =>
      all.filter(
        (p) =>
          (status === 'Semua' || (status === 'Hadir' ? p.checkedInAt : !p.checkedInAt)) &&
          `${p.name} ${p.nim} ${p.prodi} ${p.code}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [all, q, status],
  )

  function exportCsv() {
    const blob = new Blob(['﻿' + toCsv(all)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `peserta-${eventId}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar peserta"
        description="Pendaftaran dan kehadiran yang tercatat di perangkat ini. Tidak ada lagi rekap daftar hadir manual."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={all.length === 0}>
            <Download className="size-4" aria-hidden /> Ekspor CSV
          </Button>
        }
      />

      <div className="max-w-md">
        <label htmlFor="pilih-acara" className="mb-1.5 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Acara
        </label>
        <Select id="pilih-acara" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} · {e.date}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Terdaftar" value={String(all.length)} hint="Pendaftar di perangkat ini" />
        <StatCard icon={UserCheck} label="Sudah hadir" value={String(hadir)} hint={all.length ? `${Math.round((hadir / all.length) * 100)}% dari pendaftar` : '—'} accent="lime" />
        <StatCard icon={Clock} label="Belum hadir" value={String(all.length - hadir)} hint="Belum dipindai" accent="slate" />
        <StatCard icon={Award} label="Sertifikat diunduh" value={String(sertifikat)} hint="Oleh peserta" accent="teal" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <label htmlFor="cari-peserta" className="sr-only">
              Cari peserta
            </label>
            <Input id="cari-peserta" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, NIM, prodi, atau kode…" className="pl-10" />
          </div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-40">
            <option value="Semua">Semua status</option>
            <option value="Hadir">Hadir</option>
            <option value="Terdaftar">Belum hadir</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">Peserta</th>
                <th scope="col" className="px-4 py-3">NIM</th>
                <th scope="col" className="px-4 py-3">Program studi</th>
                <th scope="col" className="px-4 py-3">Kode tiket</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((p) => (
                <tr key={p.code} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.nim}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.prodi}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.code}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.checkedInAt ? 'emerald' : 'slate'}>
                      {p.checkedInAt && <CircleCheck className="size-3.5" aria-hidden />}
                      {p.checkedInAt ? 'Hadir' : 'Terdaftar'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.checkedInAt ? formatDateTime(p.checkedInAt) : '—'}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    {all.length === 0 ? (
                      <>
                        Belum ada pendaftar untuk acara ini di perangkat ini.{' '}
                        <ButtonLink to={`/acara/${eventId}`} variant="ghost" size="sm">
                          Buka halaman pendaftaran
                        </ButtonLink>
                      </>
                    ) : (
                      'Tidak ada peserta yang cocok dengan pencarian.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Menampilkan {list.length} dari {all.length} peserta
        </div>
      </Card>
    </div>
  )
}
