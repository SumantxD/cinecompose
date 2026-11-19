import { create } from 'zustand'
import type * as THREE from 'three'
import type { SceneConfig } from '../cinematic/types'
import { validateScene } from '../cinematic/validate.ts'
import { SCENES } from '../scenes/registry'
import type { ViewMode } from './viewpoints.ts'
import { reconcileReferenceFrames } from '../reference/compose.ts'

// Studio state: one recoverable working copy, undo/redo, selection and 3D authoring guides.

export type Selection = { kind: 'shot' | 'cue'; index: number; node?: number } | null

export interface StudioState {
  sceneId: string
  cfg: SceneConfig
  saved: string
  past: string[]
  future: string[]
  t: number
  playing: boolean
  exporting: boolean
  guides: boolean
  navSpeed: number
  /** Timeline pixels per second. Zoom scales the whole timeline. */
  timelineZoom: number
  /** Snap playhead and cue drags to shot boundaries, cue times and a 0.05s grid. */
  snap: boolean
  cameraEnd: boolean
  editAim: boolean
  gizmoDragging: boolean
  view: ViewMode
  aspect: '9:16' | '16:9'
  panelTab: 'scene' | 'render' | 'world' | 'fx' | 'choreography'
  /** Live renderer telemetry for the render panel. Editor-only; not visual clock state. */
  metrics?: { fps: number; calls: number; triangles: number; textures: number; geometries: number; programs: number }
  sel: Selection
  pointLocks: Record<string, { index: number; node: number }>
  /** Selected clip in the CCE lane; opens the live Choreography Studio. */
  cceSelection: number | null
  camera: THREE.Camera | null
  target: THREE.Vector3 | null
  load: (sceneId: string) => void
  /** One editing transaction. Use begin/change for continuous 3D drags. */
  edit: (fn: (c: SceneConfig) => void) => void
  begin: () => void
  change: (fn: (c: SceneConfig) => void) => void
  replace: (cfg: SceneConfig) => void
  undo: () => void
  redo: () => void
  set: (p: Partial<StudioState>) => void
}

const KEY = 'kr-studio'
const remembered = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as { sceneId?: string; t?: number; aspect?: '9:16' | '16:9'; panelTab?: 'scene' | 'render' | 'world' | 'fx' | 'choreography' }
  } catch {
    return {}
  }
})()

const clone = (c: SceneConfig) => JSON.parse(JSON.stringify(c)) as SceneConfig
const updateDuration = (c: SceneConfig) => { c.duration = +c.shots.reduce((a, s) => a + s.duration, 0).toFixed(3) }

function restored(sceneId: string) {
  const original = SCENES.get(sceneId)!
  const saved = JSON.stringify(original)
  try {
    const draft = JSON.parse(localStorage.getItem(`${KEY}-draft:${sceneId}`) ?? 'null') as { base?: string; cfg?: SceneConfig } | null
    if (draft?.base === saved && draft.cfg?.sceneId === sceneId && !validateScene(draft.cfg).length)
      return { cfg: clone(draft.cfg), saved }
  } catch { /* ignore damaged or unavailable local drafts */ }
  return { cfg: clone(original), saved }
}

const direct = new URLSearchParams(location.search).get('scene')
const first = SCENES.has(direct ?? '') ? direct! : remembered.sceneId && SCENES.has(remembered.sceneId) ? remembered.sceneId : [...SCENES.keys()][0]
const initial = restored(first)

export const useStudio = create<StudioState>((set, get) => ({
  sceneId: first,
  cfg: initial.cfg,
  saved: initial.saved,
  past: [],
  future: [],
  t: Math.min(remembered.t ?? 0, initial.cfg.duration),
  playing: false,
  exporting: false,
  guides: true,
  navSpeed: 1,
  timelineZoom: 26,
  snap: true,
  cameraEnd: false,
  editAim: false,
  gizmoDragging: false,
  view: 'orbit',
  aspect: remembered.aspect ?? '9:16',
  panelTab: remembered.panelTab && ['scene', 'render', 'world', 'fx', 'choreography'].includes(remembered.panelTab) ? remembered.panelTab : 'scene',
  sel: null,
  pointLocks: {},
  cceSelection: null,
  camera: null,
  target: null,
  load: (sceneId) => {
    if (get().exporting) return
    const url = new URL(location.href)
    if (url.searchParams.has('studio')) { url.searchParams.set('scene', sceneId); history.replaceState(null, '', url) }
    const r = restored(sceneId)
    set({ sceneId, cfg: r.cfg, saved: r.saved, past: [], future: [], t: 0, sel: null, cceSelection: null, playing: false, cameraEnd: false, view: 'orbit' })
  },
  edit: (fn) => { get().begin(); get().change(fn) },
  begin: () => {
    if (get().exporting) return
    const { cfg, past } = get()
    set({ past: [...past.slice(-99), JSON.stringify(cfg)], future: [] })
  },
  change: (fn) => {
    if (get().exporting) return
    const next = clone(get().cfg)
    fn(next)
    reconcileReferenceFrames(next)
    updateDuration(next)
    set({ cfg: next })
  },
  replace: (cfg) => {
    if (get().exporting) return
    const next = clone(cfg)
    reconcileReferenceFrames(next)
    updateDuration(next)
    set({ cfg: next, past: [...get().past.slice(-99), JSON.stringify(get().cfg)], future: [], sel: null })
  },
  undo: () => {
    if (get().exporting) return
    const { past, cfg, future } = get()
    if (!past.length) return
    set({ cfg: JSON.parse(past.at(-1)!), past: past.slice(0, -1), future: [JSON.stringify(cfg), ...future] })
  },
  redo: () => {
    if (get().exporting) return
    const { past, cfg, future } = get()
    if (!future.length) return
    set({ cfg: JSON.parse(future[0]), future: future.slice(1), past: [...past, JSON.stringify(cfg)] })
  },
  set: (p) => set(p),
}))

useStudio.subscribe((s) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ sceneId: s.sceneId, t: s.t, aspect: s.aspect, panelTab: s.panelTab }))
    const key = `${KEY}-draft:${s.sceneId}`
    if (JSON.stringify(s.cfg) !== s.saved) localStorage.setItem(key, JSON.stringify({ base: s.saved, cfg: s.cfg }))
    else localStorage.removeItem(key)
  } catch { /* private mode: editing still works, recovery is unavailable */ }
})
