import gsap from 'gsap'
import { sampleShot } from './curve.ts'
import * as THREE from 'three'
import type { SceneConfig, Cue, Vec3 } from './types'
import type { Line } from '../story/StoryEngine'
import { PRESETS } from './presets.ts'
import { expandTechniques } from './techniques.ts'
import { useStore } from '../state/store.ts'
import { AudioManager } from '../audio/AudioManager.ts'
import { clock } from './clock.ts'
import { VOICES } from '../audio/voices.ts'

/** Camera state the timeline writes and CameraController reads every frame. */
export const cam = { px: 0, py: 1.6, pz: 5, lx: 0, ly: 1.4, lz: 0, fov: 40, fovP: 58, roll: 0, exposure: 1, eyeLight: 0, free: false, type: 'static' as keyof typeof PRESETS }

const words = (s: string) => s.split(/\s+/).length

/** Lines without `at`/`hold` are paced like speech. Returns the scheduled lines and when the last one ends. */
export function paceLines(lines: Line[]) {
  let cursor = 1
  const timed = lines.map((l) => {
    const at = l.silent ? l.at ?? cursor : Math.max(l.at ?? cursor, cursor)
    const voiceDuration = !l.silent && l.vo && Object.hasOwn(VOICES, l.vo) ? VOICES[l.vo].duration + 0.35 : 0
    const hold = l.silent ? 0 : Math.max(l.hold ?? 2, words(l.text) * 0.36 + 1.1, voiceDuration)
    cursor = at + hold + 0.5
    return { ...l, at, hold }
  })
  return { timed, end: timed.length ? Math.max(...timed.map((l) => l.at + l.hold)) : 0 }
}

function runCue(c: Cue) {
  const s = useStore.getState()
  switch (c.action) {
    case 'light': return s.setLight(c.target, c.mode)
    case 'entity':
      // keep: change only what this cue names (head turn, anim) without restarting a walk in progress.
      if (c.keep) return s.setEntity(c.target, Object.fromEntries(Object.entries({ visible: c.visible, headYaw: c.headYaw, anim: c.anim, tilt: c.tilt, face: c.face, feetForward: c.feetForward, smile: c.smile }).filter(([, v]) => v !== undefined)))
      return s.setEntity(c.target, { visible: c.visible, position: c.position, tilt: c.tilt ?? 0, speed: c.speed ?? 0, from: c.from, shadowOnly: c.shadowOnly ?? false, rotationY: c.rotationY, anim: c.anim, headYaw: c.headYaw, since: clock.t, face: c.face ?? false, feetForward: c.feetForward ?? false, smile: c.smile ?? false })
    case 'train': return // The return environment reads the movement cue from scene JSON.
    case 'sfx': return AudioManager.sfx(c.sound, c.volume, c.position, c.rate)
    case 'ambience': return AudioManager.ambience(c.sound, c.volume, c.fade)
    case 'title': return s.set({ showTitle: c.visible })
    case 'fade': return // handled as a tween in buildTimeline
  }
}

function addShots(tl: gsap.core.Timeline, cfg: SceneConfig, state: typeof cam) {
  let t = 0
  for (const shot of cfg.shots) {
    const fovP = shot.fovPortrait ?? Math.min(shot.fov * 1.45, 75)
    const start = sampleShot(shot, 0)
    tl.set(state, { px: start.position[0], py: start.position[1], pz: start.position[2], lx: start.aim[0], ly: start.aim[1], lz: start.aim[2], fov: shot.fov, fovP, roll: shot.roll ?? 0, exposure: shot.exposure ?? 1, eyeLight: shot.eyeLight ?? 0, type: shot.type }, t)
    if (shot.type !== 'static' && shot.type !== 'security') {
      const progress = { v: 0 }
      tl.to(progress, { v: 1, duration: shot.duration, ease: 'none', onUpdate: () => {
        const sample = sampleShot(shot, progress.v * shot.duration)
        state.px = sample.position[0]; state.py = sample.position[1]; state.pz = sample.position[2]
        state.lx = sample.aim[0]; state.ly = sample.aim[1]; state.lz = sample.aim[2]
        state.roll = (shot.roll ?? 0) + ((shot.rollTo ?? shot.roll ?? 0) - (shot.roll ?? 0)) * progress.v
      } }, t)
    }
    t += shot.duration
  }
}

export interface CameraSample {
  position: Vec3
  aim: Vec3
  u: number
  segment: number
  speed: number
  time: number
}

/** Exact playback samples for visible pipes, handles and physical-speed colours. */
export function cameraPaths(cfg: SceneConfig, resolution = 24): CameraSample[][] {
  return cfg.shots.map((shot) => {
    const steps = (shot.path?.segments.length ?? 1) * resolution
    const samples = Array.from({ length: steps + 1 }, (_, i) => {
      const time = shot.duration * i / steps
      return { ...sampleShot(shot, time), time, speed: 0 }
    })
    for (let i = 1; i < samples.length; i++) {
      const a = new THREE.Vector3(...samples[i - 1].position)
      const b = new THREE.Vector3(...samples[i].position)
      const dt = samples[i].time - samples[i - 1].time
      samples[i].speed = a.distanceTo(b) / dt
    }
    samples[0].speed = samples[1]?.speed ?? 0
    return samples
  })
}

/** Builds the paused master timeline for one scene. The scene clock scrubs it; it never plays itself. */
export function buildTimeline(cfg: SceneConfig, lines: Line[]) {
  const tl = gsap.timeline({ paused: true })
  const { timed, end } = paceLines(lines)

  addShots(tl, cfg, cam)

  const fade = { v: useStore.getState().blackout }
  for (const c of [...cfg.cues, ...expandTechniques(cfg.techniques)]) {
    if (c.action === 'fade')
      tl.to(fade, { v: c.to, duration: c.duration, ease: 'sine.inOut', onUpdate: () => useStore.getState().set({ blackout: fade.v }) }, c.at)
    else tl.call(runCue, [c], c.at)
  }

  for (const l of timed.filter((l) => !l.silent)) {
    const caption = { speaker: l.speaker, text: l.text }
    tl.call(() => useStore.getState().set({ caption }), [], l.at)
    tl.call(() => useStore.getState().caption === caption && useStore.getState().set({ caption: null }), [], l.at + l.hold)
  }

  const voices = timed.flatMap((l) => {
    const clip = l.vo && Object.hasOwn(VOICES, l.vo) ? VOICES[l.vo] : undefined
    return clip ? [{ ...clip, id: `${cfg.sceneId}/${l.at}/${clip.id}`, at: l.at }] : []
  })
  return { tl, duration: Math.max(cfg.duration, end + 0.8), voices }
}
