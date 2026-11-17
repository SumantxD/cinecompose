import episode from '../story/episode-001.ink'
import { StoryEngine, type Beat } from '../story/StoryEngine'
import { buildTimeline, paceLines } from '../cinematic/timeline'
import { clock } from '../cinematic/clock'
import { SCENES, animatic } from '../scenes/registry'
import { useStore } from '../state/store'
import { AudioManager } from '../audio/AudioManager'
import type { SceneConfig } from '../cinematic/types'
import type { Line } from '../story/StoryEngine'
export { inspectFrame } from '../cinematic/quality'
export { getSurfaceStatus } from '../components/SurfaceTextures'
export const getRainState = () => AudioManager.getRainState()
export const getVoiceState = () => AudioManager.getVoiceState()
import { Howler } from 'howler'

export const studio = new URLSearchParams(location.search).has('studio')

// Plays the story: Ink beat → scene config → one scrubbed timeline on the scene clock → choices or next beat.

let engine: StoryEngine
/** Story snapshots taken before each beat that ends in a choice — "return to the last decision". */
let checkpoints: ReturnType<StoryEngine['save']>[] = []
let current: { tl: ReturnType<typeof buildTimeline>["tl"]; duration: number; voices: ReturnType<typeof buildTimeline>["voices"]; beat: Beat; done: boolean } | null = null
let ambience = new Set<string>()
export let environment = 'void'
export let lighting: SceneConfig['lighting'] = animatic('').lighting
export let scene: SceneConfig = animatic('')

export function start(knot?: string) {
  AudioManager.stopAll()
  ambience = new Set()
  engine = new StoryEngine(episode)
  engine.start(knot)
  checkpoints = []
  useStore.getState().set({ phase: 'playing', flags: {}, showTitle: false, caption: null, choices: [], blackout: 1, epitaph: null, canRetry: false })
  playNext()
}

/** Replays the beat that led to the most recent decision, from its start. */
export function retry() {
  const cp = checkpoints.pop()
  if (!cp) return
  AudioManager.stopAll()
  ambience = new Set()
  engine.load(cp)
  useStore.getState().set({ phase: 'playing', showTitle: false, caption: null, choices: [], blackout: 1, epitaph: null })
  playNext()
}

function playNext() {
  const snap = engine.save()
  const beat = engine.next()
  if (beat.choices.length) checkpoints.push(snap)
  const cfg = SCENES.get(beat.sceneId) ?? animatic(beat.sceneId)
  if (cfg.environment === 'void') cfg.duration = paceLines(beat.lines).end + 1.2

  const next = new Set(cfg.audio.ambience.map((a) => a.sound))
  ambience.forEach((s) => next.has(s) || AudioManager.ambience(s, 0))
  cfg.audio.ambience.forEach((a) => AudioManager.ambience(a.sound, a.volume))
  ambience = next

  environment = cfg.environment
  lighting = cfg.lighting
  scene = cfg
  // Built scenes open visible unless they author their own fade-in at 0.
  const fadesIn = cfg.cues.some((c) => c.action === 'fade' && c.at === 0)
  useStore.getState().set({ sceneId: cfg.sceneId, lights: {}, entities: {}, flags: { ...engine.flags }, caption: null, ...(cfg.environment !== 'void' && !fadesIn && { blackout: 0 }) })
  const { tl, duration, voices } = buildTimeline(cfg, beat.lines)
  current = { tl, duration, voices, beat, done: false }
  clock.t = 0
}

// ── Studio preview: one scene, scrubbable, pausable (src/studio). ─────────────────────────────
export let paused = false
export function setPaused(p: boolean) {
  paused = p
  // Studio is silent while paused/scrubbing; the user's mute preference applies only during playback.
  if (studio) Howler.mute(p || useStore.getState().muted)
  AudioManager.setVoicePaused(p)
}

/** Loads a scene config (possibly unsaved edits) and jumps to time t. Lines = its Ink captions. */
export function previewScene(cfg: SceneConfig, t = 0, lines: Line[] = [], flags?: Record<string, unknown>) {
  AudioManager.stopAll()
  Howler.mute(true)
  AudioManager.setScrubbing(true)
  environment = cfg.environment
  lighting = cfg.lighting
  scene = cfg
  const s = useStore.getState()
  s.set({ phase: 'playing', sceneId: `${cfg.sceneId}@${Date.now()}`, lights: {}, entities: {}, caption: null, choices: [], blackout: 0, showTitle: false, ...(flags ? { flags } : {}) })
  cfg.audio.ambience.forEach((a) => AudioManager.ambience(a.sound, a.volume, 0))
  const { tl, duration, voices } = buildTimeline(cfg, lines)
  current = { tl, duration, voices, beat: { sceneId: cfg.sceneId, lines, choices: [], ended: false }, done: false }
  clock.t = 0
  // Step through state, but never emit one-shot sounds while seeking.
  for (let k = 0; clock.t < t - 1e-6 && k < 10000; k++) {
    clock.t = Math.min(t, clock.t + 0.05)
    tl.time(Math.min(clock.t, duration), false)
  }
  tl.time(Math.min(Math.max(clock.t, 0.001), duration), false) // t = 0 still applies the first shot
  AudioManager.setScrubbing(false)
  Howler.mute(paused || useStore.getState().muted)
  return duration
}

/** Advance exactly dt even while paused — frame-by-frame export (`scripts/render-playthrough.js`). */
export function step(dt: number) {
  const p = paused
  paused = false
  tick(dt)
  paused = p
}

/** Called every frame. The clock keeps running during choices so rain and flicker never freeze. */
export function tick(dt: number) {
  if (paused) return
  if (studio) {
    clock.t += Math.min(dt, 0.1)
    if (current) current.tl.time(Math.min(clock.t, current.duration), false)
    return
  }
  clock.t += Math.min(dt, 0.1)
  if (!current || current.done) return
  current.tl.time(Math.min(clock.t, current.duration), false)
  const voice = current.voices.find((v) => clock.t >= v.at && clock.t < v.at + v.duration)
  AudioManager.voiceAt(voice, voice ? clock.t - voice.at : 0)
  if (clock.t < current.duration) return
  current.done = true
  const { beat } = current
  const s = useStore.getState()
  AudioManager.stopVoice()
  if (beat.choices.length) {
    const last = beat.lines.at(-1)
    s.set({ phase: 'choice', choices: beat.choices, caption: last ? { speaker: last.speaker, text: last.text } : null })
  } else if (beat.ended && beat.epitaph) s.set({ phase: 'dead', epitaph: beat.epitaph, canRetry: checkpoints.length > 0, caption: null })
  else if (beat.ended) s.set({ phase: 'ended', flags: { ...engine.flags }, caption: null })
  else playNext()
}

export function choose(index: number) {
  engine.choose(index)
  useStore.getState().set({ phase: 'playing', choices: [], caption: null })
  playNext()
}
