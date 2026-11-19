import type { Cue, LightMode, Vec3 } from '../cinematic/types.ts'

export type CceCategory = 'camera' | 'editing' | 'reaction' | 'horror' | 'audio' | 'environment' | 'editorial' | 'composite'
export type CceEvent = 'sound-behind' | 'discovery' | 'entity-appears' | 'entity-vanishes' | 'chase' | 'jumpscare' | 'unease' | 'realisation' | 'watched' | 'environment-reacts'
export type CceEase = 'linear' | 'out' | 'inOut'
export type CceAxis = 'dolly' | 'truck' | 'lift' | 'orbit' | 'yaw' | 'pitch' | 'roll' | 'fov'

interface Timed { at: number; duration: number }
export type CceAction =
  | (Timed & { kind: 'camera'; axis: CceAxis; amount: number; pulse?: boolean; ease?: CceEase })
  | (Timed & { kind: 'shake'; amount: number; frequency?: number })
  | (Timed & { kind: 'chromatic' | 'flash' | 'blackout'; amount: number; pulse?: boolean })
  | (Timed & { kind: 'text' })
  | { kind: 'sfx'; at: number; sound: string; volume: number; behind?: boolean }
  | { kind: 'entity'; at: number; hold: number; visible: boolean; shadowOnly?: boolean }
  | { kind: 'light'; at: number; hold: number; mode: LightMode }
  | { kind: 'ambience'; at: number; hold: number; sound: string; volume: number; fade: number }

export interface CceTemplate {
  id: string
  name: string
  category: CceCategory
  description: string
  events: CceEvent[]
  duration: number
  intensity: number
  cost: 'free' | 'low' | 'medium'
  cooldown: number
  requires?: ('entity' | 'light' | 'text')[]
  combines?: string[]
  actions: CceAction[]
}

export interface CceClip {
  id: string
  template: string
  at: number
  duration: number
  intensity: number
  seed: number
  /** 0–1 deterministic per-parameter variation. */
  variation: number
  entity?: string
  light?: string
  position?: Vec3
  /** Editorial text only; never generated dialogue or an Ink choice. */
  text?: string
}

export interface CceTrack { version: 1; clips: CceClip[] }

export interface CceFrame {
  dolly: number; truck: number; lift: number; orbit: number
  yaw: number; pitch: number; roll: number; fov: number
  chromatic: number; flash: number; blackout: number
  text: string | null
}

export interface CceContext {
  event: CceEvent
  intensity: number
  subjectDistance: number
  seed: number
  recent?: { id: string; ago: number }[]
}

export const EMPTY_CCE_FRAME: CceFrame = { dolly: 0, truck: 0, lift: 0, orbit: 0, yaw: 0, pitch: 0, roll: 0, fov: 0, chromatic: 0, flash: 0, blackout: 0, text: null }
export const axis = (at: number, duration: number, axis: CceAxis, amount: number, pulse = false, ease: CceEase = 'out'): CceAction => ({ kind: 'camera', at, duration, axis, amount, pulse, ease })
export const effect = (kind: 'chromatic' | 'flash' | 'blackout', at: number, duration: number, amount: number): CceAction => ({ kind, at, duration, amount, pulse: true })
export const shake = (at: number, duration: number, amount: number, frequency = 9): CceAction => ({ kind: 'shake', at, duration, amount, frequency })
export const sfx = (at: number, sound: string, volume = .2, behind = false): CceAction => ({ kind: 'sfx', at, sound, volume, behind })
export const cue = (at: number, action: Cue): Cue => ({ ...action, at })
