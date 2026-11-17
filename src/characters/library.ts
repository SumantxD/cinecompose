import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { bakeAuthoredMotion, LIBRARY_DEFINITIONS } from './motion-pack.ts'
import type { AnimationCategory, AnimationDefinition, AuthoringSettings } from './motion-pack.ts'
import { retargetCharacterClip } from './retarget.ts'
import { createCharacterRig, type CharacterRig } from './rig.ts'
import type { CharacterClip, Vec3 } from './types.ts'

interface SourcePack { root: THREE.Group; animations: THREE.AnimationClip[] }

export const SOURCE_ANIMATION_URL = '/animations/kaali-raat-cc0.glb'
export const ANIMATION_STATES: Readonly<Record<string, string>> = {
  idle: 'idle-breathing', nervous: 'idle-nervous', suspicious: 'idle-suspicious', aggressive: 'idle-aggressive', injured: 'idle-injured',
  walk: 'walk-forwards', slowWalk: 'walk-slow', run: 'run-jog-forwards', sprint: 'run-sprint', creep: 'walk-crouched-forwards', crawl: 'creature-crawl',
  fear: 'fear-tremble', surprised: 'fear-startle', backAway: 'fear-back-away', attacked: 'survival-hit-reaction', grabbing: 'creature-grab',
  fallen: 'survival-fall-back', dead: 'survival-death-back', interact: 'interaction-reach',
}
const bounds = (value: unknown, lo: number, hi: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback
function settings(value: Partial<AuthoringSettings>): AuthoringSettings {
  return { speed: bounds(value.speed, .2, 4, 1), strength: bounds(value.strength, 0, 1.5, 1), mirror: value.mirror === true }
}
const clone = (clip: CharacterClip): CharacterClip => JSON.parse(JSON.stringify(clip)) as CharacterClip
const flipName = (name: string) => name.startsWith('left') ? `right${name.slice(4)}` : name.startsWith('right') ? `left${name.slice(5)}` : name

export class AnimationLibrary {
  readonly definitions = LIBRARY_DEFINITIONS
  readonly byId = new Map(LIBRARY_DEFINITIONS.map(entry => [entry.id, entry]))
  readonly categories: AnimationCategory[]
  private sourcePromise?: Promise<{ root: THREE.Group; animations: Map<string, THREE.AnimationClip> }>
  private cache = new Map<string, Promise<CharacterClip>>()
  private rest?: CharacterRig['rest']

  private readonly options: { sourceUrl?: string | null; source?: SourcePack }

  constructor(options: { sourceUrl?: string | null; source?: SourcePack } = {}) {
    this.options = options
    this.categories = [...new Set(this.definitions.map(entry => entry.category))]
  }

  private restPose() {
    if (!this.rest) {
      const rig = createCharacterRig()
      this.rest = Object.fromEntries(Object.entries(rig.rest).map(([name, pose]) => [name, { position: pose.position.clone(), quaternion: pose.quaternion.clone() }]))
      rig.dispose()
    }
    return this.rest
  }

  private source() {
    if (!this.sourcePromise) {
      if (this.options.sourceUrl === null) return Promise.reject(new Error('The external CC0 clip source is disabled'))
      this.sourcePromise = (async () => {
        const source: SourcePack = this.options.source ?? await new GLTFLoader().loadAsync(this.options.sourceUrl ?? SOURCE_ANIMATION_URL).then(gltf => ({ root: gltf.scene, animations: gltf.animations }))
        const animations = new Map(source.animations.map(clip => [clip.name, clip]))
        return { root: source.root, animations }
      })().catch(error => { this.sourcePromise = undefined; throw error })
    }
    return this.sourcePromise
  }

  private vary(clip: CharacterClip, definition: AnimationDefinition, options: AuthoringSettings): CharacterClip {
    const rest = this.restPose()
    if (options.strength !== 1) {
      for (const [name, track] of Object.entries(clip.tracks)) {
        const base = rest[name]
        if (!base) continue
        track.rotation?.forEach(key => { key.q = base.quaternion.clone().slerp(new THREE.Quaternion(...key.q), options.strength).toArray() })
        track.position?.forEach(key => { key.v = base.position.clone().lerp(new THREE.Vector3(...key.v), options.strength).toArray() })
      }
    }
    const remap = <T extends { v: number[] }>(keys: T[]) => options.mirror ? keys.map(key => ({ ...key, v: [-key.v[0], key.v[1], key.v[2]] as Vec3 })) : keys
    if (options.mirror) {
      const reflected: CharacterClip['tracks'] = {}
      for (const [name, track] of Object.entries(clip.tracks)) {
        track.rotation = track.rotation?.map(key => ({ ...key, q: [key.q[0], -key.q[1], -key.q[2], key.q[3]] }))
        track.position = remap(track.position ?? [])
        reflected[flipName(name)] = track
      }
      clip.tracks = reflected
    }
    if (options.strength !== 1 && clip.face) for (const [channel, keys] of Object.entries(clip.face)) {
      const base = channel === 'eyes' ? .65 : 0
      const lo = ['browAngle', 'browRaise', 'eyeShift'].includes(channel) ? -1 : 0
      const hi = channel === 'eyes' ? 1.5 : 1
      for (const key of keys) key.v = THREE.MathUtils.clamp(base + (key.v - base) * options.strength, lo, hi)
    }
    if (options.mirror && clip.face?.eyeShift) clip.face.eyeShift = clip.face.eyeShift.map(key => ({ ...key, v: -key.v }))
    const scale = (keys?: { t: number }[]) => keys?.forEach(key => { key.t /= options.speed })
    Object.values(clip.tracks).forEach(track => { scale(track.rotation); scale(track.position) })
    Object.values(clip.targets).forEach(scale)
    Object.values(clip.face ?? {}).forEach(scale)
    clip.duration /= options.speed
    clip.id = `library:${definition.id}`
    clip.name = `${definition.name}${options.mirror ? ' (mirrored)' : ''}`
    if (clip.faceHead && clip.tracks.head.rotation?.length) {
      clip.faceHead = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...clip.tracks.head.rotation[0].q)).toArray().slice(0, 3) as Vec3
    }
    clip.loop = definition.loop
    clip.source = { id: definition.id, version: 1, speed: options.speed, strength: options.strength, mirror: options.mirror }
    return clip
  }

  getClip(id: string, overrides: Partial<AuthoringSettings> = {}): Promise<CharacterClip> {
    const definition = this.byId.get(id)
    if (!definition) return Promise.reject(new Error(`Unknown animation: ${id}`))
    const options = settings(overrides), key = `${id}:${options.speed}:${options.strength}:${options.mirror}`
    let pending = this.cache.get(key)
    if (!pending) {
      pending = (async () => {
        if (definition.sourceClip) {
          const source = await this.source()
          const input = source.animations.get(definition.sourceClip)
          if (!input) throw new Error(`Missing clip in source pack: ${definition.sourceClip}`)
          const clip = retargetCharacterClip(source.root.clone(true), input, {
            inPlace: definition.category === 'Locomotion' || definition.id.includes('walk'), loop: definition.loop,
          })
          return this.vary(clip, definition, options)
        }
        return this.vary(bakeAuthoredMotion(definition, { ...options, speed: 1 }), definition, options)
      })()
      if (this.cache.size >= 24) this.cache.delete(this.cache.keys().next().value!)
      this.cache.set(key, pending)
      pending.catch(() => this.cache.delete(key))
    }
    return pending.then(clone)
  }
}

