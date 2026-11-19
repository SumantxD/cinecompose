import type { SceneConfig, Shot } from './types.ts'

export const CHOREOGRAPHY_PRESETS = [
  { id: 'control-room-pressure', name: 'Control-room pressure', pace: 'pressure' as const, description: 'Establish, isolate evidence, cut to reaction, reveal the signal, hold the decision.' },
  { id: 'quiet-reveal', name: 'Quiet reveal', pace: 'measured' as const, description: 'Longer observation and slower pushes; the same motivated coverage without frantic pacing.' },
]
export const DEFAULT_OUTLINE = 'Control room. The clock stops. A figure appears on one monitor. Stop the tape.'
export type BeatRole = 'hook' | 'detail' | 'reaction' | 'reveal' | 'decision'
export type VisualBeat = 'normal' | 'clock-stop' | 'monitor-figure' | 'signal-lost'
export interface ChoreographyBeat { id: string; role: BeatRole; note: string; at: number; duration: number; visual: VisualBeat; screen?: 'left' | 'center' | 'right' }
export interface ChoreographyPlan {
  version: 1; preset: string; outline: string; pace: 'pressure' | 'measured'
  cut: 'hard' | 'dip'; mirror: boolean; lens: number; endCard: boolean
  beats: ChoreographyBeat[]
}

const roleFor = (text: string, index: number, count: number): BeatRole => {
  if (/stop the tape|choose|decision|decide|press the|what would you do/i.test(text) || (index === count - 1 && index < 2)) return 'decision'
  if (/figure|silhouette|face|appears|reveal|behind/i.test(text)) return 'reveal'
  if (/clock|monitor|screen|dial|button|door|detail|tape/i.test(text)) return 'detail'
  return index === 0 ? 'hook' : 'reaction'
}
const screenFor = (note: string): 'left' | 'center' | 'right' | undefined => {
  if (/\bleft\b/i.test(note)) return 'left'
  if (/\bright\b/i.test(note)) return 'right'
  return undefined
}
const visualFor = (note: string): VisualBeat => {
  if (/clock.*(?:stop|freeze)|(?:stop|freeze).*clock/i.test(note)) return 'clock-stop'
  if (/(?:monitor|screen).*(?:figure|silhouette|face)|(?:figure|silhouette|face).*(?:monitor|screen)/i.test(note)) return 'monitor-figure'
  if (/monitor|screen|signal/i.test(note) && /off|lost|dark|fades/i.test(note)) return 'signal-lost'
  return 'normal'
}
export function parseOutline(outline: string, preset = 'control-room-pressure'): ChoreographyBeat[] {
  const text = outline.trim().slice(0, 4000)
  if (!text) throw new Error('Write a short visual beat outline first.')
  const notes = text.split(/[\n.!?]+/).map((line) => line.trim()).filter(Boolean).slice(0, 13)
  if (notes.length > 12) throw new Error('Keep a draft to 12 visual beats or fewer.')
  const pace = CHOREOGRAPHY_PRESETS.find((p) => p.id === preset)?.pace ?? 'pressure'
  const lengths = pace === 'measured'
    ? { hook: 2.8, detail: 1.6, reaction: 2.1, reveal: 2.4, decision: 3 }
    : { hook: 1.8, detail: 1.1, reaction: 1.5, reveal: 1.7, decision: 2.4 }
  if (!notes.some((note, i) => roleFor(note, i, notes.length) === 'decision')) notes.push('Hold on the controls for the decision. (editorial)')
  let at = 0
  return notes.map((raw, i): ChoreographyBeat => {
    const note = raw.slice(0, 240), role = roleFor(note, i, notes.length), duration = lengths[role]
    const beat = { id: `${String(i + 1).padStart(2, '0')}_${role}`, role, note, at, duration, visual: visualFor(note), screen: screenFor(note) }
    at += duration
    return beat
  })
}

