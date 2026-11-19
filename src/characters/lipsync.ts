import { LighterSync } from 'lighter-sync'
import type { FaceSpeech } from './facial.ts'

export const VISEME_SHAPES = ['rest', 'aa', 'ee', 'ih', 'oh', 'oo', 'fv', 'mbp', 'lth', 'wq'] as const
export type VisemeShape = (typeof VISEME_SHAPES)[number]
export interface VisemeCue { t: number; shape: VisemeShape }
export interface LipSyncTimeline { version: 1; duration: number; source: 'lighter-sync' | 'rhubarb'; cues: VisemeCue[] }
export type TalkingMode = 'reactive' | 'viseme'
export interface SavedSpeech { mode: TalkingMode; intensity: number; fileName?: string; timeline?: LipSyncTimeline }

const SHAPES: Record<VisemeShape, { open: number; width: number; round: number }> = {
  rest: { open: 0, width: .32, round: 0 }, aa: { open: .86, width: .46, round: .1 },
  ee: { open: .35, width: .83, round: 0 }, ih: { open: .48, width: .7, round: .04 },
  oh: { open: .46, width: .12, round: .85 }, oo: { open: .63, width: -.05, round: 1 },
  fv: { open: .15, width: .5, round: 0 }, mbp: { open: 0, width: .36, round: 0 },
  lth: { open: .32, width: .45, round: .08 }, wq: { open: .14, width: -.02, round: .9 },
}
const RHUBARB: Record<string, VisemeShape> = { A: 'mbp', B: 'ee', C: 'ee', D: 'aa', E: 'oh', F: 'oo', G: 'fv', H: 'lth', X: 'rest' }
const VISEMES: VisemeShape[] = ['rest','ee','aa','oh','ee','ee','ee','oo','oo','wq','lth','lth','fv','ih','ih','aa','aa','lth','lth','ee','aa','mbp']

export function validTimeline(value: unknown): value is LipSyncTimeline {
  if (!value || typeof value !== 'object') return false
  const timeline = value as LipSyncTimeline
  if (timeline.version !== 1 || !Number.isFinite(timeline.duration) || timeline.duration <= 0 || !['lighter-sync','rhubarb'].includes(timeline.source) || !Array.isArray(timeline.cues)) return false
  return timeline.cues.every((cue, index, all) => cue && Number.isFinite(cue.t) && cue.t >= 0 && cue.t < timeline.duration && (!index || cue.t > all[index - 1].t) && VISEME_SHAPES.includes(cue.shape))
}

export function fromRhubarbJSON(value: unknown): LipSyncTimeline {
  if (!value || typeof value !== 'object') throw new Error('Invalid Rhubarb lip-sync JSON')
  const data = value as { metadata?: { duration?: number }; mouthCues?: { start?: number; end?: number; value?: string }[] }
  const duration = data.metadata?.duration ?? data.mouthCues?.at(-1)?.end
  if (!data.mouthCues?.length || !duration || !Number.isFinite(duration)) throw new Error('Rhubarb file has no mouth cues')
  const cues = data.mouthCues.map(cue => {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || RHUBARB[cue.value ?? ''] === undefined) throw new Error('Invalid Rhubarb mouth cue')
    return { t: Math.max(0, Math.min(duration, cue.start!)), shape: RHUBARB[cue.value!] }
  })
  let previous = -1
  for (const cue of cues) {
    if (cue.t <= previous) throw new Error('Rhubarb cues must be strictly ordered')
    previous = cue.t
  }
  const timeline = { version: 1 as const, duration, source: 'rhubarb' as const, cues }
  if (!validTimeline(timeline)) throw new Error('Invalid Rhubarb timeline')
  return timeline
}

export interface LighterKeyframe { timestamp: number; visemeId: string; fullVisemeId: number }
export function fromLighterKeyframes(keyframes: LighterKeyframe[], duration: number): LipSyncTimeline {
  const timeline: LipSyncTimeline = {
    version: 1, duration, source: 'lighter-sync',
    cues: keyframes.map(frame => ({ t: frame.timestamp, shape: frame.fullVisemeId === 0 ? 'rest' : VISEMES[frame.fullVisemeId] ?? 'aa' })),
  }
  if (!validTimeline(timeline)) throw new Error('Dialogue analysis produced invalid timing')
  return timeline
}

