import * as THREE from 'three'
import type { CharacterRig } from './rig.ts'
import { DEFAULT_MOTION } from './types.ts'
import type { AnimationContext, CharacterClip, CharacterMotion, FacialChannel, IKTarget } from './types.ts'
import { samplePositionKeys, sampleRotationKeys, sampleScalarKeys, solveTwoBone } from './pose.ts'
import { CharacterAnimation, sharedAnimationLibrary, ANIMATION_STATES } from './library.ts'
import type { ClipPlayOptions } from './library.ts'
import type { AuthoringSettings } from './motion-pack.ts'

const euler = new THREE.Euler(), clipRotation = new THREE.Quaternion(), clipPosition = new THREE.Vector3()
const FACE_CHANNELS: FacialChannel[] = ['mouthOpen', 'smile', 'frown', 'eyes', 'browAngle', 'browRaise', 'eyeShift']

interface FacialOverride {
  clip?: CharacterClip
  anchor: number
  transition: number
  rate: number
  from: Record<FacialChannel, number>
  fromHead: THREE.Quaternion
}

export class CharacterController {
  readonly rig: CharacterRig
  motion: CharacterMotion
  private from: Record<string, THREE.Quaternion> | null = null
  private started = 0
  private animationPlayer?: CharacterAnimation
  private faceOverride?: FacialOverride
  private faceRequest = 0
  private faceOffset = new THREE.Quaternion()
  private readonly library: import('./library.ts').AnimationLibrary
  private clipPausedAt?: number
  lastTime = 0

  constructor(rig: CharacterRig, motion: Partial<CharacterMotion> = {}, library: CharacterAnimation['library'] = sharedAnimationLibrary) {
    this.rig = rig
    this.motion = { ...DEFAULT_MOTION, ...motion }
    this.library = library
  }

  get animations(): CharacterAnimation { return this.animationPlayer ??= new CharacterAnimation(this.library) }
  get animationState() { return this.animationPlayer?.sample(this.lastTime) }

  async playClip(id: string, options: ClipPlayOptions = {}): Promise<CharacterClip> {
    this.from = null
    const { face, ...settings } = options
    const clip = await this.animations.play(id, settings)
    const evaluated = this.animations.sample(this.lastTime)
    if (evaluated?.id !== id) return clip
    this.clipPausedAt = undefined
    if (!evaluated.previousClip && (options.transition ?? .24) > 0) {
      this.from = Object.fromEntries(Object.entries(this.rig.bones).map(([name, bone]) => [name, bone.quaternion.clone()]))
      this.started = this.lastTime
    }
    if (face) await this.setFace(face, options.time ?? 0, .18)
    return clip
  }

  playState(state: string, options: ClipPlayOptions = {}): Promise<CharacterClip> {
    const id = ANIMATION_STATES[state]
    return id ? this.playClip(id, options) : Promise.reject(new Error(`Unknown animation state: ${state}`))
  }

  pauseClip(time = this.lastTime): void { this.animationPlayer?.pause(time); this.clipPausedAt = time }
  resumeClip(time = this.lastTime): void {
    const frozen = this.clipPausedAt
    if (frozen !== undefined) {
      if (this.faceOverride) this.faceOverride.anchor += time - frozen
      this.started += time - frozen
    }
    this.clipPausedAt = undefined
    this.animationPlayer?.resume(time)
  }
  seekClip(offset: number, time = this.lastTime): void { this.animationPlayer?.seek(offset, time) }
  stopClip(time = this.lastTime, transitionSeconds = 0): void {
    this.animationPlayer?.stop()
    void this.setFace(null, time, transitionSeconds)
    this.play(this.motion, time, transitionSeconds)
  }

  seekFace(offset: number, time = this.lastTime): void {
    if (!this.faceOverride?.clip) return
    const safe = Number.isFinite(offset) ? Math.max(0, offset) : 0
    this.faceOverride.anchor = time - Math.min(safe, this.faceOverride.clip.duration) / this.faceOverride.rate
    this.faceOverride.transition = 0
  }