function cameraFor(beat: ChoreographyBeat, lens: number, mirrored: boolean): Shot {
  let shot: Omit<Shot, 'id' | 'duration'>
  const detail = /monitor|screen|figure|silhouette|face|tape/i.test(beat.note)
  const targetX = beat.screen === 'left' ? -3.3 : beat.screen === 'right' ? -1.3 : undefined
  switch (beat.role) {
    case 'detail':
      shot = detail && targetX !== undefined
        ? { type: 'security', from: [targetX + .55, 2.1, -.6], lookAt: [targetX, 1.9, -2.79], fov: 36, fovPortrait: 44 }
        : detail
          ? { type: 'security', from: [-1.9, 2.1, -.7], lookAt: [-2.3, 1.9, -2.79], fov: 36, fovPortrait: 44 }
          : { type: 'static', from: [-2.55, 2.45, -.7], lookAt: [-2.65, 2.45, -2.55], fov: 32, fovPortrait: 38 }
      break
    case 'reaction':
      shot = { type: 'track_lateral', from: [1.6, 1.5, 3.5], to: [.3, 1.55, 3.1], lookAt: [-1, 1.9, -2.79], lookAtTo: [-1.4, 1.9, -2.79], fov: 46, fovPortrait: 62 }
      break
    case 'reveal':
      shot = targetX !== undefined
        ? { type: 'slow_push', from: [targetX + .55, 1.55, 1.25], to: [targetX + .2, 1.68, .85], lookAt: [targetX, 1.9, -2.79], lookAtTo: [targetX, 1.9, -2.79], fov: 38, fovPortrait: 50 }
        : { type: 'slow_push', from: [.2, 1.55, 1.9], to: [.6, 1.7, 1.2], lookAt: [-1.8, 1.9, -2.79], lookAtTo: [-2.3, 1.9, -2.79], fov: 38, fovPortrait: 50 }
      break
    case 'decision':
      shot = { type: 'pan', from: [3, 1.55, 3], to: [3, 1.55, 3], lookAt: [1.3, .77, .65], lookAtTo: [-.4, 1.9, -2.8], fov: 42, fovPortrait: 58 }
      break
    default:
      shot = { type: 'slow_push', from: [2.8, 2, 5.6], to: [2.2, 1.8, 4.8], lookAt: [-1.8, 1.9, -2.75], lookAtTo: [-1.8, 1.9, -2.75], fov: 40, fovPortrait: 58 }
  }
  if (mirrored) {
    const mirror = (point: [number, number, number], aim: [number, number, number]): [number, number, number] => [Math.max(-3.2, Math.min(3.2, aim[0] - (point[0] - aim[0]))), point[1], point[2]]
    const from = mirror(shot.from, shot.lookAt)
    shot.from = from
    if (shot.to) shot.to = mirror(shot.to, shot.lookAtTo ?? shot.lookAt)
  }
  shot.fov = Math.max(18, Math.min(80, shot.fov + lens))
  shot.fovPortrait = Math.max(24, Math.min(100, (shot.fovPortrait ?? shot.fov * 1.45) + lens))
  shot.exposure = .96; shot.eyeLight = 0; shot.roll = 0; shot.ease = 'none'
  return { ...shot, id: beat.id, duration: beat.duration }
}

