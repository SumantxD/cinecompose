import type { FacialChannel } from './types.ts'
import type { SavedSpeech } from './lipsync.ts'
import { hash } from '../utils/random.ts'
import { validTimeline } from './lipsync.ts'

export interface FacePose {
  eyeOpen: number
  eyeWide: number
  eyeAsymmetry: number
  pupilX: number
  pupilY: number
  pupilAsymmetry: number
  pupilDilate: number
  pupilSpiral: number
  browRaise: number
  browAngle: number
  browAsymmetry: number
  mouthOpen: number
  mouthWidth: number
  mouthRound: number
  smile: number
  frown: number
  smileAsymmetry: number
  teeth: number
  tongue: number
  cheeks: number
  nose: number
  tears: number
  sweat: number
  bloodshot: number
  tremble: number
  distort: number
  squash: number
  headTilt: number
}

export const NEUTRAL_FACE: FacePose = {
  eyeOpen: 1, eyeWide: 1, eyeAsymmetry: 0,
  pupilX: 0, pupilY: 0, pupilAsymmetry: 0, pupilDilate: 1, pupilSpiral: 0,
  browRaise: 0, browAngle: 0, browAsymmetry: 0,
  mouthOpen: 0, mouthWidth: 0, mouthRound: 0, smile: 0, frown: 0, smileAsymmetry: 0,
  teeth: 0, tongue: 0, cheeks: 0, nose: 0,
  tears: 0, sweat: 0, bloodshot: 0, tremble: 0, distort: 0, squash: 0, headTilt: 0,
}

export const FACE_RANGES: Record<keyof FacePose, [number, number]> = {
  eyeOpen: [0, 1.65], eyeWide: [.65, 1.35], eyeAsymmetry: [-.8, .8],
  pupilX: [-1, 1], pupilY: [-1, 1], pupilAsymmetry: [-1, 1], pupilDilate: [.25, 1.65], pupilSpiral: [0, 1],
  browRaise: [-1.8, 1.8], browAngle: [-1.8, 1.8], browAsymmetry: [-1.5, 1.5],
  mouthOpen: [0, 1.15], mouthWidth: [-1, 1.5], mouthRound: [0, 1], smile: [0, 1.35], frown: [0, 1.2], smileAsymmetry: [-1, 1],
  teeth: [0, 1], tongue: [0, 1], cheeks: [0, 1], nose: [0, 1],
  tears: [0, 1], sweat: [0, 1], bloodshot: [0, 1], tremble: [0, 1], distort: [0, 1], squash: [0, 1], headTilt: [-1, 1],
}

export type PresetName = keyof typeof EXPRESSION_PRESETS
export interface ExpressionEvent {
  start: number
  duration: number
  preset: PresetName
  intensity: number
  transition: number
  exit: number
}
export interface FaceSettings {
  preset?: PresetName
  intensity?: number
  controls?: Partial<FacePose>
  events?: ExpressionEvent[]
  speech?: SavedSpeech
  eyeTracking?: boolean
  idle?: boolean
}

export const PRESET_GROUPS: { category: string; presets: PresetName[] }[] = [
  { category: 'Funny', presets: ['goofy', 'cross-eyed', 'laughing', 'smug', 'confused', 'suspicious', 'disgusted', 'derpy', 'dizzy', 'crying'] },
  { category: 'Horror', presets: ['terrified', 'possessed', 'psychotic', 'uncanny', 'dead', 'twitch', 'jaw-drop', 'bloodshot', 'frozen', 'panic'] },
  { category: 'Cinematic', presets: ['realising', 'look-behind', 'shock', 'holding-tears', 'forced-smile', 'becoming-possessed', 'frozen-reaction'] },
]

