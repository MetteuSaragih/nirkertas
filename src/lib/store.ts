/**
 * Penyimpanan lokal Nirkertas (localStorage).
 *
 * Satu rekaman registrasi menyimpan seluruh siklus hidup tiket:
 * pendaftaran -> presensi (checkedInAt) -> sertifikat (certificateNo).
 * Dengan begitu tidak ada tabel terpisah yang perlu di-join dan tidak ada data ganda.
 */
import { useSyncExternalStore } from 'react'
import type { EventItem } from '../data'

export type Registration = {
  code: string // kode tiket unik, mis. NKT-GC26-7K3Q
  eventId: string
  name: string
  nim: string
  email: string
  prodi: string
  angkatan: string
  registeredAt: string // ISO 8601
  checkedInAt?: string // ISO 8601, terisi saat QR dipindai panitia
  certificateNo?: string // terisi saat sertifikat pertama kali diunduh
}

export type CheckIn = {
  code: string
  eventId: string
  name: string
  nim: string
  at: string // ISO 8601
}

type DB = { registrations: Registration[]; checkins: CheckIn[]; events: EventItem[] }

const KEY = 'nirkertas-db-v1'
const empty: DB = { registrations: [], checkins: [], events: [] }

function read(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<DB>
    return { registrations: parsed.registrations ?? [], checkins: parsed.checkins ?? [], events: parsed.events ?? [] }
  } catch {
    return empty
  }
}

let cache: DB = read()
const listeners = new Set<() => void>()

function write(next: DB) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Penyimpanan penuh atau diblokir: data tetap ada di memori selama sesi.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Hook React: komponen dirender ulang hanya saat data berubah. */
export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => cache)
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // tanpa 0/O/1/I agar mudah dibaca

function randomPart(len: number) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function eventPrefix(eventId: string) {
  return eventId
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, 'X')
}

export type RegisterInput = Omit<Registration, 'code' | 'registeredAt' | 'checkedInAt' | 'certificateNo'>

export type RegisterResult = { ok: true; registration: Registration } | { ok: false; reason: 'duplicate'; registration: Registration }

/** Mendaftarkan peserta. Pendaftaran ganda dicegah lewat pasangan (eventId, NIM). */
export function register(input: RegisterInput): RegisterResult {
  const db = cache
  const nim = input.nim.trim()
  const existing = db.registrations.find((r) => r.eventId === input.eventId && r.nim === nim)
  if (existing) return { ok: false, reason: 'duplicate', registration: existing }

  let code = ''
  do code = `NKT-${eventPrefix(input.eventId)}-${randomPart(4)}`
  while (db.registrations.some((r) => r.code === code))

  const registration: Registration = {
    ...input,
    name: input.name.trim(),
    nim,
    email: input.email.trim(),
    prodi: input.prodi.trim(),
    code,
    registeredAt: new Date().toISOString(),
  }
  write({ ...db, registrations: [registration, ...db.registrations] })
  return { ok: true, registration }
}

export function findByCode(code: string) {
  return cache.registrations.find((r) => r.code === code.trim().toUpperCase())
}

export type CheckInResult =
  | { kind: 'ok'; checkin: CheckIn }
  | { kind: 'dup'; checkin: CheckIn }
  | { kind: 'wrong-event'; code: string; eventId: string }
  | { kind: 'invalid'; code: string }

/**
 * Mencatat presensi. Data peserta diambil dari isi QR (lihat ticket.ts), sehingga
 * tiket yang dibuat di perangkat peserta tetap dapat divalidasi di perangkat panitia.
 */
export function checkIn(ticket: { code: string; eventId: string; name: string; nim: string } | null, rawCode: string, eventId: string): CheckInResult {
  const db = cache
  const local = ticket ?? (findByCode(rawCode) ? { ...findByCode(rawCode)! } : null)
  if (!local) return { kind: 'invalid', code: rawCode.trim().toUpperCase() }
  if (local.eventId !== eventId) return { kind: 'wrong-event', code: local.code, eventId: local.eventId }

  const prev = db.checkins.find((c) => c.code === local.code)
  if (prev) return { kind: 'dup', checkin: prev }

  const at = new Date().toISOString()
  const checkin: CheckIn = { code: local.code, eventId: local.eventId, name: local.name, nim: local.nim, at }
  const registrations = db.registrations.map((r) => (r.code === local.code ? { ...r, checkedInAt: at } : r))
  write({ ...db, registrations, checkins: [checkin, ...db.checkins] })
  return { kind: 'ok', checkin }
}

/** Nomor sertifikat dibuat sekali lalu disimpan, sehingga unduhan ulang memakai nomor yang sama. */
export function issueCertificate(code: string) {
  const db = cache
  const reg = db.registrations.find((r) => r.code === code)
  if (!reg || !reg.checkedInAt) return null
  if (reg.certificateNo) return reg
  const year = new Date(reg.checkedInAt).getFullYear()
  const certificateNo = `CERT/${eventPrefix(reg.eventId)}/${year}/${reg.code.slice(-4)}`
  const updated = { ...reg, certificateNo }
  write({ ...db, registrations: db.registrations.map((r) => (r.code === code ? updated : r)) })
  return updated
}

export function cancelRegistration(code: string) {
  const db = cache
  write({
    ...db,
    registrations: db.registrations.filter((r) => r.code !== code),
    checkins: db.checkins.filter((c) => c.code !== code),
  })
}

/** Acara yang dibuat panitia lewat panel (disimpan lokal, tampil di katalog publik). */
export function customEvents() {
  return cache.events
}

export function addEvent(e: EventItem) {
  write({ ...cache, events: [e, ...cache.events] })
}

export function removeEvent(id: string) {
  const db = cache
  const codes = new Set(db.registrations.filter((r) => r.eventId === id).map((r) => r.code))
  write({
    events: db.events.filter((e) => e.id !== id),
    registrations: db.registrations.filter((r) => r.eventId !== id),
    checkins: db.checkins.filter((c) => !codes.has(c.code)),
  })
}

export function resetAll() {
  write(empty)
}

const timeFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
export const formatDateTime = (iso: string) => timeFmt.format(new Date(iso))
