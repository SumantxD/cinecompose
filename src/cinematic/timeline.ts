import gsap from 'gsap'
import type { SceneConfig, Cue } from './types'
import type { Line } from '../story/StoryEngine'
import { PRESETS } from './presets'
import { expandTechniques } from './techniques'
import { useStore } from '../state/store'
import { AudioManager } from '../audio/AudioManager'
import { clock } from './clock'

/** Camera state the timeline writes and CameraController reads every frame. */
export const cam = { px: 0, py: 1.6, pz: 5, lx: 0, ly: 1.4, lz: 0, fov: 40, fovP: 58, roll: 0, exposure: 1, eyeLight: 0, free: false, type: 'static' as keyof typeof PRESETS }

const words = (s: string) => s.split(/\s+/).length

/** Lines without `at`/`hold` are paced like speech. Returns the scheduled lines and when the last one ends. */
export function paceLines(lines: Line[]) {
  let cursor = 1
  const timed = lines.map((l) => {
    const at = l.at ?? cursor
    const hold = l.hold ?? (l.silent ? 0 : Math.max(2, words(l.text) * 0.36 + 1.1))
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
      if (c.keep) return s.setEntity(c.target, Object.fromEntries(Object.entries({ visible: c.visible, headYaw: c.headYaw, anim: c.anim, tilt: c.tilt }).filter(([, v]) => v !== undefined)))
      return s.setEntity(c.target, { visible: c.visible, position: c.position, tilt: c.tilt ?? 0, speed: c.speed ?? 0, from: c.from, shadowOnly: c.shadowOnly ?? false, rotationY: c.rotationY, anim: c.anim, headYaw: c.headYaw, since: clock.t })
    case 'sfx': return AudioManager.sfx(c.sound, c.volume, c.position, c.rate)
    case 'ambience': return AudioManager.ambience(c.sound, c.volume, c.fade)
    case 'title': return s.set({ showTitle: c.visible })
    case 'fade': return // handled as a tween in buildTimeline
  }
}

/** Builds the paused master timeline for one scene. The scene clock scrubs it; it never plays itself. */
export function buildTimeline(cfg: SceneConfig, lines: Line[]) {
  const tl = gsap.timeline({ paused: true })
  const { timed, end } = paceLines(lines)

  let t = 0
  for (const shot of cfg.shots) {
    const ease = shot.ease ?? PRESETS[shot.type].ease
    const fovP = shot.fovPortrait ?? Math.min(shot.fov * 1.45, 75)
    const [px, py, pz] = shot.from
    const [lx, ly, lz] = shot.lookAt
    tl.set(cam, { px, py, pz, lx, ly, lz, fov: shot.fov, fovP, roll: shot.roll ?? 0, exposure: shot.exposure ?? 1, eyeLight: shot.eyeLight ?? 0, type: shot.type }, t)
    const to = shot.to ?? shot.from
    const lookTo = shot.lookAtTo ?? shot.lookAt
    if (shot.type !== 'static' && shot.type !== 'security')
      tl.to(cam, { px: to[0], py: to[1], pz: to[2], lx: lookTo[0], ly: lookTo[1], lz: lookTo[2], roll: shot.rollTo ?? shot.roll ?? 0, duration: shot.duration, ease }, t)
    t += shot.duration
  }

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

  return { tl, duration: Math.max(cfg.duration, end + 0.8) }
}
