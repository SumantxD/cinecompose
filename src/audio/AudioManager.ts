import { Howl, Howler } from 'howler'
import { SOUNDS } from './manifest.ts'
import { synthUrl } from './synth.ts'
import type { Vec3 } from '../cinematic/types'
import type { VoiceClip } from './voices'

const howls = new Map<string, Howl>()
const loops = new Map<string, number>()
const ambienceLevels = new Map<string, number>()
const voiceLoads = new Map<string, Promise<Howl>>()
const voiceHowls = new Map<string, Howl>()
const voiceFailures = new Set<string>()
let duckVoice = false
let voiceSerial = 0
let voicePaused = false
let activeVoice: { clip: VoiceClip; at: number; playId?: number } | undefined

function setDucking(value: boolean) {
  if (duckVoice === value) return
  duckVoice = value
  for (const [id, volume] of ambienceLevels) {
    const pid = loops.get(id)
    if (pid === undefined) continue
    const h = howls.get(id)
    if (h) h.fade(h.volume(pid) as number, volume * (value ? 0.7 : 1), 180, pid)
  }
}

function stopVoice() {
  voiceSerial++
  const active = activeVoice
  activeVoice = undefined
  setDucking(false)
  if (!active) return
  const h = voiceHowls.get(active.clip.src)
  if (active.playId !== undefined && h) h.stop(active.playId)
}

function voiceAt(clip: VoiceClip | undefined, at: number) {
  if (scrubbing || voicePaused || !clip || at < 0 || at >= clip.duration) return stopVoice()
  if (voicePaused) return
  if (activeVoice?.clip.id !== clip.id) stopVoice()
  if (!activeVoice) activeVoice = { clip, at }
  const active = activeVoice
  active.at = at
  setDucking(true)
  const serial = voiceSerial
  const h = voiceHowls.get(clip.src)
  if (!h) {
    if (voiceFailures.has(clip.src)) return stopVoice()
    if (!voiceLoads.has(clip.src)) {
      voiceLoads.set(clip.src, load(clip.src, false, false).then((loaded) => {
        voiceHowls.set(clip.src, loaded)
        return loaded
      }).catch((error) => {
        voiceLoads.delete(clip.src)
        voiceFailures.add(clip.src)
        console.warn(`[audio] voice unavailable: ${clip.src}`, error)
        if (serial === voiceSerial) stopVoice()
        throw error
      }))
    }
    void voiceLoads.get(clip.src)!.catch(() => {})
    return
  }
  const end = Math.min(clip.duration, h.duration())
  if (at >= end) return stopVoice()
  if (active.playId === undefined || !h.playing(active.playId)) {
    const pid = h.play()
    active.playId = pid
    h.volume(clip.volume ?? 0.75, pid)
    h.seek(at, pid)
    h.once('end', () => { if (activeVoice === active) stopVoice() }, pid)
  } else if (Math.abs(Number(h.seek(active.playId)) - at) > 0.08) h.seek(at, active.playId)
}

// Live rain: random one-shot drops + slow gusts on the beds, so rain never audibly repeats.
const DROPS: [string, number][] = [['drop_asphalt', 0.5], ['drop_leaf', 0.3], ['drop_puddle', 0.15], ['drip_tin', 0.05]]
const IN_DOOR_DROPS: [string, number][] = [['drip_tin', 0.9], ['drop_puddle', 0.1]]
let rainLevel = 0
let rainIndoors = false
let scrubbing = false
let rainTimer: ReturnType<typeof setTimeout> | undefined
function dropLoop() {
  if (rainLevel <= 0 || scrubbing) return (rainTimer = undefined)
  let r = Math.random()
  const drops = rainIndoors ? IN_DOOR_DROPS : DROPS
  let id = drops[0][0]
  for (const [d, w] of drops) if ((r -= w) < 0) { id = d; break }
  const h = howls.get(id)
  if (h) {
    const pid = h.play()
    h.volume(rainLevel * (rainIndoors ? 0.16 : 0.08) + Math.random() * Math.random() * rainLevel * 0.24, pid)
    h.stereo(Math.random() * 1.8 - 0.9, pid)
    h.rate(0.8 + Math.random() * 0.45, pid)
  }
  // Gusts: the beds drift around their set level.
  for (const bed of ['rain', 'rain_body']) {
    const pid = loops.get(bed)
    if (pid !== undefined && Math.random() < 0.08) howls.get(bed)?.fade(howls.get(bed)!.volume(pid) as number, rainLevel * (bed === 'rain' ? 1 : 0.85) * (0.75 + Math.random() * 0.4), 1800, pid)
  }
  rainTimer = setTimeout(dropLoop, 25 + Math.random() * 140)
}

function load(src: string, loop: boolean, isSynth: boolean) {
  return new Promise<Howl>((resolve, reject) => {
    const h: Howl = new Howl({
      src: [src],
      format: isSynth ? ['wav'] : undefined,
      loop,
      preload: true,
      onload: () => resolve(h),
      onloaderror: (_, e) => reject(e),
    })
  })
}