export function sampleTimeline(timeline: LipSyncTimeline, time: number, out: FaceSpeech, intensity = 1): FaceSpeech {
  if (!Number.isFinite(timeline.duration) || time < 0 || time >= timeline.duration) {
    out.open = 0; out.width = .32; out.round = 0; out.emphasis = 0; out.active = false
    return out
  }
  let lo = 0, hi = timeline.cues.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (timeline.cues[mid].t <= time) lo = mid + 1; else hi = mid }
  const index = lo - 1
  if (index < 0) { silent(out); return out }
  const shape = SHAPES[timeline.cues[index].shape], weight = Math.max(0, Math.min(1, intensity))
  if (timeline.cues[index].shape === 'rest') { out.open = 0; out.width = .32; out.round = 0 }
  else {
    const next = timeline.cues[index + 1]
    const span = next ? next.t - timeline.cues[index].t : timeline.duration - timeline.cues[index].t
    const blend = Math.min(1, (next ? (time - timeline.cues[index].t) / Math.max(.025, span) : 0) / .25)
    const nextShape = SHAPES[next?.shape ?? timeline.cues[index].shape]
    const eased = blend * blend * (3 - 2 * blend)
    out.open = (shape.open + (nextShape.open - shape.open) * eased) * weight
    out.width = shape.width + (nextShape.width - shape.width) * eased
    out.round = shape.round + (nextShape.round - shape.round) * eased
  }
  const active = timeline.cues[index].shape !== 'rest'
  out.emphasis = active ? .35 + out.open * .5 : 0
  out.active = active && weight > .001
  return out
}

const silent = (frame: FaceSpeech): void => { frame.open = 0; frame.width = .32; frame.round = 0; frame.emphasis = 0; frame.active = false }

export class DialogueController {
  readonly frame: FaceSpeech = { open: 0, width: .32, round: 0, emphasis: 0, active: false, intensity: 1 }
  mode: TalkingMode = 'viseme'
  intensity = 1
  timeline?: LipSyncTimeline
  fileName?: string
  onEnded?: () => void
  private audio?: HTMLAudioElement
  private context?: AudioContext
  private source?: AudioNode
  private analyser?: AnalyserNode
  private waveform?: Uint8Array<ArrayBuffer>
  private frequencies?: Uint8Array<ArrayBuffer>
  private url?: string
  private request = 0
  private smooth = 0
  private lastTime = 0
  private stream?: MediaStream
  private streamPlaying = false
  get isStream(): boolean { return !!this.stream }

  get playing(): boolean { return this.stream ? this.streamPlaying : !!this.audio && !this.audio.paused && !this.audio.ended }
  get time(): number { return this.audio?.currentTime ?? 0 }
  get duration(): number { return this.timeline?.duration ?? this.audio?.duration ?? 0 }
  get loaded(): boolean { return !!this.audio || !!this.stream }

  restore(settings?: SavedSpeech): void {
    this.mode = settings?.mode ?? 'viseme'
    this.intensity = settings?.intensity ?? 1
    this.timeline = settings?.timeline
    this.fileName = settings?.fileName
  }