export const sharedAnimationLibrary = new AnimationLibrary()

interface PlayingClip { clip: CharacterClip; anchor: number; offset: number; loop: boolean }
export interface ClipPlayOptions {
  time?: number
  offset?: number
  loop?: boolean
  transition?: number
  restart?: boolean
  speed?: number
  strength?: number
  mirror?: boolean
  face?: string
}
export interface AnimationEvaluation {
  clip?: CharacterClip
  clipTime: number
  previousClip?: CharacterClip
  previousTime: number
  blend: number
  id?: string
  duration: number
  finished: boolean
  paused: boolean
}

/** A small two-action state machine driven by an absolute external clock. */
export class CharacterAnimation {
  private current?: PlayingClip
  private previous?: PlayingClip
  private transitionStart = 0
  private transition = 0
  private pausedAt?: number
  private request = 0
  lastTime = 0

  readonly library: AnimationLibrary
  constructor(library = new AnimationLibrary()) { this.library = library }

  private clock(time: unknown): number { return typeof time === 'number' && Number.isFinite(time) ? Math.max(0, time) : 0 }
  private local(action: PlayingClip, time: number): number {
    const raw = action.offset + Math.max(0, (this.pausedAt ?? time) - action.anchor)
    return action.loop ? ((raw % action.clip.duration) + action.clip.duration) % action.clip.duration : Math.min(action.clip.duration, raw)
  }

