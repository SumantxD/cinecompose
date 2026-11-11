// Procedural fallbacks for every sound in the manifest, rendered offline and encoded to WAV blobs.
// ponytail: synthesized placeholders; replace with recorded CC0 files via `file` in manifest.ts.

const SR = 44100

type Build = (ctx: OfflineAudioContext) => void | Promise<void>

async function render(seconds: number, build: Build, channels = 2): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(channels, Math.ceil(seconds * SR), SR)
  await build(ctx)
  return ctx.startRendering()
}

function noise(ctx: BaseAudioContext, seconds: number, color: 'white' | 'brown' = 'white', channels = 2) {
  const buf = ctx.createBuffer(channels, Math.ceil(seconds * SR), SR)
  for (let c = 0; c < channels; c++) {
    const d = buf.getChannelData(c)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      } else d[i] = w
    }
  }
  return buf
}

function chain(ctx: BaseAudioContext, src: AudioNode, ...nodes: AudioNode[]) {
  nodes.reduce((a, b) => (a.connect(b), b), src).connect(ctx.destination)
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

function gain(ctx: BaseAudioContext, v: number) {
  const g = ctx.createGain()
  g.gain.value = v
  return g
}

function reverb(ctx: BaseAudioContext, seconds: number, decay: number) {
  const ir = noise(ctx, seconds)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] *= Math.pow(1 - i / d.length, decay)
  }
  const conv = ctx.createConvolver()
  conv.buffer = ir
  return conv
}

/** A buffer from a per-sample function of time. */
function shaped(ctx: BaseAudioContext, seconds: number, f: (t: number) => number) {
  const buf = ctx.createBuffer(1, Math.ceil(seconds * SR), SR)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = f(i / SR)
  return buf
}

/** Slow random intensity waves (rain gusting) multiplied into a buffer: depth 0..1 at roughly `rate` Hz. */
function waves(buf: AudioBuffer, depth: number, rate: number) {
  const pts = Array.from({ length: Math.ceil((buf.length / SR) * rate * 4) + 2 }, () => Math.random())
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const x = (i / SR) * rate * 4, k = Math.floor(x), f = x - k
      const e = pts[k] + (pts[k + 1] - pts[k]) * (f * f * (3 - 2 * f))
      d[i] *= 1 - depth + depth * 2 * e
    }
  }
  return buf
}

/** Crossfades the last `xf` seconds into the start so the buffer loops without a click. */
function loopify(buf: AudioBuffer, xf: number): AudioBuffer {
  const n = Math.floor(xf * SR)
  const len = buf.length - n
  const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: len, sampleRate: SR })
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c)
    const dst = out.getChannelData(c)
    dst.set(src.subarray(0, len))
    for (let i = 0; i < n; i++) {
      const t = i / n
      dst[i] = src[i] * Math.sqrt(t) + src[len + i] * Math.sqrt(1 - t)
    }
  }
  return out
}

