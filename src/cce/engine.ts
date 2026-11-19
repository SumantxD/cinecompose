import { hash } from '../utils/random.ts'
import type { Cue, SceneConfig } from '../cinematic/types.ts'
import { sampleShot } from '../cinematic/curve.ts'
import { expandTechniques } from '../cinematic/techniques.ts'
import { SOUNDS } from '../audio/manifest.ts'
import { CCE_TEMPLATES } from './templates.ts'
import { EMPTY_CCE_FRAME, type CceAction, type CceClip, type CceContext, type CceFrame, type CceTemplate, type CceTrack } from './types.ts'

export const BY_ID = new Map(CCE_TEMPLATES.map((template) => [template.id, template]))
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round = (n: number) => Math.round(n * 1000) / 1000
const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
const ease = (u: number, name: string | undefined) => name === 'linear' ? u : name === 'inOut' ? u * u * (3 - 2 * u) : 1 - (1 - u) ** 3

export function makeClip(templateId: string, at: number, index: number, options: Partial<CceClip> = {}): CceClip {
  const template = BY_ID.get(templateId)
  if (!template) throw new Error(`Unknown choreography template: ${templateId}`)
  return {
    id: options.id ?? `${templateId}-${index + 1}`, template: templateId, at: round(at), duration: options.duration ?? template.duration,
    intensity: options.intensity ?? template.intensity, seed: options.seed ?? 47, variation: options.variation ?? 0,
    entity: options.entity ?? 'chudail', light: options.light, position: options.position, text: options.text,
  }
}

/** Layered camera samples: later actions on one axis take over from the preceding value. */
export function sampleClip(clip: CceClip, fraction: number): CceFrame {
  const template = BY_ID.get(clip.template)
  if (!template) throw new Error(`Unknown choreography template: ${clip.template}`)
  const frame = { ...EMPTY_CCE_FRAME }
  const u = clamp(fraction, 0, 1)
  const value = (action: Extract<CceAction, { kind: 'camera' }>) => {
    const gain = clip.intensity * (1 + clip.variation * (hash(clip.seed + action.at * 997) - .5) * .24)
    return action.amount * gain
  }
  template.actions.forEach((action, index) => {
    if (!('duration' in action)) return
    const local = (u - action.at) / action.duration
    if (action.kind === 'camera') {
      if (local < 0) return
      const p = ease(clamp(local, 0, 1), action.ease), amount = value(action), base = frame[action.axis]
      const v = action.pulse ? base + (amount - base) * Math.sin(p * Math.PI) : base + (amount - base) * p
      // Later writes take over smoothly from the previous value on that axis.
      if (local <= 1) frame[action.axis] = v
      else if (!action.pulse) frame[action.axis] = amount
      return
    }
    if (local < 0 || local > 1) return
    if (action.kind === 'shake') {
      const amplitude = action.amount * clip.intensity * (1 - local * .55)
      const phase = clip.seed * .731 + index * 1.91, t = local * action.duration * clip.duration
      frame.truck += Math.sin(t * (action.frequency ?? 9) * 2.1 + phase) * amplitude
      frame.lift += Math.sin(t * (action.frequency ?? 9) * 2.73 + phase * 1.7) * amplitude * .7
      frame.yaw += Math.sin(t * (action.frequency ?? 9) * 1.43 + phase * 2.3) * amplitude * .65
      return
    }
    if (action.kind === 'text') { if (clip.text?.trim()) frame.text = clip.text.trim().slice(0, 48); return }
    if (action.kind !== 'chromatic' && action.kind !== 'flash' && action.kind !== 'blackout') return
    const p = action.pulse ? Math.sin(local * Math.PI) : local
    const amount = action.amount * clip.intensity * p
    frame[action.kind] = Math.max(frame[action.kind], amount)
  })
  // Bounded author overlay, never unrestricted camera displacement or full RGB separation.
  frame.dolly = clamp(frame.dolly, -2, 2); frame.truck = clamp(frame.truck, -1.5, 1.5)
  frame.lift = clamp(frame.lift, -1, 1); frame.yaw = clamp(frame.yaw, -Math.PI, Math.PI)
  frame.roll = clamp(frame.roll, -.18, .18); frame.chromatic = clamp(frame.chromatic, 0, .0025)
  frame.flash = clamp(frame.flash, 0, .75); frame.blackout = clamp(frame.blackout, 0, 1)
  return frame
}