  async play(id: string, options: ClipPlayOptions = {}): Promise<CharacterClip> {
    if (options.face || this.library.byId.get(id)?.category === 'Face') throw new Error('Facial presets are a separate layer: use character.setFace()')
    const time = this.clock(options.time), token = ++this.request, current = this.current, previousTime = this.lastTime, source = current?.clip.source
    const transition = bounds(options.transition, 0, 3, .24)
    if (options.restart === false && current && source?.id === id && source?.speed === (options.speed ?? 1) && source?.strength === (options.strength ?? 1) && source?.mirror === (options.mirror === true)) {
      current.anchor = time
      current.offset = bounds(options.offset, 0, current.clip.duration, this.local(current, time))
      current.loop = options.loop ?? current.loop
      current.clip.loop = current.loop
      return current.clip
    }
    const clip = await this.library.getClip(id, options)
    if (token !== this.request) return clip
    this.previous = current && transition > 0 ? { ...current, anchor: time, offset: this.local(current, previousTime) } : undefined
    this.current = { clip, anchor: time, offset: bounds(options.offset, 0, clip.duration, 0), loop: options.loop ?? clip.loop ?? true }
    this.current.clip.loop = this.current.loop
    this.transition = transition
    this.transitionStart = time
    this.current.anchor -= this.transition * this.current.offset / clip.duration
    this.pausedAt = undefined
    this.lastTime = time
    return clip
  }

  async playState(state: string, options: ClipPlayOptions = {}): Promise<CharacterClip> {
    const id = ANIMATION_STATES[state]
    if (!id) throw new Error(`Unknown animation state: ${state}`)
    return this.play(id, options)
  }

  pause(time = this.lastTime) { if (this.current) this.pausedAt = this.clock(time) }
  resume(time = this.lastTime) {
    if (this.pausedAt === undefined) return
    const paused = this.pausedAt
    for (const action of [this.current, this.previous]) if (action) action.anchor += this.clock(time) - paused
    this.transitionStart += this.clock(time) - paused
    this.pausedAt = undefined
  }
  seek(offset: number, time = this.lastTime) {
    if (!this.current) return
    this.current.offset = bounds(offset, 0, this.current.clip.duration, 0)
    this.current.anchor = this.clock(time)
    if (this.previous) { this.previous.offset = this.local(this.previous, time); this.previous.anchor = this.clock(time) }
  }
  stop(): void { this.request++; this.current = undefined; this.previous = undefined; this.pausedAt = undefined }
  sample(time: number): AnimationEvaluation | undefined {
    if (!this.current) return undefined
    this.lastTime = this.clock(time)
    const current = this.current, local = this.local(current, time), effectiveTime = this.pausedAt ?? time
    const blend = this.previous && this.transition > 0 ? THREE.MathUtils.clamp((effectiveTime - this.transitionStart) / this.transition, 0, 1) : 1
    if (blend === 1) this.previous = undefined
    return {
      clip: current.clip, clipTime: local, previousClip: this.previous?.clip,
      previousTime: this.previous ? this.local(this.previous, time) : 0,
      blend: blend * blend * (3 - 2 * blend), id: current.clip.source?.id,
      duration: current.clip.duration, finished: !current.loop && local >= current.clip.duration, paused: this.pausedAt !== undefined,
    }
  }
}

