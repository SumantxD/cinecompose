export type Vec3 = [number, number, number]
export type QuaternionValue = [number, number, number, number]
export type IKTarget = 'leftHand' | 'rightHand'

export const BONE_NAMES = ['root','hips','spine','chest','neck','head','leftShoulder','leftElbow','leftWrist','rightShoulder','rightElbow','rightWrist','leftHip','leftKnee','leftAnkle','rightHip','rightKnee','rightAnkle'] as const
export type BoneName = (typeof BONE_NAMES)[number]

export interface CharacterMotion {
  movement: 'idle' | 'walk' | 'creep'
  speed: number
  posture: 'neutral' | 'tense' | 'disturbed'
  expression: 'neutral' | 'fear' | 'angry' | 'dazed'
  gaze: 'forward' | 'camera' | 'target' | 'manual'
  breathing: 'normal' | 'heavy' | 'still'
  headMovement: 'steady' | 'unpredictable'
  groundContact: boolean
  reach?: Partial<Record<IKTarget, Vec3>>
  lookAt?: Vec3
  seed?: number
}

export const DEFAULT_MOTION: CharacterMotion = {
  movement: 'idle', speed: 0.4, posture: 'neutral', expression: 'neutral',
  gaze: 'forward', breathing: 'normal', headMovement: 'steady', groundContact: true,
}

export interface RotationKey { t: number; q: QuaternionValue }
export interface PositionKey { t: number; v: Vec3 }
export interface BoneTrack { rotation?: RotationKey[]; position?: PositionKey[] }
export type FacialChannel = 'mouthOpen' | 'smile' | 'frown' | 'eyes' | 'browAngle' | 'browRaise' | 'eyeShift'
export interface ScalarKey { t: number; v: number }
export interface AnimationSource { id: string; version: 1; speed: number; strength: number; mirror: boolean }
export interface CharacterClip {
  id: string
  name: string
  duration: number
  motion: CharacterMotion
  tracks: Record<string, BoneTrack>
  targets: Partial<Record<IKTarget, PositionKey[]>>
  face?: Partial<Record<FacialChannel, ScalarKey[]>>
  faceHead?: Vec3
  loop?: boolean
  source?: AnimationSource
  libraryId?: string
}