export function validateCceTrack(value: unknown, duration?: number): string[] {
  if (value === undefined) return []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Choreography track must be an object.']
  const track = value as Partial<CceTrack>, errors: string[] = []
  if (track.version !== 1 || !Array.isArray(track.clips)) return ['Choreography track needs version 1 and a clips array.']
  if (track.clips.length > 48) errors.push('Keep a scene to 48 choreography clips or fewer.')
  const ids = new Set<string>()
  track.clips.forEach((clip, i) => {
    if (!clip || typeof clip !== 'object') { errors.push(`Clip ${i + 1} is invalid.`); return }
    const template = BY_ID.get(clip.template)
    if (!template) errors.push(`Clip ${i + 1} has unknown template "${clip.template}".`)
    if (!/^[a-z][\w-]*$/.test(clip.id) || ids.has(clip.id)) errors.push(`Clip ${i + 1} needs a unique lowercase id.`)
    ids.add(clip.id)
    if (!valid(clip.at) || clip.at < 0 || !valid(clip.duration) || clip.duration < .1 || clip.duration > 30) errors.push(`Clip ${i + 1} has invalid timing.`)
    if (duration !== undefined && valid(clip.at) && valid(clip.duration) && clip.at + clip.duration > duration + .001) errors.push(`Clip ${i + 1} extends past the scene.`)
    if (!valid(clip.intensity) || clip.intensity < 0 || clip.intensity > 1.5 || !Number.isInteger(clip.seed) || clip.seed < 0 || !valid(clip.variation) || clip.variation < 0 || clip.variation > 1) errors.push(`Clip ${i + 1} has invalid intensity, seed or variation.`)
    if (template?.requires?.includes('entity') && (typeof clip.entity !== 'string' || !clip.entity.trim())) errors.push(`Clip ${i + 1} needs an entity target.`)
    if (template?.requires?.includes('light') && (typeof clip.light !== 'string' || !clip.light.trim())) errors.push(`Clip ${i + 1} needs a light target.`)
    if (template?.requires?.includes('text') && (typeof clip.text !== 'string' || !clip.text.trim())) errors.push(`Clip ${i + 1} needs editorial text.`)
    if (clip.text !== undefined && (typeof clip.text !== 'string' || clip.text.length > 48)) errors.push(`Clip ${i + 1} text must be 48 characters or fewer.`)
    if (clip.position !== undefined && (!Array.isArray(clip.position) || clip.position.length !== 3 || !clip.position.every(valid))) errors.push(`Clip ${i + 1} position must be [x, y, z].`)
  })
  return errors.map((error) => `Choreography: ${error}`)
}

function shotAt(cfg: SceneConfig, at: number) {
  if (!Array.isArray(cfg.shots) || !cfg.shots.length) return { position: [0, 1.6, 3] as [number, number, number], aim: [0, 1, 0] as [number, number, number], u: 0, segment: 0 }
  let start = 0, shot = cfg.shots[0]
  for (const candidate of cfg.shots) {
    if (at < start + candidate.duration || candidate === cfg.shots.at(-1)) { shot = candidate; break }
    start += candidate.duration
  }
  return sampleShot(shot, clamp(at - start, 0, shot.duration))
}

function sceneCues(cfg: SceneConfig): Cue[] { return [...(Array.isArray(cfg.cues) ? cfg.cues : []), ...expandTechniques(cfg.techniques)] }

function lightAt(cfg: SceneConfig, target: string, at: number): 'off' | 'on' | 'flicker' | 'dying' {
  let mode: ReturnType<typeof lightAt> = 'on'
  for (const cue of sceneCues(cfg).filter((c) => c.at <= at).sort((a, b) => a.at - b.at))
    if (cue.action === 'light' && cue.target === target) mode = cue.mode
  return mode
}

function entityAt(cfg: SceneConfig, target: string, at: number) {
  let visible = false, position: CceClip['position'], shadowOnly = false
  for (const cue of sceneCues(cfg).filter((c) => c.at <= at).sort((a, b) => a.at - b.at))
    if (cue.action === 'entity' && cue.target === target) {
      visible = cue.visible; if (cue.position) position = cue.position; if (cue.shadowOnly !== undefined) shadowOnly = cue.shadowOnly
    }
  return { visible, position, shadowOnly }
}

