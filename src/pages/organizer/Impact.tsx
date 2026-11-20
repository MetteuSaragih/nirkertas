import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, FileText, Info, Leaf, Server, Ticket } from 'lucide-react'
import { Card, Input, Label, PageHeader, StatCard } from '../../components/ui'
import { ChartTooltip, axisProps } from '../../components/charts'
import { nf, nf1 } from '../../lib/cn'
import { BASE_DIGITAL, BASE_SCENARIO, GRID_ID, PAPER, compare, swdmKwhPerGB, type Scenario } from '../../lib/carbon'
import { useDB } from '../../lib/store'

const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

function NumberField({ id, label, value, onChange, min, max, step = 1, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
          }}
          className={suffix ? 'pr-12' : undefined}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

export function Impact() {
  const [s, setS] = useState<Scenario>(BASE_SCENARIO)
  const r = useMemo(() => compare(s, BASE_DIGITAL), [s])
  const set = (k: keyof Scenario) => (v: number) => setS((p) => ({ ...p, [k]: v }))
  const db = useDB()

  // Data nyata yang tercatat di perangkat ini
  const tickets = db.registrations.length
  const checkins = db.checkins.length
  const certs = db.registrations.filter((x) => x.certificateNo).length
  const realSheets = tickets * 0.25 + checkins * 0.25 + certs * 1 // tiket A6, tag nama A6, sertifikat A4
  const realCo2 = realSheets * PAPER.a4Grams * PAPER.efKgPerKg

  const chart = [
    { name: 'Konvensional (kertas)', value: Number(r.before.co2g.toFixed(1)), color: '#94a3b8' },
    { name: 'Nirkertas (digital)', value: Number(r.after.co2g.toFixed(1)), color: '#059669' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analitik keberlanjutan"
        title="Kalkulator dampak CO2e"
        description="Bandingkan emisi produksi dokumen cetak (before) dengan emisi transfer data aplikasi (after). Ubah parameter sesuai acara Anda."
      />

      <div className="relative overflow-hidden rounded-3xl bg-emerald-950 p-6 text-white sm:p-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-emerald-200/80">Emisi dihindari per acara</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">
              {nf1.format(r.savedG)} <span className="text-lg font-medium text-emerald-200">g CO2e</span>
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-lime-300">
              <ArrowDown className="size-4" aria-hidden /> {nf1.format(r.savedPct)}% lebih rendah
            </p>
          </div>
          <div>
            <p className="text-sm text-emerald-200/80">Per tahun ({s.eventsPerYear} acara)</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">
              {nf2.format(r.yearlySavedKg)} <span className="text-lg font-medium text-emerald-200">kg CO2e</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-emerald-200/80">Kertas dihindari per acara</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">
              {nf.format(Math.round(r.before.grams))} <span className="text-lg font-medium text-emerald-200">g</span>
            </p>
            <p className="mt-1 text-sm text-emerald-200/80">{nf1.format(r.before.sheetsA4)} lembar setara A4</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card className="p-6">
          <p className="font-semibold text-slate-900 dark:text-slate-100">Parameter acara</p>
          <div className="mt-4 space-y-4">
            <NumberField id="p-peserta" label="Jumlah pendaftar" value={s.participants} onChange={set('participants')} min={1} max={10000} />
            <NumberField
              id="p-hadir"
              label="Tingkat kehadiran"
              value={Math.round(s.attendanceRate * 100)}
              onChange={(v) => setS((p) => ({ ...p, attendanceRate: v / 100 }))}
              min={0}
              max={100}
              suffix="%"
            />
            <NumberField id="p-poster" label="Poster A3 yang biasa dicetak" value={s.posters} onChange={set('posters')} min={0} max={500} />
            <NumberField id="p-baris" label="Baris per lembar daftar hadir" value={s.rowsPerAttendanceSheet} onChange={set('rowsPerAttendanceSheet')} min={5} max={60} />
            <NumberField id="p-acara" label="Acara per tahun" value={s.eventsPerYear} onChange={set('eventsPerYear')} min={1} max={500} />
          </div>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard icon={FileText} label="Before: produksi kertas" value={nf1.format(r.before.co2g)} unit="g CO2e" accent="slate" hint={`${nf.format(Math.round(r.before.grams))} g kertas × ${nf2.format(PAPER.efKgPerKg)} kg CO2e/kg`} />
            <StatCard icon={Server} label="After: transfer data" value={nf1.format(r.after.co2g)} unit="g CO2e" hint={`${nf2.format(r.after.bytes / 1e6)} MB × ${nf2.format(swdmKwhPerGB())} kWh/GB × ${nf2.format(GRID_ID)} g/kWh`} />
          </div>

          <Card className="p-6">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Perbandingan emisi per acara</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ left: 16, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" {...axisProps} unit=" g" />
                  <YAxis type="category" dataKey="name" width={150} {...axisProps} />
                  <Tooltip content={<ChartTooltip unit=" g CO2e" />} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                  <Bar dataKey="value" name="Emisi" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                    {chart.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Rincian dokumen yang digantikan</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Dokumen</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3 text-right">Setara A4</th>
                    <th className="px-4 py-3 text-right">Kertas (g)</th>
                    <th className="px-6 py-3 text-right">g CO2e</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {r.before.rows.map((d) => (
                    <tr key={d.key}>
                      <td className="px-6 py-3 text-slate-800 dark:text-slate-200">
                        {d.label} <span className="text-xs text-slate-500">({d.size})</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{nf.format(d.qty)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{nf2.format(d.sheetsA4)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{nf1.format(d.grams)}</td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums">{nf1.format(d.co2g)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <Ticket className="size-4 text-emerald-600" aria-hidden /> Data nyata di perangkat ini
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-center">
            {[
              ['E-tiket terbit', tickets],
              ['Presensi QR', checkins],
              ['E-sertifikat', certs],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <dd className="text-2xl font-bold text-slate-900 dark:text-slate-100">{v}</dd>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{l}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Setara {nf2.format(realSheets)} lembar A4 dan ± <b>{nf1.format(realCo2)} g CO2e</b> produksi kertas yang tidak terjadi (tiket dan tag nama A6, sertifikat A4).
          </p>
        </Card>

        <Card className="p-6">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <Info className="size-4 text-emerald-600" aria-hidden /> Metode dan sumber
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>
              <b>Before:</b> 1 lembar A4 80 g/m² = {nf2.format(PAPER.a4Grams)} g. Faktor emisi kertas primer 1.339,32 kg CO2e/ton (UK DESNZ, conversion factors 2024).
            </li>
            <li>
              <b>After:</b> Sustainable Web Design Model v4, {nf2.format(swdmKwhPerGB())} kWh/GB (operasional + embodied), intensitas listrik Indonesia 2024 sebesar 680,25 g CO2e/kWh (Ember, via Our World in Data).
            </li>
            <li>Bobot transfer per halaman diukur dari build produksi. Pencetakan (tinta, listrik printer) dan distribusi tidak dihitung.</li>
          </ul>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Leaf className="size-4 text-emerald-600" aria-hidden /> Angka adalah estimasi berbasis skenario, bukan hasil pengukuran langsung di acara.
          </p>
        </Card>
      </div>
    </div>
  )
}
