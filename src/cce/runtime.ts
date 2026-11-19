import type { SceneConfig } from '../cinematic/types.ts'
import { BY_ID, sampleClip } from './engine.ts'
import { EMPTY_CCE_FRAME, type CceClip, type CceFrame, type CceTrack } from './types.ts'

// One seekable adapter shared by camera, DOM overlays and the stepped-frame exporter.
export const cceFrame: CceFrame = { ...EMPTY_CCE_FRAME }
export const resetCceFrame = () => Object.assign(cceFrame, EMPTY_CCE_FRAME)

function sampleAt(track: CceTrack, time: number) {
  resetCceFrame()
  let last = -1
  track.clips.forEach((clip, index) => {
    if (time < clip.at || time > clip.at + clip.duration || !BY_ID.has(clip.template)) return
    const sample = sampleClip(clip, (time - clip.at) / clip.duration)
    for (const key of ['dolly', 'truck', 'lift', 'orbit', 'yaw', 'pitch', 'roll', 'fov'] as const) cceFrame[key] += sample[key]
    cceFrame.chromatic = Math.max(cceFrame.chromatic, sample.chromatic)
    cceFrame.flash = Math.max(cceFrame.flash, sample.flash)
    cceFrame.blackout = Math.max(cceFrame.blackout, sample.blackout)
    if (sample.text && index >= last) { cceFrame.text = sample.text; last = index }
  })
}

/** Add a real GSAP timeline layer. No RAF animation is started and no wall clock is read. */
export function addChoreography(tl: GSAPTimeline, cfg: SceneConfig) {
  const track = cfg.props?.cce
  resetCceFrame()
  tl.call(resetCceFrame, [], 0)
  if (!track) return
  for (const clip of track.clips) {
    const progress = { v: 0 }
    tl.to(progress, { v: 1, duration: clip.duration, ease: 'none', onUpdate: () => sampleAt(track, clip.at + progress.v * clip.duration) }, clip.at)
    tl.call(resetCceFrame, [], clip.at + clip.duration)
  }
}

export function trackFor(clips: CceClip[]): CceTrack { return { version: 1, clips } }
