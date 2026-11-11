import { Howl, Howler } from 'howler'
import { SOUNDS } from './manifest'
import { synthUrl } from './synth'
import type { Vec3 } from '../cinematic/types'

const howls = new Map<string, Howl>()
const loops = new Map<string, number>()

// Live rain: random one-shot drops + slow gusts on the beds, so rain never audibly repeats.
const DROPS: [string, number][] = [['drop_asphalt', 0.5], ['drop_leaf', 0.3], ['drop_puddle', 0.15], ['drip_tin', 0.05]]
let rainLevel = 0
let rainTimer: ReturnType<typeof setTimeout> | undefined
function dropLoop() {
  if (rainLevel <= 0) return (rainTimer = undefined)
  let r = Math.random(), id = DROPS[0][0]
  for (const [d, w] of DROPS) if ((r -= w) < 0) { id = d; break }
  const h = howls.get(id)
  if (h) {
    const pid = h.play()
    h.volume(rainLevel * (0.08 + Math.random() * Math.random() * 0.5), pid)
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
    await Promise.all(Object.keys(SOUNDS).map(async (id) => howls.set(id, await loadSound(id))))
  },

  sfx(id: string, volume = 1, position?: Vec3, rate = 1) {
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
    if (id === 'rain') {
      rainLevel = volume
      if (volume > 0 && !rainTimer) dropLoop()
      AudioManager.ambienceBed('rain_body', volume * 0.85, fade)
    }
    AudioManager.ambienceBed(id, volume, fade, position)
  },

  ambienceBed(id: string, volume: number, fade = 1.5, position?: Vec3) {
    const h = howls.get(id)
    if (!h) return console.warn(`[audio] unknown sound "${id}"`)
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
    const target = volume * (SOUNDS[id].volume ?? 1)
    h.fade(h.volume(pid) as number, target, fade * 1000, pid)
    if (volume === 0) {
      const p = pid
      h.once('fade', () => { h.stop(p); loops.delete(id) }, p)
    }
  },

  /** Instant volume for a running loop — used to sync the tube hum with its flicker. */
  loopVolume(id: string, volume: number) {
    const pid = loops.get(id)
    if (pid !== undefined) howls.get(id)?.volume(volume * (SOUNDS[id].volume ?? 1), pid)
  },

  listener(pos: Vec3, forward: Vec3) {
    Howler.pos(pos[0], pos[1], pos[2])
    Howler.orientation(forward[0], forward[1], forward[2], 0, 1, 0)
  },

  stopAll() {
    rainLevel = 0
    loops.forEach((pid, id) => howls.get(id)?.stop(pid))
    loops.clear()
    howls.forEach((h) => h.stop())
  },

  mute(m: boolean) {
    Howler.mute(m)
  },
}