export interface AnimationContext {
  cameraPosition?: import('three').Vector3
  groundY?: number
  clip?: CharacterClip
  clipTime?: number
  transitionSeconds?: number
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const option = (value: unknown, values: readonly string[]) => value === undefined || (typeof value === 'string' && values.includes(value))
const vector = (value: unknown, size: number): boolean => Array.isArray(value) && value.length === size && value.every(finite)
const bones = new Set<string>(BONE_NAMES)
const positions = (value: unknown, duration: number): boolean => Array.isArray(value) && value.every((key, index, all) => object(key) && finite(key.t) && key.t >= 0 && key.t <= duration && (!index || key.t > all[index - 1].t) && vector(key.v, 3))

export function validMotion(motion: Partial<CharacterMotion> | undefined): boolean {
  if (!object(motion)) return false
  return option(motion.movement, ['idle', 'walk', 'creep'])
    && option(motion.posture, ['neutral', 'tense', 'disturbed'])
    && option(motion.expression, ['neutral', 'fear', 'angry', 'dazed'])
    && option(motion.gaze, ['forward', 'camera', 'target', 'manual'])
    && option(motion.breathing, ['normal', 'heavy', 'still'])
    && option(motion.headMovement, ['steady', 'unpredictable'])
    && (motion.seed === undefined || finite(motion.seed))
    && (motion.groundContact === undefined || typeof motion.groundContact === 'boolean')
    && (motion.speed === undefined || finite(motion.speed) && motion.speed >= 0)
    && (motion.lookAt === undefined || vector(motion.lookAt, 3))
    && (motion.reach === undefined || object(motion.reach) && Object.entries(motion.reach).every(([side, value]) => ['leftHand', 'rightHand'].includes(side) && vector(value, 3)))
}

const facialBounds: Record<FacialChannel, [number, number]> = {
  mouthOpen: [0, 1], smile: [0, 1], frown: [0, 1], eyes: [0, 1.5], browAngle: [-1, 1], browRaise: [-1, 1], eyeShift: [-1, 1],
}

export function validClip(clip: unknown): boolean {
  if (!object(clip) || typeof clip.id !== 'string' || !clip.id.trim() || typeof clip.name !== 'string' || clip.name.length > 60
    || !finite(clip.duration) || clip.duration < 0.1 || clip.duration > 120 || !validMotion(clip.motion as Partial<CharacterMotion>)
    || !object(clip.tracks) || !object(clip.targets)) return false
  const duration = clip.duration
  for (const [bone, track] of Object.entries(clip.tracks)) {
    if (!bones.has(bone) || !object(track)) return false
    const rotation = track.rotation
    if (rotation !== undefined) {
      if (!Array.isArray(rotation)) return false
      for (const [index, key] of rotation.entries()) {
        if (!object(key) || !vector(key.q, 4) || Math.abs(Math.hypot(...key.q as QuaternionValue) - 1) > 0.0001 || !finite(key.t) || key.t < 0 || key.t > duration || (index > 0 && key.t <= rotation[index - 1].t)) return false
      }
    }
    if (track.position !== undefined && !positions(track.position, duration)) return false
  }
  if (!Object.entries(clip.targets).every(([target, keys]) => ['leftHand', 'rightHand'].includes(target) && positions(keys, duration))) return false
  if (clip.faceHead !== undefined && (!Array.isArray(clip.faceHead) || !vector(clip.faceHead, 3) || clip.faceHead.some((value: number) => Math.abs(value) > Math.PI))) return false
  if (clip.loop !== undefined && typeof clip.loop !== 'boolean') return false
  if (clip.libraryId !== undefined && (typeof clip.libraryId !== 'string' || !clip.libraryId.trim() || clip.libraryId.length > 120)) return false
  if (clip.source !== undefined && (!object(clip.source) || typeof clip.source.id !== 'string' || !clip.source.id.trim() || clip.source.id.length > 120
    || clip.source.version !== 1 || !finite(clip.source.speed) || clip.source.speed < 0.2 || clip.source.speed > 4
    || !finite(clip.source.strength) || clip.source.strength < 0 || clip.source.strength > 1.5 || typeof clip.source.mirror !== 'boolean')) return false
  if (clip.face !== undefined) {
    if (!object(clip.face)) return false
    for (const [channel, keys] of Object.entries(clip.face)) {
      if (!Object.hasOwn(facialBounds, channel) || !Array.isArray(keys)) return false
      const bounds = facialBounds[channel as FacialChannel]
      for (const [index, key] of keys.entries()) {
        if (!object(key) || !finite(key.t) || !finite(key.v) || key.t < 0 || key.t > duration
          || key.v < bounds[0] || key.v > bounds[1] || (index > 0 && key.t <= keys[index - 1].t)) return false
      }
    }
  }
  return true
}

function scaleKeyTimes(keys: { t: number }[] | undefined, ratio: number): void {
  keys?.forEach(key => { key.t *= ratio })
}

export function retimeFaceKeys(face: CharacterClip['face'], ratio: number): void {
  if (!finite(ratio) || ratio <= 0) throw new RangeError('Animation time scale must be positive')
  if (ratio === 1) return
  for (const channel of Object.keys(facialBounds) as FacialChannel[]) scaleKeyTimes(face?.[channel], ratio)
}

export function retimeClip(clip: CharacterClip, duration: number): void {
  if (!finite(duration) || duration < 0.1 || duration > 120) throw new RangeError('Clip length must be 0.1–120 seconds')
  const ratio = duration / clip.duration
  for (const track of Object.values(clip.tracks)) { scaleKeyTimes(track.rotation, ratio); scaleKeyTimes(track.position, ratio) }
  for (const keys of Object.values(clip.targets)) scaleKeyTimes(keys, ratio)
  retimeFaceKeys(clip.face, ratio)
  clip.duration = duration
}

export function putRotationKey(track: BoneTrack, time: number, q: QuaternionValue): void {
  const keys = track.rotation ?? (track.rotation = [])
  const key = { t: Math.round(time * 1000) / 1000, q: [...q] as QuaternionValue }
  const index = keys.findIndex((item) => Math.abs(item.t - key.t) < 0.0005)
  if (index >= 0) keys[index] = key
  else keys.push(key)
  keys.sort((a, b) => a.t - b.t)
}

export function putPositionKey(keys: PositionKey[] | undefined, time: number, v: Vec3): PositionKey[] {
  const out = keys ? [...keys] : []
  const key = { t: Math.round(time * 1000) / 1000, v: [...v] as Vec3 }
  const index = out.findIndex((item) => Math.abs(item.t - key.t) < 0.0005)
  if (index >= 0) out[index] = key
  else out.push(key)
  return out.sort((a, b) => a.t - b.t)
}