  async load(file: File, mode: TalkingMode = 'viseme', transcript = '', savedTimeline?: LipSyncTimeline): Promise<void> {
    if (file.size > 25 * 1024 * 1024) throw new Error('Choose a dialogue file under 25 MB.')
    const request = ++this.request
    this.clearAudio()
    if (!file.type.startsWith('audio/')) throw new Error('Choose an audio file for dialogue.')
    const bytes = await file.arrayBuffer()
    const context = new AudioContext()
    let decoded: AudioBuffer
    try { decoded = await context.decodeAudioData(bytes) } catch (error) { await context.close(); throw error }
    if (request !== this.request) { await context.close(); return }
    if (decoded.duration > 120 || decoded.duration < .1) { await context.close(); throw new Error('Dialogue must be between 0.1 and 120 seconds.') }
    this.context = context
    this.mode = mode
    this.fileName = file.name
    this.url = URL.createObjectURL(file)
    const audio = new Audio(this.url)
    audio.preload = 'auto'
    audio.addEventListener('ended', () => { if (this.audio === audio) { silent(this.frame); this.onEnded?.() } })
    this.audio = audio
    if (mode === 'viseme') {
      try {
        if (savedTimeline && validTimeline(savedTimeline) && Math.abs(savedTimeline.duration - decoded.duration) < .05) this.timeline = savedTimeline
        else {
          const engine = new LighterSync({ mode: 'full' })
          const frames = await engine.prepare(decoded, transcript)
          if (request !== this.request) { await context.close(); return }
          this.timeline = fromLighterKeyframes(frames, decoded.duration)
        }
      } catch (error) {
        this.clearAudio()
        throw new Error(`Dialogue analysis failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
    if (request !== this.request) { await context.close(); return }
    const source = context.createMediaElementSource(audio)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = .52
    source.connect(analyser); analyser.connect(context.destination)
    this.source = source; this.analyser = analyser
    this.waveform = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
    this.frequencies = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    this.smooth = 0
    this.lastTime = 0
  }

  async connectStream(stream: MediaStream): Promise<void> {
    const request = ++this.request
    this.clearAudio()
    const context = new AudioContext()
    try {
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      const source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      await context.resume()
      if (request !== this.request) { stream.getTracks().forEach(track => track.stop()); await context.close(); return }
      this.context = context; this.source = source; this.analyser = analyser
      this.waveform = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
      this.frequencies = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      this.mode = 'reactive'; this.stream = stream; this.streamPlaying = true
      this.fileName = 'Live microphone'
    } catch (error) {
      stream.getTracks().forEach(track => track.stop())
      await context.close()
      throw error
    }
  }

  stopStream(): void { this.request++; this.pause(); this.clearAudio(); this.fileName = undefined }

  async play(): Promise<void> {
    if (this.stream) { await this.context?.resume(); this.streamPlaying = true; return }
    if (!this.audio) throw new Error('Choose a dialogue file first.')
    await this.context?.resume()
    await this.audio.play()
  }

  pause(): void { this.audio?.pause(); this.streamPlaying = false; silent(this.frame); this.smooth = 0 }
  async replay(): Promise<void> { this.seek(0); await this.play() }
  seek(time: number): void {
    const safe = Number.isFinite(time) ? Math.max(0, Math.min(this.duration, time)) : 0
    if (this.audio) this.audio.currentTime = safe
    this.lastTime = safe; this.smooth = 0
    if (this.timeline && this.mode === 'viseme') sampleTimeline(this.timeline, safe, this.frame, this.intensity)
    else silent(this.frame)
  }

  sample(time?: number): FaceSpeech {
    if (!this.loaded) { silent(this.frame); return this.frame }
    if (this.mode === 'viseme') {
      if (!this.timeline) { silent(this.frame); return this.frame }
      if (time !== undefined) return sampleTimeline(this.timeline, time, this.frame, this.intensity)
      if (!this.playing) { silent(this.frame); return this.frame }
      return sampleTimeline(this.timeline, this.time, this.frame, this.intensity)
    }
    if (!this.playing || !this.analyser || !this.waveform || !this.frequencies) { silent(this.frame); return this.frame }
    this.analyser.getByteTimeDomainData(this.waveform)
    this.analyser.getByteFrequencyData(this.frequencies)
    let sum = 0, low = 0, high = 0
    for (const sample of this.waveform) { const value = (sample - 128) / 128; sum += value * value }
    for (let index = 2; index < this.frequencies.length; index++) {
      const weight = this.frequencies[index] / 255
      if (index < 25) low += weight
      if (index >= 25 && index < 65) high += weight
    }
    const rms = Math.sqrt(sum / this.waveform.length)
    const now = this.stream ? this.context!.currentTime : this.time
    const elapsed = Math.min(.1, Math.max(.005, now - this.lastTime))
    this.lastTime = now
    const target = rms > .009 ? Math.min(1, rms * 12) * this.intensity : 0
    this.smooth += (target - this.smooth) * (1 - Math.exp(-elapsed * 20))
    this.frame.open = this.smooth * .92
    this.frame.width = .38 + high / Math.max(.001, high + low) * .46
    this.frame.round = Math.max(0, low / Math.max(.001, high + low) - .78) * 2
    this.frame.emphasis = this.smooth * .6
    this.frame.active = this.smooth > .006
    if (!this.frame.active) silent(this.frame)
    return this.frame
  }

  sampleAt(time: number, mode: TalkingMode = this.mode, timeline = this.timeline, intensity = this.intensity): FaceSpeech {
    if (mode === 'viseme' && timeline) return sampleTimeline(timeline, time, this.frame, intensity)
    silent(this.frame)
    return this.frame
  }

  private clearAudio(): void {
    const context = this.context
    this.source?.disconnect(); this.analyser?.disconnect()
    void context?.close().catch(() => {})
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = undefined
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src') }
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = undefined; this.audio = undefined; this.context = undefined; this.source = undefined; this.analyser = undefined
    this.waveform = undefined; this.frequencies = undefined; this.timeline = undefined; this.streamPlaying = false
    silent(this.frame); this.smooth = 0
  }

  dispose(): void { this.request++; this.pause(); this.clearAudio(); this.fileName = undefined }
}
