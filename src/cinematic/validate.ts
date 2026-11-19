import { expandTechniques } from './techniques.ts'
import { PRESETS } from './presets.ts'
import type { SceneConfig } from './types.ts'
import { validateWorld } from '../world/types.ts'
import { validateRenderSettings } from './rendering.ts'
import { validateReferenceStudy } from '../reference/compose.ts'
import { validateChoreography } from './choreography.ts'
import { compileCues, validateCceTrack } from '../cce/engine.ts'

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const vector = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(finite)

function validatePath(value: unknown, duration: number, id: string): string[] {
  if (!record(value)) return [`shot ${id} path must be an object.`]
  const errors: string[] = [], err = (message: string) => errors.push(`shot ${id} path: ${message}`)
  const nodes = Array.isArray(value.nodes) ? value.nodes : [], segments = Array.isArray(value.segments) ? value.segments : []
  if (nodes.length < 2) err('needs at least two nodes.')
  if (!segments.length) err('needs a segment.')
  nodes.forEach((node, i) => {
    if (!record(node)) return err(`node ${i + 1} must be an object.`)
    if (typeof node.id !== 'string' || !node.id) err(`node ${i + 1} needs an id.`)
    if (!['locked', 'direction', 'free'].includes(String(node.mode))) err(`node ${i + 1} has an invalid handle mode.`)
    for (const key of ['position', 'aim', 'in', 'out', 'aimIn', 'aimOut']) if (!vector(node[key])) err(`node ${i + 1} ${key} must be [x, y, z].`)
  })
  const nodeIds = nodes.filter(record).map((n) => n.id).filter((id) => typeof id === 'string')
  if (new Set(nodeIds).size !== nodeIds.length) err('node ids must be unique.')
  const segmentIds = segments.filter(record).map((s) => s.id).filter((id) => typeof id === 'string')
  if (new Set(segmentIds).size !== segmentIds.length) err('segment ids must be unique.')
  let total = 0
  segments.forEach((segment, i) => {
    if (!record(segment)) return err(`segment ${i + 1} must be an object.`)
    if (typeof segment.id !== 'string' || !segment.id) err(`segment ${i + 1} needs an id.`)
    if (!Number.isInteger(segment.from) || !Number.isInteger(segment.to) || (segment.from as number) < 0 || (segment.to as number) >= nodes.length) err(`segment ${i + 1} has invalid node references.`)
    if (segment.to === segment.from) err(`segment ${i + 1} must join different nodes.`)
    if (!finite(segment.duration) || segment.duration <= 0) err(`segment ${i + 1} needs a positive duration.`)
    else total += segment.duration
    if (segment.ease !== undefined && typeof segment.ease !== 'string') err(`segment ${i + 1} has invalid easing.`)
    if (segment.easeRange !== undefined && (!Array.isArray(segment.easeRange) || segment.easeRange.length !== 2 || !segment.easeRange.every(finite) || segment.easeRange[0] < 0 || segment.easeRange[1] > 1 || segment.easeRange[0] >= segment.easeRange[1])) err(`segment ${i + 1} has an invalid easeRange.`)
    if (i > 0 && segment.from !== (segments[i - 1] as Record<string, unknown>).to) err(`segment ${i + 1} must share its start node with the previous segment.`)
  })
  if (segments.length && record(segments[0]) && segments[0].from !== 0) err('first segment must start at node 0.')
  if (segments.length && record(segments[segments.length - 1]) && segments[segments.length - 1].to !== nodes.length - 1) err('last segment must end at the last node.')
  if (Math.abs(total - duration) > 0.01) err(`segment durations sum to ${total.toFixed(3)}s, shot is ${duration}s.`)
  return errors
}

