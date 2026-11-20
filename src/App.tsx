import { lazy, Suspense, type ReactNode } from 'react'
import { PublicLayout } from './components/PublicLayout'
import { useHashPath } from './lib/router'
import { Landing } from './pages/Landing'

// Code splitting: setiap halaman dimuat hanya saat dibuka, sehingga beranda tidak ikut
// mengunduh kode panel penyelenggara, pustaka grafik, atau pemindai QR.
const named = <T extends Record<string, unknown>, K extends keyof T>(p: Promise<T>, k: K) => p.then((m) => ({ default: m[k] as React.ComponentType<any> }))
const Events = lazy(() => named(import('./pages/Events'), 'Events'))
const EventDetail = lazy(() => named(import('./pages/EventDetail'), 'EventDetail'))
const MyTicket = lazy(() => named(import('./pages/MyTicket'), 'MyTicket'))
const Certificates = lazy(() => named(import('./pages/Certificates'), 'Certificates'))
const OrganizerLayout = lazy(() => named(import('./components/OrganizerLayout'), 'OrganizerLayout'))
const Dashboard = lazy(() => named(import('./pages/organizer/Dashboard'), 'Dashboard'))
const ManageEvents = lazy(() => named(import('./pages/organizer/ManageEvents'), 'ManageEvents'))
const Participants = lazy(() => named(import('./pages/organizer/Participants'), 'Participants'))
const Scanner = lazy(() => named(import('./pages/organizer/Scanner'), 'Scanner'))
const Impact = lazy(() => named(import('./pages/organizer/Impact'), 'Impact'))

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500 dark:text-slate-400" role="status">
      Memuat…
    </div>
  )
}

function organizerPage(path: string) {
  switch (path) {
    case '/panel/acara':
      return <ManageEvents />
    case '/panel/peserta':
      return <Participants />
    case '/panel/pindai':
      return <Scanner />
    case '/panel/dampak':
      return <Impact />
    default:
      return <Dashboard />
  }
}

function publicPage(path: string): ReactNode {
  if (path.startsWith('/acara/')) return <EventDetail id={decodeURIComponent(path.slice('/acara/'.length))} />
  switch (path) {
    case '/acara':
      return <Events />
    case '/tiket':
      return <MyTicket />
    case '/sertifikat':
      return <Certificates />
    default:
      return <Landing />
  }
}

export default function App() {
  const path = useHashPath()
  if (path.startsWith('/panel'))
    return (
      <Suspense fallback={<Loading />}>
        <OrganizerLayout path={path}>
          <Suspense fallback={<Loading />}>{organizerPage(path)}</Suspense>
        </OrganizerLayout>
      </Suspense>
    )
  return (
    <PublicLayout path={path}>
      <Suspense fallback={<Loading />}>{publicPage(path)}</Suspense>
    </PublicLayout>
  )
}
