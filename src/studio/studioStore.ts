import { create } from 'zustand'
import type * as THREE from 'three'
import type { SceneConfig } from '../cinematic/types'
import { SCENES } from '../scenes/registry'

// Studio state: the scene being edited (a working copy), undo/redo, playhead, selection, view options.
// Edits never touch the live SCENES map until Save writes the JSON file.

export type Selection = { kind: 'shot' | 'cue'; index: number } | null

interface StudioState {
  sceneId: string
  cfg: SceneConfig
  saved: string // JSON of the last saved/loaded version, to show "unsaved changes"
  past: string[]
  future: string[]
  t: number
  playing: boolean
  free: boolean
  aspect: '9:16' | '16:9'
  sel: Selection
  /** Live handles set from inside the Canvas (StudioRig). */
  camera: THREE.PerspectiveCamera | null
  target: THREE.Vector3 | null
  load: (sceneId: string) => void
  /** Apply an edit (pushes undo history). */
  edit: (fn: (c: SceneConfig) => void) => void
  undo: () => void
  redo: () => void
  set: (p: Partial<StudioState>) => void
}

const KEY = 'kr-studio'
const remembered = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as { sceneId?: string; t?: number; aspect?: '9:16' | '16:9' }
  } catch {
    return {}
  }
})()

const clone = (c: SceneConfig) => JSON.parse(JSON.stringify(c)) as SceneConfig
const first = remembered.sceneId && SCENES.has(remembered.sceneId) ? remembered.sceneId : [...SCENES.keys()][0]

export const useStudio = create<StudioState>((set, get) => ({
  sceneId: first,
  cfg: clone(SCENES.get(first)!),
  saved: JSON.stringify(SCENES.get(first)),
  past: [],
  future: [],
  t: remembered.t ?? 0,
  playing: false,
  free: false,
  aspect: remembered.aspect ?? '9:16',
  sel: null,
  camera: null,
  target: null,
  load: (sceneId) => {
    const c = SCENES.get(sceneId)!
    set({ sceneId, cfg: clone(c), saved: JSON.stringify(c), past: [], future: [], t: 0, sel: null, playing: false })
  },
  edit: (fn) => {
    const before = JSON.stringify(get().cfg)
    const next = clone(get().cfg)
    fn(next)
    next.duration = +next.shots.reduce((a, s) => a + s.duration, 0).toFixed(3) // scene length = its shots
    set({ cfg: next, past: [...get().past.slice(-99), before], future: [] })
  },
  undo: () => {
    const { past, cfg, future } = get()
    if (!past.length) return
    set({ cfg: JSON.parse(past.at(-1)!), past: past.slice(0, -1), future: [JSON.stringify(cfg), ...future] })
  },
  redo: () => {
    const { past, cfg, future } = get()
    if (!future.length) return
    set({ cfg: JSON.parse(future[0]), future: future.slice(1), past: [...past, JSON.stringify(cfg)] })
  },
  set: (p) => set(p),
}))

useStudio.subscribe((s) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ sceneId: s.sceneId, t: s.t, aspect: s.aspect }))
  } catch {
    /* private mode: no memory, still works */
  }
})
