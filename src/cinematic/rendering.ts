import * as THREE from 'three'
import { createContext, useContext } from 'react'
import type { RenderSettings, RenderSettingsPatch, QualityProfile, HdriId } from './types.ts'

/** Mounted once by Stage. Scene geometry may use it for explicit profile LOD/budget choices. */
export const RenderSettingsContext = createContext<RenderSettings | undefined>(undefined)
export const useRenderSettings = () => useContext(RenderSettingsContext)

/** Local CC0 environment-lighting assets. public/environments/manifest.json holds provenance and hashes. */
export const HDRI_LIBRARY: Record<HdriId, { label: string; file: string; source: string }> = {
  moonless_golf: {
    label: 'Moonless Golf — night field (Poly Haven, CC0)',
    file: '/environments/moonless_golf_1k.hdr',
    source: 'https://polyhaven.com/a/moonless_golf',
  },
  kloppenheim_02_puresky: {
    label: 'Kloppenheim dusk sky (Poly Haven, CC0)',
    file: '/environments/kloppenheim_02_puresky_1k.hdr',
    source: 'https://polyhaven.com/a/kloppenheim_02_puresky',
  },
}

/** Legacy image. This is the exact prior PostFX/Stage setup and must stay stable for existing scenes. */
const BASELINE: RenderSettings = {
  profile: 'high',
  renderScale: 2,
  antialias: 'none',
  msaaSamples: 0,
  shadows: true,
  shadowType: 'pcf',
  shadowMapSize: 1024,
  textureAnisotropy: 4,
  toneMapping: 'aces',
  ao: { enabled: false, radius: 1.1, intensity: 2.2, quality: 'medium', halfRes: true },
  dof: { enabled: false, focusDistance: 0.035, focalLength: 0.025, fStop: 2.8, bokeh: 1.2 },
  bloom: { enabled: true, intensity: 0.55, threshold: 0.85 },
  grade: { saturation: -0.22, contrast: 0.08 },
  vignette: { enabled: true, darkness: 0.78 },
  grain: { enabled: true, opacity: 0.32 },
  chromatic: { enabled: false, offset: 0.001 },
  godRays: { enabled: false, position: [0, 12, -28], intensity: 1, density: 0.92, decay: 0.92 },
}

const profile = (settings: Partial<RenderSettings>): RenderSettings => resolveRenderSettings(settings)

/** Authoring presets. They change GPU cost and output resolution, not asset fidelity. */
export const RENDER_PROFILES: Record<QualityProfile, RenderSettings> = {
  ultra: profile({
    profile: 'ultra', renderScale: 2, antialias: 'smaa', shadowType: 'pcf-soft', shadowMapSize: 2048, textureAnisotropy: 8,
    ao: { enabled: true, radius: 1.25, intensity: 2.4, quality: 'ultra', halfRes: false },
  }),
  high: profile({
    profile: 'high', renderScale: 1.5, antialias: 'smaa', shadowType: 'pcf-soft', shadowMapSize: 1024, textureAnisotropy: 4,
    ao: { enabled: true, radius: 1.1, intensity: 2.2, quality: 'medium', halfRes: true },
  }),
  performance: profile({
    profile: 'performance', renderScale: 1, antialias: 'smaa', shadowType: 'pcf', shadowMapSize: 512, textureAnisotropy: 2,
    ao: { enabled: true, radius: 1, intensity: 1.8, quality: 'performance', halfRes: true },
    grain: { enabled: false, opacity: 0.32 },
    bloom: { enabled: true, intensity: 0.4, threshold: 0.85 },
  }),
}

