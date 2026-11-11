import { create } from 'zustand'
import type { LightMode, Vec3 } from '../cinematic/types'

export interface Caption {
  speaker: string
  text: string
}

export interface ChoiceOption {
  index: number
  text: string
  dir?: string
}

interface EntityState {
  visible: boolean
  position?: Vec3
  tilt: number
  /** m/s toward `position` from wherever she was; 0 = she is simply there. */
  speed?: number
  /** Glide start; defaults to wherever she currently is. */
  from?: Vec3
  /** Invisible body that still casts a shadow. */
  shadowOnly?: boolean
  rotationY?: number
  /** Actors: 'walk' | 'idle' | 'sit' (default: walk while moving, else idle). */
  anim?: string
  /** Actors: head turn in radians (+ = his left). */
  headYaw?: number
  /** clock.t when this state was set (deterministic movement). */
  since?: number
}

export type Phase = 'gate' | 'playing' | 'choice' | 'ended' | 'dead'
export type Quality = 'high' | 'low'

interface State {
  phase: Phase
  quality: Quality
  muted: boolean
  sceneId: string | null
  caption: Caption | null
  choices: ChoiceOption[]
  showTitle: boolean
  /** Death screen line, from the Ink `# dead` line. */
  epitaph: string | null
  /** A checkpoint exists to return to. */
  canRetry: boolean
  /** 0 = clear, 1 = black. Driven by `fade` cues. */
  blackout: number
  lights: Record<string, LightMode>
  entities: Record<string, EntityState>
  flags: Record<string, unknown>
  set: (patch: Partial<State>) => void
  setLight: (id: string, mode: LightMode) => void
  setEntity: (id: string, e: Partial<EntityState>) => void
}

export const useStore = create<State>((set) => ({
  phase: 'gate',
  quality: 'high',
  muted: false,
  sceneId: null,
  caption: null,
  choices: [],
  showTitle: false,
  epitaph: null,
  canRetry: false,
  blackout: 1,
  lights: {},
  entities: {},
  flags: {},
  set: (patch) => set(patch),
  setLight: (id, mode) => set((s) => ({ lights: { ...s.lights, [id]: mode } })),
  setEntity: (id, e) =>
    set((s) => ({ entities: { ...s.entities, [id]: { ...(s.entities[id] ?? { visible: false, tilt: 0 }), ...e } } })),
}))