  async setFace(id: string | null, time = this.lastTime, transitionSeconds = .18, timeScale = 1, settings: Partial<AuthoringSettings> = {}): Promise<void> {
    const token = ++this.faceRequest
    if (id !== null && this.animations.library.byId.get(id)?.category !== 'Face') throw new Error(`Unknown facial preset: ${id}`)
    const clip = id === null ? undefined : await this.animations.library.getClip(id, settings)
    if (token !== this.faceRequest) return
    this.faceOverride = { clip, anchor: Math.max(0, Number.isFinite(time) ? time : 0), transition: Math.max(0, transitionSeconds), rate: Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1, from: this.currentFace(), fromHead: this.faceOffset.clone() }
  }

  private baseFace(m: CharacterMotion, time: number): Record<FacialChannel, number> {
    const breath = m.breathing === 'still' ? 0 : Math.sin(time * (m.breathing === 'heavy' ? 4.2 : 1.7))
    const fear = m.expression === 'fear' ? 1 : 0
    return {
      mouthOpen: m.expression === 'angry' ? .35 : fear * .35 + Math.max(0, breath) * (m.breathing === 'heavy' ? .24 : .04),
      smile: 0, frown: 0, eyes: m.expression === 'dazed' ? .2 : fear || .65,
      browAngle: (m.expression === 'angry' ? .3 : fear * .22) / .3, browRaise: 0, eyeShift: 0,
    }
  }

  private faceValues(clip: CharacterClip | undefined, time: number, m: CharacterMotion): Record<FacialChannel, number> {
    const defaults = this.baseFace(m, time)
    if (!clip?.face) return defaults
    for (const channel of FACE_CHANNELS) defaults[channel] = sampleScalarKeys(clip.face[channel], time) ?? defaults[channel]
    return defaults
  }

  private currentFace(): Record<FacialChannel, number> {
    const influences = this.rig.face.mouth.morphTargetInfluences ?? [0, 0, 0]
    return {
      mouthOpen: influences[0], smile: influences[1] ?? 0, frown: influences[2] ?? 0,
      eyes: this.rig.face.eyes[0].scale.y, browAngle: -this.rig.face.brows[0].rotation.z / .3,
      browRaise: (this.rig.face.brows[0].position.y - this.rig.face.browRest[0].y) / .024,
      eyeShift: (this.rig.face.eyes[0].position.x - this.rig.face.eyeRest[0].x) / .005,
    }
  }

  private applyFace(clipTime: number, m: CharacterMotion, time: number, externalClip?: CharacterClip, evaluation?: ReturnType<CharacterAnimation['sample']>): void {
    const rig = this.rig
    const current = this.faceValues(externalClip, clipTime, m)
    if (evaluation?.previousClip) {
      const previous = this.faceValues(evaluation.previousClip, evaluation.previousTime, evaluation.previousClip.motion)
      for (const channel of FACE_CHANNELS) current[channel] = THREE.MathUtils.lerp(previous[channel], current[channel], evaluation.blend)
    }
    const overlay = this.faceOverride
    if (overlay) {
      const weight = overlay.transition ? THREE.MathUtils.smoothstep(time - overlay.anchor, 0, overlay.transition) : 1
      if (overlay.clip) {
        const elapsed = Math.max(0, time - overlay.anchor) * overlay.rate
        const targetTime = overlay.clip.loop === false ? Math.min(elapsed, overlay.clip.duration) : elapsed % overlay.clip.duration
        const target = this.faceValues(overlay.clip, targetTime, m)
        for (const channel of FACE_CHANNELS) current[channel] = THREE.MathUtils.lerp(overlay.from[channel], target[channel], weight)
        const targetHead = new THREE.Quaternion()
        sampleRotationKeys(overlay.clip.tracks.head?.rotation, targetTime, targetHead)
        this.faceOffset.copy(overlay.fromHead).slerp(targetHead, weight)
      } else {
        for (const channel of FACE_CHANNELS) current[channel] = THREE.MathUtils.lerp(overlay.from[channel], current[channel], weight)
        this.faceOffset.copy(overlay.fromHead).slerp(new THREE.Quaternion(), weight)
      }
      if (weight >= 1 && !overlay.clip) this.faceOverride = undefined
    } else {
      this.faceOffset.identity()
      if (externalClip?.faceHead) this.faceOffset.setFromEuler(euler.set(...externalClip.faceHead))
    }
    rig.bones.head.quaternion.multiply(this.faceOffset)
    const dictionary = rig.face.mouth.morphTargetDictionary ?? {}, influences = rig.face.mouth.morphTargetInfluences!
    for (const channel of ['mouthOpen', 'smile', 'frown'] as const) if (dictionary[channel] !== undefined) influences[dictionary[channel]] = current[channel]
    rig.face.eyes.forEach((eye, i) => {
      eye.scale.y = current.eyes
      eye.position.copy(rig.face.eyeRest[i]).x += current.eyeShift * .005
    })
    rig.face.brows.forEach((brow, i) => {
      brow.rotation.z = (i ? 1 : -1) * current.browAngle * .3
      brow.position.copy(rig.face.browRest[i]).y += current.browRaise * .024
    })
  }