export const EXPRESSION_PRESETS: Record<string, Partial<FacePose>> = {
  neutral: {},
  goofy: { eyeAsymmetry: .2, pupilX: .3, pupilY: .16, pupilAsymmetry: -.5, browRaise: .45, mouthOpen: .2, mouthWidth: .35, smile: .65, teeth: .5, tongue: .28, headTilt: -.22 },
  'cross-eyed': { pupilX: 0, pupilAsymmetry: 1, browRaise: .35, browAsymmetry: .25, mouthOpen: .09, mouthWidth: .18, smile: .25, headTilt: -.15 },
  laughing: { eyeOpen: .36, eyeWide: .95, browRaise: .35, mouthOpen: .68, mouthWidth: .85, smile: .9, teeth: .9, tongue: .45, cheeks: .35, squash: .12, tremble: .24 },
  smug: { eyeOpen: .66, pupilX: -.22, browRaise: .55, browAsymmetry: .65, mouthWidth: .32, smile: .5, smileAsymmetry: .85, headTilt: .12 },
  confused: { eyeOpen: 1.1, eyeAsymmetry: -.13, pupilX: .42, pupilAsymmetry: .8, browRaise: .55, browAsymmetry: .8, mouthOpen: .08, mouthWidth: -.18, frown: .15, headTilt: -.3 },
  suspicious: { eyeOpen: .5, pupilX: -.55, browRaise: -.18, browAngle: .6, browAsymmetry: .5, mouthWidth: -.15, frown: .28, headTilt: .12 },
  disgusted: { eyeOpen: .64, pupilY: -.15, browAngle: .38, mouthWidth: -.24, frown: .65, nose: .7, mouthOpen: .12, headTilt: .15 },
  derpy: { eyeOpen: 1.15, eyeAsymmetry: .32, pupilY: -.3, pupilAsymmetry: .75, browAsymmetry: .7, mouthOpen: .32, mouthWidth: .4, smile: .5, tongue: .7, headTilt: .3 },
  dizzy: { eyeOpen: 1.05, pupilSpiral: 1, pupilDilate: .65, browRaise: .55, mouthOpen: .17, mouthWidth: .35, headTilt: .4, squash: .18, tremble: .12 },
  crying: { eyeOpen: .48, browRaise: .6, browAngle: -.75, mouthOpen: .5, mouthWidth: -.18, frown: .72, tears: .85, squash: .15, tremble: .35 },
  terrified: { eyeOpen: 1.5, eyeWide: 1.18, pupilDilate: .28, browRaise: 1.15, mouthOpen: .65, mouthWidth: .65, frown: .45, teeth: .8, sweat: .45, tremble: .35, distort: .12 },
  possessed: { eyeOpen: 1.45, pupilDilate: .2, pupilAsymmetry: .35, browRaise: -.2, browAngle: .65, mouthOpen: .22, mouthWidth: .65, smile: 1.1, smileAsymmetry: .7, teeth: .8, bloodshot: .7, distort: .75, headTilt: .45 },
  psychotic: { eyeOpen: 1.3, browAngle: .55, browAsymmetry: .35, mouthWidth: 1.15, smile: 1.25, teeth: 1, bloodshot: .55, distort: .55, headTilt: -.25 },
  uncanny: { eyeOpen: 1.2, pupilDilate: 1.4, pupilAsymmetry: .1, browRaise: .2, mouthWidth: .8, smile: .85, eyeAsymmetry: -.15, distort: .35, headTilt: -.45 },
  dead: { eyeOpen: 1.08, eyeAsymmetry: -.12, pupilDilate: 1.2, browRaise: -.22, mouthOpen: .13, mouthRound: .2, bloodshot: .2, distort: .1 },
  twitch: { eyeOpen: 1.22, eyeAsymmetry: .35, browRaise: .55, browAsymmetry: .5, mouthOpen: .1, mouthWidth: -.25, frown: .3, tremble: .65 },
  'jaw-drop': { eyeOpen: 1.4, eyeWide: 1.15, pupilDilate: .5, browRaise: 1.3, mouthOpen: 1, mouthWidth: .35, mouthRound: .35, teeth: .9, tongue: .5, squash: .1 },
  bloodshot: { eyeOpen: 1.24, eyeWide: 1.1, pupilDilate: .45, browRaise: .65, mouthOpen: .16, frown: .45, bloodshot: 1, distort: .18 },
  frozen: { eyeOpen: 1.48, eyeWide: 1.17, pupilDilate: .25, browRaise: .9, mouthOpen: .1, mouthWidth: -.5, sweat: .5, distort: .08 },
  panic: { eyeOpen: 1.65, eyeWide: 1.3, pupilDilate: .2, pupilAsymmetry: .3, browRaise: 1.5, mouthOpen: .85, mouthWidth: .65, frown: .6, teeth: .8, sweat: .8, tremble: .8 },
  realising: { eyeOpen: 1.25, pupilDilate: .8, browRaise: .6, mouthOpen: .12, mouthWidth: -.12, sweat: .1 },
  'look-behind': { eyeOpen: 1.1, pupilX: .85, browRaise: .35, mouthOpen: .1, headTilt: .35 },
  shock: { eyeOpen: 1.5, eyeWide: 1.2, pupilDilate: .35, browRaise: 1.25, mouthOpen: .95, mouthWidth: .5, teeth: .8, squash: .25 },
  'holding-tears': { eyeOpen: .84, eyeWide: 1.12, pupilY: -.2, pupilDilate: .9, browRaise: .75, browAngle: -.45, mouthOpen: .04, mouthWidth: -.3, frown: .45, tears: .5, tremble: .15 },
  'forced-smile': { eyeOpen: .92, browRaise: .3, browAngle: -.15, mouthWidth: .55, smile: .8, smileAsymmetry: .15, teeth: .4, eyeAsymmetry: -.1, sweat: .12 },
  'becoming-possessed': { eyeOpen: 1.25, pupilDilate: .45, browAngle: .35, mouthWidth: .65, smile: .65, bloodshot: .45, distort: .45, headTilt: .25 },
  'frozen-reaction': { eyeOpen: 1.32, eyeWide: 1.1, browRaise: .6, mouthOpen: .27, mouthWidth: .2, distort: .08, squash: .12 },
}

