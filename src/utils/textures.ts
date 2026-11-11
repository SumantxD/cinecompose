import * as THREE from 'three'
import { fbm, rng } from './random'

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function tex(c: HTMLCanvasElement, srgb = true, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
  }
  return t
}

/** Worn wet asphalt: colour + roughness maps sharing one layout so puddles read as mirrors. */
export function asphalt(seed = 7) {
  const W = 512, H = 2048
  const [cc, c] = canvas(W, H)
  const [rc, r] = canvas(W, H)
  const img = c.createImageData(W, H)
  const rimg = r.createImageData(W, H)
  const rand = rng(seed)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const n = fbm(x / 40, y / 40)
      const grain = rand() * 0.18
      const edge = Math.min(x, W - 1 - x) / W
      // Puddles collect in the dips and along the broken edges; soft rims, not hard cut-outs.
      const pud = Math.max(
        smooth(0.6, 0.66, fbm(x / 45 + 9, y / 70 + 3, 5)),
        edge < 0.07 ? smooth(0.5, 0.58, fbm(x / 8, y / 30)) : 0,
      )
      // Albedo in sRGB 60–120 ≈ linear 0.05–0.19: worn asphalt. Puddles darker but mirror-smooth.
      const v = (62 + n * 38 + grain * 30) * (1 - pud) + 34 * pud
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 2; img.data[i + 3] = 255
      const rough = (150 + n * 80 + grain * 40) * (1 - pud) + 14 * pud
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rough; rimg.data[i + 3] = 255
    }
  c.putImageData(img, 0, 0)
  r.putImageData(rimg, 0, 0)
  // Faded centre line, mostly gone.
  c.globalAlpha = 0.22
  c.fillStyle = '#c9c2a8'
  for (let y = 0; y < H; y += 192) if (rand() > 0.35) c.fillRect(W / 2 - 6, y, 12, 96)
  return { map: tex(cc, true, [1, 5]), roughnessMap: tex(rc, false, [1, 5]) }
}

/** Mud, grass and leaf litter for the ground plane. */
export function ground(seed = 3) {
  const S = 512
  const [cc, c] = canvas(S, S)
  const img = c.createImageData(S, S)
  const rand = rng(seed)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      const n = fbm(x / 30, y / 30)
      const g = rand() * 0.25
      img.data[i] = 48 + n * 34 + g * 16
      img.data[i + 1] = 52 + n * 40 + g * 18
      img.data[i + 2] = 36 + n * 22
      img.data[i + 3] = 255
    }
  c.putImageData(img, 0, 0)
  return tex(cc, true, [40, 40])
}

/** Alternating bands, e.g. the red/white barrier boom. */
export function stripes(a: string, b: string, count: number) {
  const [cc, c] = canvas(256, 8)
  for (let i = 0; i < count; i++) {
    c.fillStyle = i % 2 ? b : a
    c.fillRect((i * 256) / count, 0, 256 / count + 1, 8)
  }
  // Rust and grime.
  c.globalAlpha = 0.35
  const rand = rng(count)
  for (let i = 0; i < 120; i++) {
    c.fillStyle = rand() > 0.5 ? '#3b2416' : '#151210'
    c.fillRect(rand() * 256, rand() * 8, rand() * 10, rand() * 3)
  }
  return tex(cc)
}

/** A painted signboard. Waits for webfonts so Devanagari renders. */
export async function signboard(lines: { text: string; font: string; y: number }[], bg: string, fg: string, w = 512, h = 256) {
  await document.fonts.ready
  const [cc, c] = canvas(w, h)
  c.fillStyle = bg
  c.fillRect(0, 0, w, h)
  c.strokeStyle = fg
  c.lineWidth = 10
  c.strokeRect(14, 14, w - 28, h - 28)
  c.fillStyle = fg
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  for (const l of lines) {
    c.font = l.font
    c.fillText(l.text, w / 2, l.y * h)
  }
  // Weathering: rain streaks and flaking.
  const rand = rng(w + h)
  c.globalAlpha = 0.25
  for (let i = 0; i < 160; i++) {
    c.fillStyle = rand() > 0.6 ? '#2b2116' : '#6d6553'
    const x = rand() * w
    c.fillRect(x, rand() * h * 0.3, 1 + rand() * 3, rand() * h)
  }
  return tex(cc)
}

/** Faded cotton sari: mud and wet darkening toward the hem, a faded border stripe. Height runs along v. */
export function sari() {
  const W = 256, H = 512
  const [cc, c] = canvas(W, H)
  const img = c.createImageData(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const v = 1 - y / H
      const n = fbm(x / 25, y / 25)
      const wet = Math.max(0, 1 - v * 3.2) * 0.7 + (fbm(x / 18 + 4, y / 40) > 0.62 ? 0.25 : 0)
      let r = 150 + n * 30, g = 142 + n * 28, b = 124 + n * 22
      if (v > 0.035 && v < 0.075) { r = 96; g = 54; b = 50 }
      const k = 1 - wet
      img.data[i] = r * k; img.data[i + 1] = g * k; img.data[i + 2] = b * k; img.data[i + 3] = 255
    }
  c.putImageData(img, 0, 0)
  return tex(cc)
}

/** Soft radial falloff for glows and halos. */
export function radial() {
  const [cc, c] = canvas(128, 128)
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 128, 128)
  return tex(cc)
}
