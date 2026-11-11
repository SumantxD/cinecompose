import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { useStore } from './state/store'
import './app/styles.css'

if (matchMedia('(pointer: coarse)').matches || navigator.hardwareConcurrency <= 4) useStore.getState().set({ quality: 'low' })

createRoot(document.getElementById('root')!).render(<App />)

if (import.meta.env.DEV) {
  // Dev console helpers: kr.start('arrival'), kr.skip(12), kr.choose(0)
  import('./app/player').then((p) => {
    const skip = (s: number) => { for (let i = 0; i < s * 10; i++) p.tick(0.1) }
    // Proxy keeps the module's live bindings (kr.lighting is always the current scene's).
    Object.assign(window, { kr: new Proxy(p, { get: (t, k) => (k === 'skip' ? skip : t[k as keyof typeof p]) }) })
  })
}

if (import.meta.env.DEV) {
  // ?auto=0,1,1 — picks those choices in order (for recording/analysing playthroughs: scripts/analyze-video.sh)
  const auto = new URLSearchParams(location.search).get('auto')?.split(',').map(Number)
  if (auto)
    useStore.subscribe((s, prev) => {
      if (s.phase === 'choice' && prev.phase !== 'choice' && auto.length) {
        const pick = auto.shift()!
        setTimeout(() => import('./app/player').then((p) => p.choose(s.choices[pick]?.index ?? 0)), 1500)
      }
    })
}