export function documentToAnimationClip(rig: CharacterRig, clip: CharacterClip): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [], frames = Math.max(2, Math.ceil(clip.duration * 30) + 1)
  const times = Array.from({ length: frames }, (_, index) => clip.duration * index / (frames - 1))
  for (const [name, track] of Object.entries(clip.tracks)) {
    if (track.rotation?.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, track.rotation.map(key => key.t), track.rotation.flatMap(key => key.q)))
    if (track.position?.length) tracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, track.position.map(key => key.t), track.position.flatMap(key => key.v)))
  }
  for (const [i, eye] of rig.face.eyes.entries()) {
    tracks.push(new THREE.VectorKeyframeTrack(`${eye.name}.scale`, times, Array.from({ length: frames }, () => [.85, .65, .35]).flat()))
    tracks.push(new THREE.VectorKeyframeTrack(`${eye.name}.position`, times, Array.from({ length: frames }, () => rig.face.eyeRest[i].toArray()).flat()))
  }
  for (const [i, brow] of rig.face.brows.entries()) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${brow.name}.quaternion`, times, Array.from({ length: frames }, () => new THREE.Quaternion().toArray()).flat()))
    tracks.push(new THREE.VectorKeyframeTrack(`${brow.name}.position`, times, Array.from({ length: frames }, () => rig.face.browRest[i].toArray()).flat()))
  }
  for (const [name] of Object.entries(rig.face.mouth.morphTargetDictionary ?? {})) {
    tracks.push(new THREE.NumberKeyframeTrack(`mouth.morphTargetInfluences[${name}]`, times, times.map(() => 0)))
  }
  if (clip.face) for (const [channel, keys] of Object.entries(clip.face)) {
    if (!keys?.length) continue
    if (['mouthOpen', 'smile', 'frown'].includes(channel)) tracks.push(new THREE.NumberKeyframeTrack(`mouth.morphTargetInfluences[${channel}]`, keys.map(key => key.t), keys.map(key => key.v)))
    else if (channel === 'eyes') for (const eye of rig.face.eyes) tracks.push(new THREE.VectorKeyframeTrack(`${eye.name}.scale`, keys.map(key => key.t), keys.flatMap(key => [.85, key.v, .35])))
    else if (channel === 'browAngle') rig.face.brows.forEach((brow, i) => tracks.push(new THREE.QuaternionKeyframeTrack(`${brow.name}.quaternion`, keys.map(key => key.t), keys.flatMap(key => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i ? 1 : -1) * key.v * .3).toArray()))))
    else if (channel === 'browRaise') rig.face.brows.forEach((brow, i) => tracks.push(new THREE.VectorKeyframeTrack(`${brow.name}.position`, keys.map(key => key.t), keys.flatMap(key => rig.face.browRest[i].clone().add(new THREE.Vector3(0, key.v * .024, 0)).toArray()))))
    else if (channel === 'eyeShift') rig.face.eyes.forEach((eye, i) => tracks.push(new THREE.VectorKeyframeTrack(`${eye.name}.position`, keys.map(key => key.t), keys.flatMap(key => rig.face.eyeRest[i].clone().add(new THREE.Vector3(key.v * .005, 0, 0)).toArray()))))
  }
  return new THREE.AnimationClip(clip.name, -1, tracks)
}