const clamp = (value: number, range: [number, number]) => Math.max(range[0], Math.min(range[1], value))
const ease = (value: number) => { const t = clamp(value, [0, 1]); return t * t * (3 - 2 * t) }

export function mixFace(base: FacePose, next: Partial<FacePose>, amount: number, out: FacePose): FacePose {
  for (const key of Object.keys(NEUTRAL_FACE) as (keyof FacePose)[]) out[key] = clamp(base[key] + ((next[key] ?? NEUTRAL_FACE[key]) - base[key]) * amount, FACE_RANGES[key])
  return out
}

export function presetPose(name: PresetName, intensity: number, out: FacePose): FacePose {
  return mixFace(NEUTRAL_FACE, EXPRESSION_PRESETS[name] ?? {}, clamp(intensity, [0, 1]), out)
}

export function validFaceSettings(value: unknown, duration: number): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const settings = value as FaceSettings
  if (settings.preset !== undefined && !Object.hasOwn(EXPRESSION_PRESETS, settings.preset)) return false
  if (settings.intensity !== undefined && (!Number.isFinite(settings.intensity) || settings.intensity < 0 || settings.intensity > 1)) return false
  if (settings.controls !== undefined) {
    if (typeof settings.controls !== 'object' || settings.controls === null || Array.isArray(settings.controls)) return false
    for (const [key, amount] of Object.entries(settings.controls)) {
      const bounds = FACE_RANGES[key as keyof FacePose]
      if (!bounds || !Number.isFinite(amount) || amount < bounds[0] || amount > bounds[1]) return false
    }
  }
  if (settings.events !== undefined) {
    if (!Array.isArray(settings.events) || settings.events.length > 16) return false
    for (const event of settings.events) {
      if (!event || typeof event !== 'object') return false
      if (!Object.hasOwn(EXPRESSION_PRESETS, event.preset) || !Number.isFinite(event.start) || !Number.isFinite(event.duration) || event.start < 0 || event.duration <= 0 || event.start + event.duration > duration + .001
        || !Number.isFinite(event.intensity) || event.intensity < 0 || event.intensity > 1 || !Number.isFinite(event.transition) || event.transition < 0 || event.transition > event.duration || !Number.isFinite(event.exit) || event.exit < 0 || event.exit > event.duration) return false
    }
  }
  if (settings.speech !== undefined) {
    if (typeof settings.speech !== 'object' || settings.speech === null || !['reactive','viseme'].includes(settings.speech.mode)
      || !Number.isFinite(settings.speech.intensity) || settings.speech.intensity < 0 || settings.speech.intensity > 1
      || settings.speech.fileName !== undefined && (typeof settings.speech.fileName !== 'string' || settings.speech.fileName.length > 240)
      || settings.speech.timeline !== undefined && !validTimeline(settings.speech.timeline)) return false
  }
  if (settings.eyeTracking !== undefined && typeof settings.eyeTracking !== 'boolean') return false
  if (settings.idle !== undefined && typeof settings.idle !== 'boolean') return false
  return true
}

export function legacyFace(values: Record<FacialChannel, number>, out: FacePose): FacePose {
  out.mouthOpen = values.mouthOpen
  out.smile = values.smile
  out.frown = values.frown
  out.eyeOpen = values.eyes / .65
  out.browAngle = values.browAngle
  out.browRaise = values.browRaise
  out.pupilX = values.eyeShift
  return out
}

export function sampleSequence(events: ExpressionEvent[], time: number, out: FacePose): FacePose {
  Object.assign(out, NEUTRAL_FACE)
  for (const event of events) {
    const local = time - event.start
    if (local < 0 || local > event.duration) continue
    const enter = event.transition > 0 ? ease(local / event.transition) : 1
    const leave = event.exit > 0 ? ease((event.duration - local) / event.exit) : 1
    mixFace(out, EXPRESSION_PRESETS[event.preset], Math.min(enter, leave) * event.intensity, out)
  }
  return out
}