/** Outline → shot directions → ordinary scene JSON. No dialogue, Ink or story state is changed. */
export function choreographScene(sceneId: string, outline: string, options: Partial<Pick<ChoreographyPlan, 'preset' | 'mirror' | 'lens' | 'cut' | 'endCard'>> = {}, base?: SceneConfig): SceneConfig {
  const preset = options.preset ?? 'control-room-pressure', mirror = options.mirror ?? false, lens = options.lens ?? 0
  const beats = parseOutline(outline, preset)
  const shots = beats.map((beat) => cameraFor(beat, lens, mirror))
  const cues: SceneConfig['cues'] = []
  if (options.cut === 'dip') for (let i = 1; i < beats.length; i++) {
    cues.push({ at: beats[i].at, action: 'fade', to: 1, duration: .04 }, { at: beats[i].at + .04, action: 'fade', to: 0, duration: .06 })
  }
  return {
    sceneId, environment: 'control-room', duration: beats.at(-1)!.at + beats.at(-1)!.duration,
    shots, lighting: { ...base?.lighting, ambientIntensity: .52, exposure: .94, fogDensity: .008, fogColor: '#202b2b', moon: .5 },
    rendering: base?.rendering ? structuredClone(base.rendering) : { profile: 'high', antialias: 'smaa', shadowMapSize: 512, textureAnisotropy: 4, grade: { saturation: -.07, contrast: .04 }, ao: { enabled: true, halfRes: true, quality: 'performance' }, grain: { enabled: true, opacity: .08 } },
    audio: { ambience: [{ sound: 'night_drone', volume: .08 }], music: null }, cues,
    props: { choreography: { version: 1, preset, outline: outline.trim().slice(0, 4000), pace: CHOREOGRAPHY_PRESETS.find((p) => p.id === preset)?.pace ?? 'pressure', cut: options.cut ?? 'hard', mirror, lens, endCard: options.endCard ?? true, beats } },
  }
}

export function validateChoreography(value: unknown): string[] {
  if (value === undefined) return []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['choreography must be an object.']
  const p = value as Partial<ChoreographyPlan>
  const errors: string[] = []
  if (p.version !== 1 || !CHOREOGRAPHY_PRESETS.some((preset) => preset.id === p.preset)) errors.push('Unsupported choreography preset/version.')
  if (typeof p.outline !== 'string' || p.outline.length > 4000) errors.push('Outline must be a string of at most 4000 characters.')
  if (!['pressure', 'measured'].includes(String(p.pace)) || !['hard', 'dip'].includes(String(p.cut))) errors.push('Unknown choreography pace or cut.')
  if (typeof p.mirror !== 'boolean' || typeof p.endCard !== 'boolean') errors.push('Mirror/endCard must be boolean.')
  if (typeof p.lens !== 'number' || !Number.isFinite(p.lens) || Math.abs(p.lens) > 12) errors.push('Lens offset must be within ±12 degrees.')
  if (!Array.isArray(p.beats) || p.beats.length < 1 || p.beats.length > 12) errors.push('Choreography needs 1–12 visual beats.')
  else p.beats.forEach((beat, i) => {
    if (!beat) { errors.push(`Beat ${i + 1} is missing.`); return }
    if (!['hook', 'detail', 'reaction', 'reveal', 'decision'].includes(beat.role) || !['normal', 'clock-stop', 'monitor-figure', 'signal-lost'].includes(beat.visual)) errors.push(`Beat ${i + 1} has an unsupported role/visual.`)
    if (beat.screen !== undefined && !['left', 'center', 'right'].includes(beat.screen)) errors.push(`Beat ${i + 1} has an unsupported monitor side.`)
    if (typeof beat.note !== 'string' || beat.note.length > 240 || !Number.isFinite(beat.at) || beat.at < 0 || !Number.isFinite(beat.duration) || beat.duration <= .05 || beat.duration > 30) errors.push(`Beat ${i + 1} has invalid text/timing.`)
  })
  return errors.map((error) => `choreography: ${error}`)
}

/** An editorial reel end card, not an Ink choice or consequence. */
export function inkOutline(scene: SceneConfig): string {
  return `=== ${scene.sceneId.replace(/[^\w]/g, '_')} ===\n// Direction only. Import deliberately into a new Ink story, then bind choices/consequences there.\n${scene.props?.choreography?.beats.map((b) => `// ${b.role}: ${b.note.replace(/[\r\n]/g, ' ')}`).join('\n')}\n_ # scene: ${scene.sceneId}\n-> END\n`
}
