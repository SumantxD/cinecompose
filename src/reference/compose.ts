import type { SceneConfig, Shot, Vec3 } from '../cinematic/types.ts'

export type ReferenceTemplate = 'control-room' | 'diorama'

export interface ReferenceMotion {
  /** Dominant image movement, normalised to frame width/height per second. */
  x: number
  y: number
  /** Estimated zoom change per second. This is not a focal-length measurement. */
  zoom: number
  confidence: number
}

export interface AnalysedShot {
  start: number
  end: number
  time: number
  width: number
  height: number
  file: string
  duration?: number
  score: number
  motion: ReferenceMotion
}

export interface ReferenceAnalysis {
  version: 1
  id: string
  source: { filename: string; sha256: string; rights: 'reference-only' }
  video: { width: number; height: number; fps: number; duration: number }
  range: [number, number]
  template: ReferenceTemplate
  shots: AnalysedShot[]
}

export interface ReferenceFrame {
  url: string
  sourceTime: number
  motion: ReferenceMotion
  transition: 'cut' | 'dissolve'
}

export interface ReferenceStudy {
  version: 1
  id: string
  source: ReferenceAnalysis['source']
  template: ReferenceTemplate
  showPlaceholders: boolean
  frames: Array<{ shotId: string; url: string; width: number; height: number }>
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

function cameraForShot(motion: ReferenceMotion): Partial<Shot> {
  if (motion.confidence < .16) return { type: 'static' }
  const from: Vec3 = [0, 1.6, 4.6], aim: Vec3 = [0, 1.5, -.4]
  if (Math.abs(motion.zoom) > .04) {
    const travel = clamp(motion.zoom * 3.2, -.7, .7)
    return { type: travel >= 0 ? 'slow_push' : 'pull_back', from, to: [0, 1.6, from[2] - travel], lookAt: aim, lookAtTo: aim }
  }
  if (Math.abs(motion.x) > .035 || Math.abs(motion.y) > .035) {
    return {
      type: 'pan', from, to: from, lookAt: aim,
      lookAtTo: [clamp(-motion.x * 3, -.5, .5), aim[1] + clamp(-motion.y * 2.5, -.35, .35), aim[2]],
    }
  }
  return { type: 'static' }
}

export function validateReferenceStudy(value: unknown, shots: Shot[]): string[] {
  if (value === undefined) return shots.some((s) => s.reference) ? ['Reference-image shots require props.referenceStudy.'] : []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['referenceStudy must be an object.']
  const study = value as Record<string, unknown>
  const errors: string[] = []
  if (study.version !== 1) errors.push('referenceStudy.version must be 1.')
  if (typeof study.id !== 'string' || !/^[a-z][\w-]{2,63}$/.test(study.id)) errors.push('referenceStudy.id is invalid.')
  if (!['control-room', 'diorama'].includes(String(study.template))) errors.push('referenceStudy.template is not supported.')
  if (typeof study.showPlaceholders !== 'boolean') errors.push('referenceStudy.showPlaceholders must be boolean.')
  const source = study.source as Record<string, unknown> | undefined
  if (!source || source.rights !== 'reference-only' || typeof source.filename !== 'string' || !/^[a-f\d]{64}$/.test(String(source.sha256))) errors.push('Reference frames need a source filename, SHA-256 and reference-only rights.')
  const id = typeof study.id === 'string' ? study.id : ''
  const pathPattern = new RegExp(`^/__reference/${id}/shots/shot-\\d{2}\\.jpg$`)
  const frames = Array.isArray(study.frames) ? study.frames : []
  if (frames.length !== shots.length) errors.push('referenceStudy must contain exactly one frame per shot.')
  shots.forEach((shot, i) => {
    const frame = frames[i] as Record<string, unknown> | undefined
    const ref = shot.reference as unknown as Record<string, unknown> | undefined
    if (!frame || !ref) { if (frame || ref) errors.push(`Shot ${i + 1} must have a matching placeholder frame.`); return }
    if (frame.url !== ref.url || typeof ref.url !== 'string' || !pathPattern.test(ref.url)) errors.push(`Shot ${i + 1} has an unsafe or mismatched reference image path.`)
    if (!Number.isFinite(frame.width) || !Number.isFinite(frame.height) || Number(frame.width) < 1 || Number(frame.height) < 1) errors.push(`Shot ${i + 1} has invalid reference dimensions.`)
    const motion = ref.motion as Record<string, unknown> | undefined
    if (!motion || ![motion.x, motion.y, motion.zoom].every((v) => typeof v === 'number' && Number.isFinite(v)) || typeof motion.confidence !== 'number' || motion.confidence < 0 || motion.confidence > 1) errors.push(`Shot ${i + 1} has invalid inferred motion.`)
    if (typeof ref.sourceTime !== 'number' || !Number.isFinite(ref.sourceTime) || ref.sourceTime < 0) errors.push(`Shot ${i + 1} has an invalid source timestamp.`)
    if (!['cut', 'dissolve'].includes(String(ref.transition))) errors.push(`Shot ${i + 1} has an unsupported reference transition.`)
  })
  return errors.map((error) => `referenceStudy: ${error}`)
}

export function reconcileReferenceFrames(cfg: SceneConfig) {
  const study = cfg.props?.referenceStudy
  if (!study) return
  const existing = new Map(study.frames.map((frame) => [frame.url, frame]))
  study.frames = cfg.shots.flatMap((shot) => shot.reference ? [{ ...(existing.get(shot.reference.url) ?? { width: 324, height: 576 }), shotId: shot.id, url: shot.reference.url }] : [])
}

/** Convert measured cut times and coarse 2D motion into an editable, isolated scene. */
export function composeReferenceScene(analysis: ReferenceAnalysis): SceneConfig {
  const shots: Shot[] = analysis.shots.map((frame, i) => {
    const duration = Math.max(.05, +(frame.end - frame.start).toFixed(3))
    const movement = cameraForShot(frame.motion)
    return {
      id: `shot-${String(i + 1).padStart(2, '0')}`,
      type: 'static', from: [0, 1.6, 4.6], lookAt: [0, 1.5, -.4], ...movement,
      duration,
      fov: 44, fovPortrait: 52, exposure: .9, eyeLight: 0, roll: 0, ease: 'none',
      reference: {
        url: `/__reference/${analysis.id}/${frame.file}`,
        sourceTime: frame.time,
        motion: frame.motion,
        transition: i > 0 && (frame.score < .24 || duration < .55) ? 'dissolve' : 'cut',
      },
    }
  })
  return {
    sceneId: `reference_${analysis.id}`,
    environment: 'reference-study',
    duration: +shots.reduce((n, shot) => n + shot.duration, 0).toFixed(3),
    shots,
    lighting: { ambientIntensity: .45, exposure: .94, fogDensity: .009, fogColor: '#202b2b', moon: .5 },
    rendering: { profile: 'high', renderScale: 1, antialias: 'smaa', shadowMapSize: 512, textureAnisotropy: 4, grade: { saturation: -.07, contrast: .04 }, bloom: { enabled: false }, grain: { enabled: true, opacity: .12 }, ao: { enabled: true, radius: .6, intensity: 1.6, quality: 'performance', halfRes: true }, dof: { enabled: false } },
    audio: { ambience: [{ sound: 'night_drone', volume: .08 }], music: null },
    cues: [],
    props: {
      referenceStudy: {
        version: 1, id: analysis.id, source: analysis.source, template: analysis.template,
        showPlaceholders: true,
        frames: analysis.shots.map((shot, i) => ({ shotId: `shot-${String(i + 1).padStart(2, '0')}`, url: `/__reference/${analysis.id}/${shot.file}`, width: shot.width, height: shot.height })),
      },
    },
  }
}