export interface FaceSpeech {
  open: number
  width: number
  round: number
  emphasis: number
  intensity: number
  active: boolean
}
export interface FaceAdapter {
  kind: 'procedural' | 'morph' | 'vrm' | 'none'
  apply: (pose: FacePose, time: number) => void
  dispose?: () => void
}

export class FacialAnimationController {
  readonly adapter: FaceAdapter
  readonly pose: FacePose = { ...NEUTRAL_FACE }
  private readonly from: FacePose = { ...NEUTRAL_FACE }
  private readonly goal: FacePose = { ...NEUTRAL_FACE }
  private readonly emotion: FacePose = { ...NEUTRAL_FACE }
  private readonly legacy: FacePose = { ...NEUTRAL_FACE }
  private anchor = 0
  private transition = .25
  private useLegacy = true
  private bound?: FaceSettings
  private trackCamera = false
  private lookX = 0
  private lookY = 0
  private manualBlink = -1
  seed = 0
  idle = true

  constructor(adapter: FaceAdapter) { this.adapter = adapter }

  setPreset(preset: PresetName, intensity = .85, time = 0, transition = .28): void {
    Object.assign(this.from, this.pose)
    presetPose(preset, Number.isFinite(intensity) ? intensity : .85, this.goal)
    this.useLegacy = false
    this.anchor = time
    this.transition = Math.max(0, Number.isFinite(transition) ? transition : .28)
    this.bound = undefined
  }

  setLegacy(values: Record<FacialChannel, number>): void { legacyFace(values, this.legacy) }
  setEyeTarget(x: number, y: number): void { this.lookX = x; this.lookY = y }
  blink(time: number): void { this.manualBlink = time }

  bind(settings?: FaceSettings, time = 0, immediate = false): void {
    if (settings === this.bound) return
    this.bound = undefined
    this.trackCamera = settings?.eyeTracking === true
    this.idle = settings?.idle !== false
    if (!settings || !settings.preset && !settings.controls && !settings.events?.length) { this.useLegacy = true; this.bound = settings; return }
    this.setPreset(settings.preset ?? 'neutral', settings.intensity ?? .85, time, immediate ? 0 : .25)
    Object.assign(this.goal, settings.controls)
    this.bound = settings
  }

  update(time: number, sequence: ExpressionEvent[] | undefined, speech?: FaceSpeech): FacePose {
    if (sequence?.length) sampleSequence(sequence, time, this.emotion)
    else if (this.useLegacy) Object.assign(this.emotion, this.legacy)
    else Object.assign(this.emotion, this.goal)
    const dt = Math.max(0, time - this.anchor), speed = Math.min(1, dt / Math.max(.001, this.transition))
    const spring = this.transition <= 0 ? 1 : speed >= 1 ? 1 : 1 - Math.exp(-9 * speed) * (Math.cos(18 * speed) + .5 * Math.sin(18 * speed))
    mixFace(this.from, this.emotion, spring, this.pose)
    if (this.idle) {
      const cycle = Math.floor(time / 3.2)
      const phase = time - cycle * 3.2, offset = .25 + hash(cycle + this.seed * 79) * 2.2
      const blink = phase >= offset && phase < offset + .15 ? Math.sin((phase - offset) / .15 * Math.PI) : 0
      this.pose.eyeOpen *= 1 - blink * .96
      if (speech?.active) {
        const index = Math.floor(time * 1.7), amount = hash(index + this.seed * 97) - .5
        this.pose.pupilX += amount * .06
        this.pose.browRaise += (hash(index + 71) - .5) * speech.emphasis * .14
      }
    }
    const manualAge = time - this.manualBlink, forced = manualAge >= 0 && manualAge < .18 ? Math.sin(manualAge / .18 * Math.PI) : 0
    this.pose.eyeOpen *= 1 - forced * .96
    if (this.trackCamera) {
      this.pose.pupilX = clamp(this.pose.pupilX + this.lookX, FACE_RANGES.pupilX)
      this.pose.pupilY = clamp(this.pose.pupilY + this.lookY, FACE_RANGES.pupilY)
    }
    if (speech?.active) {
      this.pose.mouthOpen = Math.max(this.pose.mouthOpen, speech.open * speech.intensity)
      this.pose.mouthWidth += (speech.width * speech.intensity - this.pose.mouthWidth) * .38 * (1 - this.pose.mouthRound)
      this.pose.mouthRound = Math.max(this.pose.mouthRound, speech.round * speech.intensity)
      this.pose.teeth = Math.max(this.pose.teeth, speech.open > .3 ? .7 : .14)
    }
    this.adapter.apply(this.pose, time)
    return this.pose
  }

  dispose(): void { this.adapter.dispose?.() }
}
