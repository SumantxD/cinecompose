import { lazy, Suspense } from 'react'
import { Stage } from './Stage'
import { Overlay } from './Overlay'
import { studio } from './player'

const Studio = lazy(() => import('../studio/Studio').then((m) => ({ default: m.Studio })))

export function App() {
  if (studio) return <Suspense><Studio /></Suspense>
  return (
    <main className="app">
      <Stage />
      <Overlay />
    </main>
  )
}