/** Resolve scene-owned sound/entity/light events; the camera/visual channels remain seekable timeline samples. */
export function compileCues(cfg: SceneConfig, track: CceTrack | undefined): Cue[] {
  if (!track) return []
  return track.clips.flatMap((clip): Cue[] => {
    const template = BY_ID.get(clip.template)
    if (!template) throw new Error(`Unknown choreography template "${clip.template}".`)
    const at = (fraction: number) => round(clip.at + fraction * clip.duration)
    return template.actions.flatMap((action): Cue[] => {
      if (action.kind === 'sfx') {
        const sample = shotAt(cfg, clip.at)
        const position: [number, number, number] = action.behind
          ? [sample.position[0] + (sample.position[0] - sample.aim[0]) * .3, Math.max(.2, sample.position[1] - .5), sample.position[2] + (sample.position[2] - sample.aim[2]) * .3]
          : clip.position ?? [sample.aim[0], Math.max(.2, sample.aim[1]), sample.aim[2]]
        return [{ at: at(action.at), action: 'sfx', sound: action.sound, volume: round(clamp(action.volume * (.6 + clip.intensity * .4), 0, .45)), position }]
      }
      if (action.kind === 'entity') {
        const target = clip.entity ?? 'chudail', sample = shotAt(cfg, clip.at), previous = entityAt(cfg, target, clip.at)
        const position = clip.position ?? [sample.aim[0], 0, sample.aim[2]] as [number, number, number]
        return [
          { at: at(action.at), action: 'entity', target, visible: action.visible, position, shadowOnly: !!action.shadowOnly },
          { at: at(action.at + action.hold), action: 'entity', target, visible: previous.visible, position: previous.position, shadowOnly: previous.shadowOnly },
        ]
      }
      if (action.kind === 'light') {
        const target = clip.light ?? ''
        return [{ at: at(action.at), action: 'light', target, mode: action.mode }, { at: at(action.at + action.hold), action: 'light', target, mode: lightAt(cfg, target, clip.at) }]
      }
      if (action.kind === 'ambience') {
        const bed = Array.isArray(cfg.audio?.ambience) ? cfg.audio.ambience.find((a) => a.sound === action.sound) : undefined
        return [{ at: at(action.at), action: 'ambience', sound: action.sound, volume: action.volume, fade: action.fade * clip.duration },
          { at: at(action.at + action.hold), action: 'ambience', sound: action.sound, volume: bed?.volume ?? 0, fade: Math.min(.25, clip.duration * .1) }]
      }
      return []
    })
  })
}

/** Deterministic event suggestion with a cooldown; it never modifies story or scene state. */
export function recommendClip(context: CceContext): CceTemplate | undefined {
  const candidates = CCE_TEMPLATES.filter((template) => template.events.includes(context.event) && !(context.recent ?? []).some((r) => r.id === template.id && r.ago < template.cooldown))
  return candidates.sort((a, b) => Math.abs(a.intensity - context.intensity) - Math.abs(b.intensity - context.intensity) || hash(context.seed + CCE_TEMPLATES.indexOf(a)) - hash(context.seed + CCE_TEMPLATES.indexOf(b)))[0]
}

export function assertLibrary() {
  const errors: string[] = []
  for (const template of CCE_TEMPLATES) {
    if (!template.id || !template.name || !template.description || !template.events.length || !template.actions.length || template.duration < .1) errors.push(`${template.id}: incomplete metadata`)
    for (const action of template.actions) {
      const actionDuration = 'duration' in action ? action.duration : 'hold' in action ? action.hold : .001
      const end = action.at + actionDuration
      if (action.at < 0 || end > 1.0001 || actionDuration <= 0) errors.push(`${template.id}: action ${action.kind} timing is outside 0–1.`)
      if (action.kind === 'sfx' && !SOUNDS[action.sound]) errors.push(`${template.id}: unknown sound ${action.sound}`)
      if (action.kind === 'ambience' && !SOUNDS[action.sound]) errors.push(`${template.id}: unknown bed ${action.sound}`)
    }
  }
  if (BY_ID.size !== CCE_TEMPLATES.length) errors.push('Template ids must be unique.')
  return errors
}