async function loadSound(id: string) {
  const def = SOUNDS[id]
  if (def.file) {
    try {
      return await load(def.file, !!def.loop, false)
    } catch {
      console.warn(`[audio] ${def.file} failed, using synth for "${id}"`)
    }
  }
  return load(await synthUrl(def.synth), !!def.loop, true)
}

function spatialize(h: Howl, playId: number, p: Vec3) {
  h.pannerAttr({ panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 3, rolloffFactor: 0.8 }, playId)
  h.pos(p[0], p[1], p[2], playId)
}

export const AudioManager = {
  /** Must be called from a user gesture (tap) so mobile browsers allow playback. */
  async init() {
    Howler.autoUnlock = true
    voiceFailures.clear()
    await Promise.all(Object.keys(SOUNDS).map(async (id) => howls.set(id, await loadSound(id))))
  },

  sfx(id: string, volume = 1, position?: Vec3, rate = 1) {
    if (scrubbing) return
    const h = howls.get(id)
    if (!h) return console.warn(`[audio] unknown sound "${id}"`)
    const pid = h.play()
    h.volume(volume * (SOUNDS[id].volume ?? 1), pid)
    if (rate !== 1) h.rate(rate, pid)
    if (position && SOUNDS[id].spatial) spatialize(h, pid, position)
    return pid
  },

  /** Starts (or retargets) a looping bed. volume 0 fades it out and stops it. */
  ambience(id: string, volume: number, fade = 1.5, position?: Vec3) {
    if (id === 'rain' || id === 'rain_indoor') {
      if (volume > 0) rainIndoors = id === 'rain_indoor'
      rainLevel = volume
      if (volume > 0 && !rainTimer) dropLoop()
      ambienceLevels.set('rain_body', !rainIndoors ? volume * 0.85 : 0)
      AudioManager.ambienceBed('rain_body', !rainIndoors ? volume * 0.85 : 0, fade)
    }
    AudioManager.ambienceBed(id, volume, fade, position)
  },

  ambienceBed(id: string, volume: number, fade = 1.5, position?: Vec3) {
    const h = howls.get(id)
    if (!h) return console.warn(`[audio] unknown sound "${id}"`)
    ambienceLevels.set(id, volume * (SOUNDS[id].volume ?? 1))
    let pid = loops.get(id)
    if (volume === 0 && fade === 0) {
      if (pid !== undefined) h.stop(pid)
      loops.delete(id)
      return
    }
    if (pid === undefined) {
      if (volume === 0) return
      pid = h.play()
      h.volume(0, pid)
      loops.set(id, pid)
      if (position && SOUNDS[id].spatial) spatialize(h, pid, position)
    }
    const target = volume * (SOUNDS[id].volume ?? 1) * (duckVoice ? 0.7 : 1)
    h.fade(h.volume(pid) as number, target, fade * 1000, pid)
    if (volume === 0) {
      const p = pid
      h.once('fade', () => { h.stop(p); loops.delete(id) }, p)
    }
  },

  /** Instant volume for a running loop — used to sync the tube hum with its flicker. */
  loopVolume(id: string, volume: number) {
    const pid = loops.get(id)
    if (pid !== undefined) howls.get(id)?.volume(volume * (SOUNDS[id].volume ?? 1) * (duckVoice ? 0.7 : 1), pid)
  },

  listener(pos: Vec3, forward: Vec3) {
    const context = Howler.ctx
    if (!context || context.state !== 'running') return
    try {
      Howler.pos(pos[0], pos[1], pos[2])
      Howler.orientation(forward[0], forward[1], forward[2], 0, 1, 0)
    } catch { /* AudioContext may be torn down during navigation or hot reload. */ }
  },

  hasLoop(id: string) {
    return loops.has(id)
  },

  getRainState() {
    return { indoors: rainIndoors, level: rainLevel }
  },

  /** Timeline seeks update beds silently without firing one-shots or restartable rain drops. */
  setScrubbing(value: boolean) {
    scrubbing = value
    if (value) stopVoice()
    if (!value && rainLevel > 0 && !rainTimer) dropLoop()
  },

  voiceAt(clip: VoiceClip | undefined, offset: number) {
    voiceAt(clip, offset)
  },

  stopVoice,

  setVoicePaused(value: boolean) {
    voicePaused = value
    if (!value) return
    setDucking(false)
    const active = activeVoice
    if (active?.playId !== undefined) voiceHowls.get(active.clip.src)?.pause(active.playId)
  },

  getVoiceState() {
    const active = activeVoice
    return {
      id: active?.clip.id,
      offset: active?.at ?? 0,
      playing: !!active && active.playId !== undefined && !!voiceHowls.get(active.clip.src)?.playing(active.playId),
      ducked: duckVoice,
    }
  },

  stopAll() {
    stopVoice()
    voicePaused = false
    rainLevel = 0
    loops.forEach((pid, id) => howls.get(id)?.stop(pid))
    loops.clear()
    ambienceLevels.clear()
    howls.forEach((h) => h.stop())
  },

  mute(m: boolean) {
    Howler.mute(m)
  },
}