const synths: Record<string, () => Promise<AudioBuffer>> = {
  // Monsoon rain, layer A: broadband hiss with slow intensity waves. 11.3 s loop.
  rain: async () => loopify(await render(12.8, (ctx) => {
    const hiss = ctx.createBufferSource()
    hiss.buffer = waves(noise(ctx, 12.8), 0.28, 0.06)
    chain(ctx, hiss, filter(ctx, 'highpass', 450), filter(ctx, 'lowpass', 8000), gain(ctx, 0.24))
    const wash = ctx.createBufferSource()
    wash.buffer = waves(noise(ctx, 12.8, 'brown'), 0.22, 0.04)
    chain(ctx, wash, filter(ctx, 'lowpass', 700), gain(ctx, 0.45))
    hiss.start(); wash.start()
  }), 1.5),

  // Layer B: rain on leaves and earth — dense small impacts, band-limited, its own gust pattern. 13.7 s loop.
  rain_body: async () => loopify(await render(15.2, (ctx) => {
    const buf = ctx.createBuffer(2, 15.2 * SR, SR)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let k = 0; k < 5200; k++) {
        const at = Math.floor(Math.random() * (d.length - 400))
        const amp = (0.05 + Math.random() * 0.25) * (0.7 + 0.3 * Math.sin(at / SR * 0.9 + c))
        const len = 80 + Math.random() * 300
        for (let i = 0; i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (len * 0.25))
      }
    }
    const src = ctx.createBufferSource()
    src.buffer = waves(buf, 0.3, 0.05)
    chain(ctx, src, filter(ctx, 'bandpass', 1500, 0.5), gain(ctx, 0.5))
    src.start()
  }), 1.5),

  // One-shot drops for the live scheduler (AudioManager): each plays with random pan/pitch/level.
  drop_asphalt: () => render(0.15, (ctx) => {
    const s = ctx.createBufferSource()
    s.buffer = shaped(ctx, 0.15, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 90))
    chain(ctx, s, filter(ctx, 'bandpass', 1900, 1.2), gain(ctx, 0.9))
    s.start()
  }, 1),
  drop_leaf: () => render(0.08, (ctx) => {
    const s = ctx.createBufferSource()
    s.buffer = shaped(ctx, 0.08, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 160))
    chain(ctx, s, filter(ctx, 'highpass', 3800), gain(ctx, 0.7))
    s.start()
  }, 1),
  drop_puddle: () => render(0.2, (ctx) => {
    const s = ctx.createBufferSource()
    s.buffer = shaped(ctx, 0.2, (t) => Math.sin(2 * Math.PI * (700 + 2600 * t) * t) * Math.exp(-t * 35) * 0.8 + (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.3)
    chain(ctx, s, filter(ctx, 'lowpass', 4000))
    s.start()
  }, 1),
  drip_tin: () => render(0.6, (ctx) => {
    const s = ctx.createBufferSource()
    s.buffer = shaped(ctx, 0.6, (t) => ([2130, 3410, 5230].reduce((v, f, i) => v + Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (9 + i * 5)) / (i + 1), 0)) * 0.35 + (t < 0.004 ? Math.random() - 0.5 : 0))
    chain(ctx, s, filter(ctx, 'highpass', 900))
    s.start()
  }, 1),

  // Indian mains are 50 Hz: tube-light ballast hum lives on 100 Hz and its harmonics.
  hum: () =>
    render(2, (ctx) => {
      const buf = ctx.createBuffer(1, 2 * SR, SR)
      const d = buf.getChannelData(0)
      const amps = [0.5, 1, 0.45, 0.6, 0.2, 0.25, 0.1]
      for (let i = 0; i < d.length; i++) {
        const t = i / SR
        let v = 0
        amps.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * 50 * (k + 1) * t)))
        d[i] = Math.tanh(v * 0.9) * 0.3
      }
      const s = ctx.createBufferSource()
      s.buffer = buf
      chain(ctx, s, filter(ctx, 'lowpass', 2200))
      s.start()
    }, 1),

  // Night air: sub rumble + slowly breathing wind.
  night_drone: async () =>
    loopify(
      await render(13, (ctx) => {
        const s = ctx.createBufferSource()
        s.buffer = noise(ctx, 13, 'brown')
        const g = gain(ctx, 0.5)
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.09
        const depth = gain(ctx, 0.35)
        lfo.connect(depth).connect(g.gain)
        chain(ctx, s, filter(ctx, 'lowpass', 260), g)
        s.start(); lfo.start()
      }),
      2,
    ),

  // Starter click + a stutter of ballast buzz.
  tube_tick: () =>
    render(0.5, (ctx) => {
      const buf = ctx.createBuffer(1, 0.5 * SR, SR)
      const d = buf.getChannelData(0)
      for (let i = 0; i < 300; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 40)
      for (let i = 2000; i < d.length; i++) {
        const t = i / SR
        d[i] += Math.sign(Math.sin(2 * Math.PI * 100 * t)) * 0.12 * (Math.random() < 0.97 ? 1 : 0) * Math.exp(-(t - 0.05) * 6)
      }
      const s = ctx.createBufferSource()
      s.buffer = buf
      chain(ctx, s, filter(ctx, 'lowpass', 3000))
      s.start()
    }, 1),

  // The motif. Three bell-like notes that could be a distant railway signal — the last one sags flat.
  signal: () =>
    render(6, (ctx) => {
      const dry = gain(ctx, 0.5)
      const wet = gain(ctx, 0.9)
      const out = filter(ctx, 'lowpass', 2600)
      dry.connect(out)
      dry.connect(reverb(ctx, 3.5, 3)).connect(wet).connect(out)
      out.connect(ctx.destination)
      const notes = [659.25, 523.25, 466.16]
      notes.forEach((f, n) => {
        const t0 = 0.2 + n * 0.62
        ;[1, 2.01, 2.76, 5.4].forEach((ratio, p) => {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.frequency.setValueAtTime(f * ratio, t0)
          if (n === 2) o.frequency.linearRampToValueAtTime(f * ratio * 0.97, t0 + 1.6)
          const a = 0.18 / (p + 1)
          g.gain.setValueAtTime(0, t0)
          g.gain.linearRampToValueAtTime(a, t0 + 0.008)
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8 / (p * 0.6 + 1))
          o.connect(g).connect(dry)
          o.start(t0)
          o.stop(t0 + 2)
        })
      })
    }),

  // One wet step on asphalt: heel thud, sole slap, a little splash.
  footstep: () =>
    render(0.45, (ctx) => {
      const buf = ctx.createBuffer(1, 0.45 * SR, SR)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) {
        const t = i / SR
        d[i] = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 40) * 0.9
          + (Math.random() * 2 - 1) * Math.exp(-t * 55) * 0.5
          + (t > 0.05 ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.05) * 30) * 0.18 : 0)
      }
      const s = ctx.createBufferSource()
      s.buffer = buf
      chain(ctx, s, filter(ctx, 'lowpass', 2600), gain(ctx, 0.9))
      s.start()
    }, 1),

  // Payal: a cluster of tiny ankle bells shaken by one step.
  anklets: () =>
    render(0.9, (ctx) => {
      const out = gain(ctx, 0.5)
      out.connect(reverb(ctx, 1.2, 4)).connect(ctx.destination)
      out.connect(ctx.destination)
      for (let k = 0; k < 9; k++) {
        const t0 = 0.01 + Math.random() * 0.12
        const f = 3600 + Math.random() * 3200
        ;[1, 1.51, 2.32].forEach((r, p) => {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.frequency.value = f * r
          g.gain.setValueAtTime(0, t0)
          g.gain.linearRampToValueAtTime(0.05 / (p + 1), t0 + 0.002)
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22 / (p + 1))
          o.connect(g).connect(out)
          o.start(t0)
          o.stop(t0 + 0.3)
        })
      }
    }),

  // Diesel loco horn, two dissonant reeds, approaching (swell + slight Doppler rise) — then the cut.
  train_horn: () =>
    render(3.2, (ctx) => {
      const out = filter(ctx, 'lowpass', 2400)
      const g = gain(ctx, 0)
      g.gain.setValueAtTime(0.04, 0)
      g.gain.exponentialRampToValueAtTime(0.5, 3.0)
      out.connect(g).connect(ctx.destination)
      g.connect(reverb(ctx, 2.5, 3)).connect(gain(ctx, 0.4)).connect(ctx.destination)
      ;[311, 370, 466].forEach((f) => {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f, 0)
        o.frequency.linearRampToValueAtTime(f * 1.018, 3.1)
        o.connect(gain(ctx, 0.22)).connect(out)
        o.start(0)
        o.stop(3.2)
      })
    }),

  // The one loud moment: sub drop, a choked burst, a dissonant cluster that hangs.
  capture_hit: () =>
    render(3, (ctx) => {
      const sub = ctx.createOscillator()
      const sg = ctx.createGain()
      sub.frequency.setValueAtTime(58, 0)
      sub.frequency.exponentialRampToValueAtTime(28, 1.4)
      sg.gain.setValueAtTime(0.9, 0)
      sg.gain.exponentialRampToValueAtTime(0.001, 1.8)
      sub.connect(sg).connect(ctx.destination)
      sub.start(0)
      const n = ctx.createBufferSource()
      n.buffer = noise(ctx, 0.6)
      const ng = gain(ctx, 0.6)
      ng.gain.setValueAtTime(0.6, 0)
      ng.gain.exponentialRampToValueAtTime(0.001, 0.5)
      chain(ctx, n, filter(ctx, 'bandpass', 500, 0.8), ng)
      n.start(0)
      const verb = reverb(ctx, 2.8, 2.5)
      verb.connect(gain(ctx, 0.5)).connect(ctx.destination)
      ;[233, 330, 349].forEach((f) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'triangle'
        o.frequency.value = f
        g.gain.setValueAtTime(0.12, 0)
        g.gain.exponentialRampToValueAtTime(0.001, 2.8)
        o.connect(g)
        g.connect(ctx.destination)
        g.connect(verb)
        o.start(0)
      })
    }),
}

export type SynthId = keyof typeof synths

function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels
  const len = buf.length * ch * 2
  const view = new DataView(new ArrayBuffer(44 + len))
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); view.setUint32(4, 36 + len, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true)
  view.setUint32(24, SR, true); view.setUint32(28, SR * ch * 2, true); view.setUint16(32, ch * 2, true)
  view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, len, true)
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < buf.length; i++)
    for (let c = 0; c < ch; c++, o += 2) view.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true)
  return new Blob([view], { type: 'audio/wav' })
}

export async function synthUrl(id: string): Promise<string> {
  const make = synths[id]
  if (!make) throw new Error(`No synth for sound "${id}"`)
  return URL.createObjectURL(toWav(await make()))
}