/** Complete an authoring patch against the baseline. Explicit scene JSON stays readable and partial. */
export function resolveRenderSettings(patch?: RenderSettingsPatch): RenderSettings {
  if (!patch) return { ...BASELINE, ao: { ...BASELINE.ao }, dof: { ...BASELINE.dof }, bloom: { ...BASELINE.bloom }, grade: { ...BASELINE.grade }, vignette: { ...BASELINE.vignette }, grain: { ...BASELINE.grain }, chromatic: { ...BASELINE.chromatic }, godRays: { ...BASELINE.godRays, position: [...BASELINE.godRays.position] as [number, number, number] } }
  return {
    ...BASELINE,
    ...patch,
    ao: { ...BASELINE.ao, ...patch.ao },
    dof: { ...BASELINE.dof, ...patch.dof },
    bloom: { ...BASELINE.bloom, ...patch.bloom },
    grade: { ...BASELINE.grade, ...patch.grade },
    vignette: { ...BASELINE.vignette, ...patch.vignette },
    grain: { ...BASELINE.grain, ...patch.grain },
    chromatic: { ...BASELINE.chromatic, ...patch.chromatic },
    godRays: { ...BASELINE.godRays, ...patch.godRays, position: [...(patch.godRays?.position ?? BASELINE.godRays.position)] as [number, number, number] },
    ...(patch.environment ? { environment: { ...patch.environment } } : {}),
  }
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const bounded = (v: unknown, lo: number, hi: number) => finite(v) && v >= lo && v <= hi

/** Structural and value checks for a rendering patch. Same validator runs on Studio writes and check-episode. */
export function validateRenderSettings(value: unknown): string[] {
  if (value === undefined) return []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['rendering must be an object.']
  const patch = value as Record<string, unknown>
  const errors: string[] = []
  const err = (message: string) => errors.push(`rendering: ${message}`)
  if (patch.profile !== undefined && !['ultra', 'high', 'performance'].includes(String(patch.profile))) err('profile must be ultra, high or performance.')
  if (patch.renderScale !== undefined && !bounded(patch.renderScale, 0.5, 2)) err('renderScale must be within 0.5–2.')
  if (patch.antialias !== undefined && !['none', 'msaa', 'smaa'].includes(String(patch.antialias))) err('antialias must be none, msaa or smaa.')
  if (patch.msaaSamples !== undefined && (!Number.isInteger(patch.msaaSamples) || !bounded(patch.msaaSamples, 0, 8))) err('msaaSamples must be an integer within 0–8.')
  if (patch.shadows !== undefined && typeof patch.shadows !== 'boolean') err('shadows must be boolean.')
  if (patch.shadowType !== undefined && !['basic', 'pcf', 'pcf-soft'].includes(String(patch.shadowType))) err('shadowType must be basic, pcf or pcf-soft.')
  if (patch.shadowMapSize !== undefined && (![256, 512, 1024, 2048, 4096].includes(Number(patch.shadowMapSize)))) err('shadowMapSize must be 256, 512, 1024, 2048 or 4096.')
  if (patch.textureAnisotropy !== undefined && (![1, 2, 4, 8, 16].includes(Number(patch.textureAnisotropy)))) err('textureAnisotropy must be 1, 2, 4, 8 or 16.')
  if (patch.toneMapping !== undefined && !['aces', 'neutral', 'none'].includes(String(patch.toneMapping))) err('toneMapping must be aces, neutral or none.')
  const section = (name: string, keys: Record<string, [number, number]>) => {
    const v = patch[name]
    if (v === undefined) return
    if (!v || typeof v !== 'object' || Array.isArray(v)) return void err(`${name} must be an object.`)
    for (const [key, [lo, hi]] of Object.entries(keys)) if ((v as Record<string, unknown>)[key] !== undefined && !bounded((v as Record<string, unknown>)[key], lo, hi)) err(`${name}.${key} must be within ${lo}–${hi}.`)
    const enabled = (v as Record<string, unknown>).enabled
    if (enabled !== undefined && typeof enabled !== 'boolean') err(`${name}.enabled must be boolean.`)
  }
  section('ao', { radius: [0.05, 12], intensity: [0.25, 8] })
  if (patch.ao && typeof patch.ao === 'object' && (patch.ao as Record<string, unknown>).quality !== undefined && !['performance', 'low', 'medium', 'high', 'ultra'].includes(String((patch.ao as Record<string, unknown>).quality))) err('ao.quality is not a supported N8AO quality mode.')
  section('dof', { focusDistance: [0, 1], focalLength: [0.001, 0.2], fStop: [0.08, 32], bokeh: [0, 6] })
  section('bloom', { intensity: [0, 6], threshold: [0, 1] })
  section('grade', { saturation: [-1, 1], contrast: [-1, 1] })
  section('vignette', { darkness: [0, 2] })
  section('grain', { opacity: [0, 1] })
  section('chromatic', { offset: [0, 0.01] })
  section('godRays', { intensity: [0, 4], density: [0, 1], decay: [0, 1] })
  if (patch.godRays && typeof patch.godRays === 'object' && (patch.godRays as Record<string, unknown>).position !== undefined) {
    const p = (patch.godRays as Record<string, unknown>).position
    if (!Array.isArray(p) || p.length !== 3 || !p.every(finite)) err('godRays.position must be [x, y, z].')
  }
  if (patch.environment !== undefined) {
    const env = patch.environment as Record<string, unknown>
    if (!env || typeof env !== 'object' || Array.isArray(env)) err('environment must be an object.')
    else {
      if (!(String(env.hdri) in HDRI_LIBRARY)) err('environment.hdri must name a registered local HDRI asset.')
      if (!bounded(env.intensity, 0, 4)) err('environment.intensity must be within 0–4.')
      if (!bounded(env.rotation, -360, 360)) err('environment.rotation must be within -360–360 degrees.')
      if (env.background !== undefined && typeof env.background !== 'boolean') err('environment.background must be boolean.')
      for (const key of ['backgroundIntensity', 'backgroundBlurriness']) if (env[key] !== undefined && !bounded(env[key], 0, 4)) err(`environment.${key} must be within 0–4.`)
      if (env.backgroundRotation !== undefined && !bounded(env.backgroundRotation, -360, 360)) err('environment.backgroundRotation must be within -360–360 degrees.')
    }
  }
  return errors
}

/** Cap shadow maps at the profile's budget and release the old map so quality changes do not accumulate GPU memory. */
export function applyShadowBudget(root: THREE.Object3D, settings: RenderSettings) {
  const size = settings.shadows ? settings.shadowMapSize : 0
  root.traverse((object) => {
    const light = object as THREE.Object3D & { isLight?: boolean; shadow?: THREE.LightShadow }
    if (!light.isLight || !light.shadow) return
    if (!size) {
      if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null }
      return
    }
    if (light.shadow.mapSize.width === size && light.shadow.mapSize.height === size && light.shadow.map?.width === size && light.shadow.map?.height === size) return
    light.shadow.mapSize.set(size, size)
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null }
    light.shadow.needsUpdate = true
  })
}

/** Anisotropic, mipmapped sampling for every material texture. Never lowers asset resolution or uses a point filter. */
export function applyTextureQuality(root: THREE.Object3D, settings: RenderSettings, maxAnisotropy = 16) {
  const anisotropy = Math.max(1, Math.min(settings.textureAnisotropy, maxAnisotropy))
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        const texture = value as THREE.Texture
        if (!texture?.isTexture) continue
        texture.generateMipmaps = true
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        textures.add(texture)
      }
    }
  })
  for (const texture of textures) if (texture.anisotropy !== anisotropy) { texture.anisotropy = anisotropy; texture.needsUpdate = true }
}
