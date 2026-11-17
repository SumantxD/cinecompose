import { lazy, Suspense } from 'react'
import { Stage } from './Stage'
import { Overlay } from './Overlay'
import { studio } from './player'

const Studio = lazy(() => import('../studio/Studio').then((m) => ({ default: m.Studio })))
const CharacterLab = lazy(() => import('../characters/CharacterLab').then((m) => ({ default: m.CharacterLab })))
const characterStudio = import.meta.env.DEV && new URLSearchParams(window.location.search).has('characters')

export function App() {
  if (characterStudio) return <Suspense fallback={<div className="char-loading">Loading character lab…</div>}><CharacterLab /></Suspense>
  if (studio) return <Suspense><Studio /></Suspense>
  return (
    <main className="app">
      <Stage />
      <Overlay />
    </main>
  )
}