/** Shared by Studio, the dev write endpoint and the branch checker. */
export function validateScene(value: unknown): string[] {
  if (!record(value)) return ['Scene must be a JSON object.']
  const errors: string[] = []
  const id = typeof value.sceneId === 'string' ? value.sceneId : 'scene'
  const err = (message: string) => errors.push(`${id}: ${message}`)

  if (!record(value) || typeof value.sceneId !== 'string' || !/^[a-z][\w-]*$/.test(value.sceneId)) err('sceneId must start with a lowercase letter and contain only letters, numbers, _ or -.')
  if (typeof value.environment !== 'string' || !value.environment) err('environment is required.')
  const props = record(value.props) ? value.props : null
  if (value.environment === 'procedural-world' && !record(props?.world)) err('procedural-world scenes need props.world.')
  if (record(props?.world)) errors.push(...validateWorld(props.world))
  if (!finite(value.duration) || value.duration <= 0) err('duration must be a positive number.')
  if (!record(value.lighting) || !finite(value.lighting.ambientIntensity) || !finite(value.lighting.fogDensity)) err('lighting needs numeric ambientIntensity and fogDensity.')
  errors.push(...validateRenderSettings(value.rendering))
  if (!record(value.audio) || !Array.isArray(value.audio.ambience)) err('audio.ambience must be an array.')
  else value.audio.ambience.forEach((a, i) => {
    if (!record(a) || typeof a.sound !== 'string' || !finite(a.volume)) err(`ambience ${i + 1} needs a sound id and numeric volume.`)
  })

  if (value.props !== undefined && !record(value.props)) err('props must be an object.')
  const burn = record(value.props) ? value.props.paperBurn : undefined
  if (burn !== undefined && (!record(burn) || !finite(burn.at) || burn.at < 0 || !finite(burn.duration) || burn.duration <= 0 || (finite(value.duration) && finite(burn.at) && burn.at > value.duration))) err('paperBurn needs a non-negative at within the scene and a positive duration.')
  const rain = record(value.props) ? value.props.rain : undefined
  if (rain !== undefined && (!record(rain) || (rain.enabled !== undefined && typeof rain.enabled !== 'boolean') || (rain.count !== undefined && (!finite(rain.count) || rain.count < 0 || rain.count > 20000)) || (rain.wind !== undefined && (!Array.isArray(rain.wind) || rain.wind.length !== 2 || rain.wind.some((v: unknown) => !finite(v) || Math.abs(v as number) > 6))))) err('rain needs enabled?: boolean, count 0–20000 and wind [x, z] within ±6.')
  const forest = record(value.props) ? value.props.forest : undefined
  if (forest !== undefined) {
    if (!record(forest)) err('forest settings must be an object.')
    else {
      const limits: Record<string, [number, number]> = { density: [0, 1], textureScale: [4, 60], normalStrength: [0, 2], relief: [0, .6], wetness: [0, 1], wind: [0, 2], mist: [0, .12] }
      for (const [key, [lo, hi]] of Object.entries(limits)) if (key !== 'relief' || forest[key] !== undefined) {
      if (!finite(forest[key]) || (forest[key] as number) < lo || (forest[key] as number) > hi) err(`forest.${key} must be within ${lo}–${hi}.`)
    }
      if (!Number.isInteger(forest.seed) || (forest.seed as number) < 0) err('forest.seed must be a non-negative integer.')
      if (typeof forest.puddles !== 'boolean') err('forest.puddles must be boolean.')
    }
  }
  const mist = record(value.props) ? value.props.groundMist : undefined
  if (mist !== undefined && (!record(mist) || !vector(mist.center) || !finite(mist.width) || mist.width <= 0 || mist.width > 24 || !finite(mist.length) || mist.length <= 0 || mist.length > 48 || (mist.height !== undefined && (!finite(mist.height) || mist.height < 0.1 || mist.height > 0.4)) || (mist.opacity !== undefined && (!finite(mist.opacity) || mist.opacity < 0 || mist.opacity > 0.12)))) err('groundMist needs a center, bounded positive width/length, a low height and restrained opacity.')

  if (value.effects !== undefined) {
    if (!Array.isArray(value.effects)) err('effects must be an array.')
    else {
      const ids = value.effects.filter(record).map((e) => e.id).filter((v) => typeof v === 'string')
      if (new Set(ids).size !== ids.length) err('effect ids must be unique.')
      value.effects.forEach((fx, i) => {
        const label = `effect ${i + 1}`
        if (!record(fx) || typeof fx.id !== 'string' || !fx.id) return void err(`${label} needs an id.`)
        if (!['lightning', 'tornado', 'earthquake', 'flood'].includes(String(fx.type))) err(`${label} has an unknown type.`)
        if (!finite(fx.at) || fx.at < 0) err(`${label} needs a non-negative at.`)
        if (!finite(fx.duration) || fx.duration <= 0 || fx.duration > 120) err(`${label} duration must be within 0–120s.`)
        if (!finite(fx.intensity) || fx.intensity < 0 || fx.intensity > 4) err(`${label} intensity must be within 0–4.`)
        if (fx.type === 'lightning' && fx.seed !== undefined && !Number.isInteger(fx.seed)) err(`${label} seed must be an integer.`)
        if (fx.type === 'lightning' && fx.position !== undefined && !vector(fx.position)) err(`${label} lightning position must be [x, y, z].`)
        if (fx.type === 'flood' && fx.color !== undefined && typeof fx.color !== 'string') err(`${label} flood colour must be a string.`)
        if (fx.type === 'tornado') {
          if (!vector(fx.position)) err(`${label} tornado needs a position [x, y, z].`)
          if (fx.radius !== undefined && (!finite(fx.radius) || fx.radius <= 0 || fx.radius > 12)) err(`${label} tornado radius must be within 0–12m.`)
          if (fx.height !== undefined && (!finite(fx.height) || fx.height < 3 || fx.height > 60)) err(`${label} tornado height must be within 3–60m.`)
        }
        if (fx.type === 'earthquake' && fx.frequency !== undefined && (!finite(fx.frequency) || fx.frequency <= 0 || fx.frequency > 30)) err(`${label} earthquake frequency must be within 0–30.`)
        if (fx.type === 'flood' && (!finite(fx.level) || fx.level < 0 || fx.level > 12)) err(`${label} flood needs a level within 0–12m.`)
      })
    }
  }

  const shots = Array.isArray(value.shots) ? value.shots : []
  errors.push(...validateReferenceStudy(props?.referenceStudy, shots as SceneConfig['shots']))
  errors.push(...validateChoreography(props?.choreography))
  errors.push(...validateCceTrack(props?.cce, finite(value.duration) ? value.duration : undefined))
  if (!shots.length) err('at least one shot is required.')
  let total = 0
  shots.forEach((shot, i) => {
    if (!record(shot)) return void err(`shot ${i + 1} must be an object.`)
    if (typeof shot.id !== 'string' || !shot.id) err(`shot ${i + 1} needs an id.`)
    if (typeof shot.type !== 'string' || !(shot.type in PRESETS)) err(`shot ${i + 1} has unknown camera preset "${String(shot.type)}".`)
    if (!finite(shot.duration) || shot.duration <= 0) err(`shot ${i + 1} needs a positive duration.`)
    else total += shot.duration
    if (!vector(shot.from)) err(`shot ${i + 1} from must be [x, y, z].`)
    if (!vector(shot.lookAt)) err(`shot ${i + 1} lookAt must be [x, y, z].`)
    if (shot.to !== undefined && !vector(shot.to)) err(`shot ${i + 1} to must be [x, y, z].`)
    if (shot.lookAtTo !== undefined && !vector(shot.lookAtTo)) err(`shot ${i + 1} lookAtTo must be [x, y, z].`)
    if ('curve' in shot) err(`shot ${i + 1} uses obsolete curve: true; use a path with explicit handles instead.`)
    if (shot.focus !== undefined && (!record(shot.focus) || typeof shot.focus.object !== 'string' || !shot.focus.object || (shot.focus.local !== undefined && !vector(shot.focus.local)) || (shot.focus.radius !== undefined && (!finite(shot.focus.radius) || shot.focus.radius <= 0)) || (shot.focus.optional !== undefined && typeof shot.focus.optional !== 'boolean'))) err(`shot ${i + 1} focus needs an object id, optional local point and positive radius.`)
    if (shot.path !== undefined && finite(shot.duration)) for (const error of validatePath(shot.path, shot.duration, String(i + 1))) err(error)
    if (!finite(shot.fov) || shot.fov <= 0 || shot.fov >= 180) err(`shot ${i + 1} fov must be between 0 and 180.`)
    if (shot.fovPortrait !== undefined && (!finite(shot.fovPortrait) || shot.fovPortrait <= 0 || shot.fovPortrait >= 180)) err(`shot ${i + 1} fovPortrait must be between 0 and 180.`)
  })
  if (finite(value.duration) && shots.length && Math.abs(total - value.duration) > 0.01) err(`shots sum to ${total.toFixed(2)}s, scene is ${value.duration}s.`)

  let cues: unknown[] = Array.isArray(value.cues) ? value.cues : []
  if (!Array.isArray(value.cues)) err('cues must be an array.')
  try {
    cues = [...cues, ...expandTechniques(value.techniques as SceneConfig['techniques']), ...compileCues(value as unknown as SceneConfig, props?.cce as import('../cce/types').CceTrack | undefined)]
  } catch (e) {
    err(e instanceof Error ? e.message : String(e))
  }
  cues.forEach((cue, i) => {
    if (!record(cue)) return void err(`cue ${i + 1} must be an object.`)
    if (!finite(cue.at) || cue.at < 0) err(`cue ${i + 1} needs a non-negative at time.`)
    else if (finite(value.duration) && cue.at > value.duration) err(`cue at ${cue.at}s is past the end.`)
    if (!['light', 'entity', 'sfx', 'ambience', 'title', 'fade', 'train'].includes(String(cue.action))) err(`cue ${i + 1} has unknown action "${String(cue.action)}".`)
    if (cue.action === 'train') {
      if (!vector(cue.from) || !vector(cue.to)) err(`train cue ${i + 1} needs from/to positions.`)
      if (!finite(cue.duration) || cue.duration <= 0) err(`train cue ${i + 1} needs a positive duration.`)
    }
  })
  return errors
}