  /** Layered state: procedural locomotion → authored keys → gaze and contact IK. */
  play(motion: Partial<CharacterMotion>, time = 0, transitionSeconds = 0.28): void {
    if (transitionSeconds > 0) {
      this.from = Object.fromEntries(Object.entries(this.rig.bones).map(([name, bone]) => [name, bone.quaternion.clone()]))
      this.started = time
    }
    this.motion = { ...DEFAULT_MOTION, ...motion }
    this.clipPausedAt = undefined
    this.animationPlayer?.stop()
  }

  update(time: number, context: AnimationContext = {}): void {
    const rig = this.rig, bones = rig.bones
    this.lastTime = time
    time = this.clipPausedAt ?? time
    const evaluation = context.clip ? undefined : this.animationPlayer?.sample(time)
    const clip = context.clip ?? evaluation?.clip, m = clip?.motion ?? this.motion
    const seed = m.seed ?? 0.371
    for (const [name, bone] of Object.entries(bones)) {
      bone.position.copy(rig.rest[name].position)
      bone.quaternion.copy(rig.rest[name].quaternion)
    }
    const walking = m.movement !== 'idle' && m.speed > 0
    const phase = time * Math.PI * 2 * (m.movement === 'creep' ? 0.7 : 1) * m.speed / 0.95
    const breath = m.breathing === 'still' ? 0 : Math.sin(time * (m.breathing === 'heavy' ? 4.2 : 1.7))
    const lean = m.posture === 'disturbed' ? 0.14 : m.posture === 'tense' ? 0.055 : 0.025
    bones.chest.quaternion.setFromEuler(euler.set(lean + breath * (m.breathing === 'heavy' ? 0.032 : 0.012), 0, m.posture === 'disturbed' ? 0.045 : 0))
    bones.spine.quaternion.setFromEuler(euler.set(lean * 0.55, walking ? Math.sin(phase) * 0.065 : 0, 0))
    const stride = walking ? Math.min(0.37, m.speed * 0.65) : 0
    bones.hips.position.y += walking
      ? -0.065 - Math.max(0, stride - 0.26) * 0.4 - (m.movement === 'creep' ? 0.035 : 0) + Math.abs(Math.cos(phase)) * 0.025
      : breath > 0 ? -breath * 0.006 : 0
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? 1 : -1
      const swing = phase + (side === 'right' ? Math.PI : 0)
      if (!m.groundContact) {
        bones[`${side}Hip`].quaternion.setFromEuler(euler.set(walking ? -Math.sin(swing) * 0.42 : 0, 0, 0))
        bones[`${side}Knee`].quaternion.setFromEuler(euler.set(walking ? 0.08 + Math.max(0, Math.sin(swing + 1.9)) * 0.75 : 0.025, 0, 0))
      }
      bones[`${side}Shoulder`].quaternion.setFromEuler(euler.set(walking ? Math.sin(swing) * 0.28 : 0, 0, sign * (m.posture === 'tense' ? 0.13 : 0.055)))
      bones[`${side}Elbow`].quaternion.setFromEuler(euler.set(walking ? -0.22 - Math.max(0, -Math.sin(swing)) * 0.16 : -0.12, 0, 0))
    }
    if (m.headMovement === 'unpredictable') {
      bones.head.quaternion.setFromEuler(euler.set(Math.sin(time * 5.1 + seed) * 0.027, Math.sin(time * 6.7 + seed) * Math.sin(time * 2.13 + seed * 11) * 0.095, Math.sin(time * 4.1 + seed) * Math.sin(time * 0.79) * 0.06))
    }
    if (m.posture === 'disturbed') bones.head.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler.set(0.04, 0, 0.13)))

    const clipTime = clip ? THREE.MathUtils.clamp(context.clip ? (context.clipTime ?? time) : (evaluation?.clipTime ?? time), 0, clip.duration) : 0
    if (clip) for (const [name, track] of Object.entries(clip.tracks)) {
      const bone = bones[name]
      if (!bone) continue
      sampleRotationKeys(track.rotation, clipTime, bone.quaternion)
      samplePositionKeys(track.position, clipTime, bone.position)
      if (evaluation?.previousClip) {
        clipRotation.copy(bone.quaternion); clipPosition.copy(bone.position)
        sampleRotationKeys(evaluation.previousClip.tracks[name]?.rotation, evaluation.previousTime, bone.quaternion)
        samplePositionKeys(evaluation.previousClip.tracks[name]?.position, evaluation.previousTime, bone.position)
        bone.quaternion.slerp(clipRotation, evaluation.blend)
        bone.position.lerp(clipPosition, evaluation.blend)
      }
    }
    rig.group.updateMatrixWorld(true)

    const cameraTarget = m.gaze === 'camera' ? context.cameraPosition : m.gaze === 'target' && m.lookAt ? rig.bones.root.localToWorld(new THREE.Vector3(...m.lookAt)) : null
    if (cameraTarget) {
      const direction = bones.head.parent!.worldToLocal(cameraTarget.clone()).sub(bones.head.position).normalize()
      bones.head.rotation.set(THREE.MathUtils.clamp(-Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), -0.65, 0.65), THREE.MathUtils.clamp(Math.atan2(direction.x, direction.z), -1.35, 1.35), 0, 'YXZ')
    }
    for (const side of ['left', 'right'] as const) {
      const targetKey: IKTarget = `${side}Hand`
      const reach = m.reach?.[targetKey]
      if (!reach) continue
      const target = new THREE.Vector3()
      if (!samplePositionKeys(clip?.targets[targetKey], clipTime, target)) target.set(...reach)
      bones.root.localToWorld(target)
      solveTwoBone(bones[`${side}Shoulder`], bones[`${side}Elbow`], bones[`${side}Wrist`], target, bones.root.localToWorld(new THREE.Vector3(side === 'left' ? 0.8 : -0.8, 1.1, -0.65)))
    }
    if (m.groundContact) {
      rig.group.updateMatrixWorld(true)
      const floor = bones.root.worldToLocal(new THREE.Vector3(0, context.groundY ?? 0, 0)).y + 0.08
      for (const side of ['left', 'right'] as const) {
        const swing = phase + (side === 'right' ? Math.PI : 0)
        const target = new THREE.Vector3(side === 'left' ? 0.085 : -0.085, floor, walking ? Math.cos(swing) * stride : 0)
        if (walking) target.y += Math.max(0, Math.sin(swing)) * Math.min(0.13, m.speed * 0.13)
        bones.root.localToWorld(target)
        solveTwoBone(bones[`${side}Hip`], bones[`${side}Knee`], bones[`${side}Ankle`], target, bones.root.localToWorld(new THREE.Vector3(side === 'left' ? 0.1 : -0.1, 0.5, 0.8)))
        rig.group.updateMatrixWorld(true)
      }
    }
    if (this.from) {
      const duration = context.transitionSeconds ?? 0.28
      const t = duration > 0 ? Math.max(0, time - this.started) / duration : 1
      const amount = t >= 1 ? 1 : t * t * (3 - 2 * t)
      for (const [name, from] of Object.entries(this.from)) bones[name].quaternion.slerpQuaternions(from, bones[name].quaternion, amount)
      if (amount === 1 || time < this.started) this.from = null
    }
    this.applyFace(clipTime, m, time, clip, evaluation)
    rig.group.updateMatrixWorld(true)
  }
}
