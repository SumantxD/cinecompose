import { hashText, planEnvironment } from './EnvironmentPlanner.ts'
import { validateWorld, type SceneSpecification } from './types.ts'

export interface PixelImage { width: number; height: number; data: Uint8ClampedArray }
export interface DepthAnalysis {
  model: 'Depth-Anything-V2-Small'
  depth: PixelImage
  /** Nominal model-space extent, not world metres. */
  near?: number
  far?: number
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** Actual local pixels: palette, greenery and horizon are measured from the supplied image. */
export function analyseImage(image: PixelImage) {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>()
  let green = 0, luminance = 0
  const rows = new Array(image.height).fill(0)
  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const i = (y * image.width + x) * 4, r = image.data[i], g = image.data[i + 1], b = image.data[i + 2]
      const key = (r >> 5) << 10 | (g >> 5) << 5 | (b >> 5)
      const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
      bin.count++; bin.r += r; bin.g += g; bin.b += b; bins.set(key, bin)
      rows[y] += (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
      if (g > r * 0.8 && g > b * 1.15 && g > 32) green++
      luminance += r * 0.2126 + g * 0.7152 + b * 0.0722
    }
  }
  const palette = [...bins.values()].sort((a, b) => b.count - a.count).slice(0, 6)
    .map((bin) => hex(bin.r / bin.count, bin.g / bin.count, bin.b / bin.count))
  let horizon = 0, greatestChange = -Infinity
  const sample = Math.max(1, Math.floor(image.height / 40))
  for (let y = sample; y < image.height - sample; y += sample) {
    const change = rows[y] / Math.max(1, image.width / 4) - rows[y - sample] / Math.max(1, image.width / 4)
    if (change > greatestChange) { greatestChange = change; horizon = y / image.height }
  }
  return {
    width: image.width, height: image.height,
    palette, horizon: Math.min(1, Math.max(0, horizon)),
    vegetationFraction: green / Math.max(1, Math.floor(image.width / 4) * Math.floor(image.height / 4)),
    averageLuminance: luminance / Math.max(1, Math.floor(image.width / 4) * Math.floor(image.height / 4) * 255),
  }
}

function depthSamples(depth: PixelImage, image: PixelImage, near = 4, far = 52) {
  const points: { position: [number, number, number]; color: string }[] = []
  for (let row = 0; row < 8; row++) for (let col = 0; col < 12; col++) {
    const x = Math.floor((col + 0.5) / 12 * image.width), y = Math.floor((row + 0.5) / 8 * image.height)
    const d = depth.data[Math.min(depth.data.length - 4, (Math.floor(y / image.height * depth.height) * depth.width + Math.floor(x / image.width * depth.width)) * 4)] / 255
    const distance = far - (far - near) * d
    const camera = [0, 1.8, 34] as const
    points.push({
      position: [camera[0] + (x / image.width - 0.5) * distance * 1.25, camera[1] + (0.5 - y / image.height) * distance * 0.85, camera[2] - distance],
      color: hex(image.data[(y * image.width + x) * 4], image.data[(y * image.width + x) * 4 + 1], image.data[(y * image.width + x) * 4 + 2]),
    })
  }
  return points
}

/**
 * Partial image reconstruction: pixel analysis is measured, layout around the observed sight lines is inferred.
 * Unseen surfaces and the reverse side of the world are never claimed as measured geometry.
 */
export function imageToScene(image: PixelImage, depth?: DepthAnalysis, seed = hashText(`${image.width}:${image.height}:${image.data[0] ?? 0}`)): SceneSpecification {
  const analysis = analyseImage(image)
  const source: SceneSpecification['source'] = {
    kind: 'image', description: `Image reference ${image.width}x${image.height}`,
    reconstructed: Boolean(depth),
    notes: [
      'Palette, vegetation and horizon were sampled from the supplied image pixels.',
      depth ? 'Depth samples are a relative model-space 2.5D observation; the surrounding terrain is inferred and is not a complete reconstruction.' : 'No depth analysis was supplied. Terrain layout is inferred from composition; the image does not measure unseen surfaces.',
    ],
  }
  const spec = planEnvironment(seed, analysis.vegetationFraction > 0.24 ? 'rolling' : 'terraced', source)
  spec.terrain.relief = 2 + (1 - analysis.horizon) * 10
  spec.terrain.vegetation.density = Math.min(0.9, Math.max(0.08, analysis.vegetationFraction))
  spec.landmarks = []
  spec.camera.target = null
  const ground = analysis.palette[Math.min(3, analysis.palette.length - 1)] ?? '#35432d'
  const sky = analysis.palette[0] ?? '#172631'
  spec.terrain.groundColor = ground
  spec.terrain.skyColor = sky
  spec.terrain.fogColor = sky
  spec.lighting = {
    moon: analysis.averageLuminance > 0.5 ? 2.6 : 0.6,
    ambient: analysis.averageLuminance > 0.5 ? 1.3 : 0.72,
    exposure: analysis.averageLuminance > 0.5 ? 1.1 : 1.5,
    azimuth: -0.6,
  }
  spec.image = {
    width: image.width, height: image.height, palette: analysis.palette,
    vegetationFraction: analysis.vegetationFraction, horizon: analysis.horizon,
    observation: depth ? { points: depthSamples(depth.depth, image, depth.near, depth.far), model: depth.model, note: 'Relative depth projection, not metric measurement.' } : undefined,
  }
  const errors = validateWorld(spec)
  if (errors.length) throw new Error(errors.join('\n'))
  return spec
}
