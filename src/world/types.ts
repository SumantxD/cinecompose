import type { Vec3 } from '../cinematic/types.ts'

export type Vec2 = [number, number]
export interface WorldLandmark {
  id: string
  /** Open asset/assembly id, e.g. 'classic/stone-temple' or a future local GLB reference. */
  assembly: string
  /** Free semantic tags for planning/story queries; never compiler switch cases. */
  tags: string[]
  position: Vec2
  rotation?: number
  scale?: number
  /** Assembly-specific authored parameters, forwarded to the registered builder. */
  parameters?: Record<string, number | string | boolean>
}
export interface WorldRoute {
  id: string
  /** Free authoring label, e.g. road, lane, pilgrimage-path, stream. */
  kind: string
  surface: 'ground' | 'water'
  points: Vec2[]
  width: number
  clearance: number
  level?: number
  material?: string
}

export interface ImageObservation {
  /** Relative inverse camera projection; units and unseen geometry are not measurements. */
  points: { position: Vec3; color: string }[]
  model: 'Depth-Anything-V2-Small'
  note: string
}

export interface SceneSpecification {
  version: 1
  /** Free place/biome label. Terrain behaviour comes from terrain.profile and continuous parameters. */
  biome: string
  seed: number
  source: {
    kind: 'random' | 'story' | 'image'
    description: string
    reconstructed: boolean
    notes: string[]
  }
  terrain: {
    /** Registered noise/erosion profile; extensible independently of the scene schema. */
    profile: string
    size: number
    relief: number
    waterLevel: number
    groundColor: string
    skyColor: string
    fogColor: string
    fogDensity: number
    vegetation: { asset: string; density: number }
  }
  landmarks: WorldLandmark[]
  relationships?: { from: string; to: string; relation: string }[]
  routes: WorldRoute[]
  lighting: { moon: number; ambient: number; exposure: number; azimuth: number }
  camera: { position: Vec2; target: string | null }
  image?: { width: number; height: number; palette: string[]; vegetationFraction: number; horizon: number; observation?: ImageObservation }
}

const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const vec = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(finite)
const colour = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

/** Trust boundary for pasted specs, generated files and editor input. */
export function validateWorld(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['World specification must be an object.']
  const w = value as Partial<SceneSpecification>, errors: string[] = []
  if (w.version !== 1) errors.push('World version must be 1.')
  if (!Number.isInteger(w.seed) || (w.seed ?? -1) < 0) errors.push('Seed must be a non-negative integer.')
  if (typeof w.biome !== 'string' || !w.biome) errors.push('World needs a biome/place label.')
  if (!w.terrain || typeof w.terrain.profile !== 'string' || !w.terrain.profile) errors.push('World needs a terrain profile id.')
  if (!w.source || !['random', 'story', 'image'].includes(w.source.kind)) errors.push('Source must be random, story or image.')
  const t = w.terrain
  if (!t || !finite(t.size) || (t.size ?? 0) < 80 || (t.size ?? 0) > 400) errors.push('Terrain size must be 80–400 metres.')
  if (!t || !finite(t.relief) || (t.relief ?? -1) < 0 || (t.relief ?? 0) > 60) errors.push('Terrain relief must be 0–60 metres.')
  if (!t || !t.vegetation || !finite(t.vegetation.density) || t.vegetation.density < 0 || t.vegetation.density > 1 || typeof t.vegetation.asset !== 'string' || !t.vegetation.asset) errors.push('Vegetation needs an asset id and density 0–1.')
  if (t && [t.groundColor, t.skyColor, t.fogColor].some((v) => !colour(v))) errors.push('World colours must be six-digit hex values.')
  if (!Array.isArray(w.landmarks) || w.landmarks.length > 80) errors.push('World needs a landmark array with at most 80 entries.')
  else {
    const ids = new Set<string>()
    for (const landmark of w.landmarks) {
      if (!landmark || typeof landmark.assembly !== 'string' || !landmark.assembly) errors.push('Landmarks need an assembly id.')
      if (!landmark || typeof landmark.id !== 'string' || !landmark.id || ids.has(landmark.id)) errors.push('Landmark ids must be unique strings.')
      else ids.add(landmark.id)
      if (!landmark || !vec(landmark.position)) errors.push('Landmarks need finite [x, z] positions.')
      else if (Math.abs(landmark.position[0]) > (t?.size ?? 400) / 2 || Math.abs(landmark.position[1]) > (t?.size ?? 400) / 2) errors.push('Landmark is outside the world bounds.')
      if (landmark?.scale !== undefined && (!finite(landmark.scale) || landmark.scale < 0.25 || landmark.scale > 4)) errors.push('Landmark scale must be 0.25–4.')
    }
  }
  if (w.relationships !== undefined) {
    if (!Array.isArray(w.relationships) || w.relationships.length > 80) errors.push('Relationships need at most 80 entries.')
    else for (const link of w.relationships) if (!link || typeof link.from !== 'string' || typeof link.to !== 'string' || typeof link.relation !== 'string') errors.push('Relationships need from, to and relation strings.')
  }
  if (!Array.isArray(w.routes) || w.routes.length > 30) errors.push('World needs a routes array with at most 30 entries.')
  else for (const path of w.routes) if (!path || !Array.isArray(path.points) || path.points.length < 2 || path.points.length > 100 || path.points.some((p) => !vec(p)) || !finite(path.width) || path.width <= 0 || path.width > 24 || !finite(path.clearance) || path.clearance < 0 || !['ground', 'water'].includes(path.surface)) errors.push('Routes need 2–100 [x, z] points, a surface, width 0–24m and non-negative clearance.')
  if (!w.lighting || ![w.lighting.moon, w.lighting.ambient, w.lighting.exposure, w.lighting.azimuth].every(finite)) errors.push('Lighting needs numeric moon, ambient, exposure and azimuth.')
  if (!w.camera || !vec(w.camera.position)) errors.push('Camera needs a finite [x, z] position.')
  if (w.image) {
    if (!Number.isInteger(w.image.width) || !Number.isInteger(w.image.height) || w.image.width <= 0 || w.image.height <= 0) errors.push('Image dimensions are invalid.')
    if (!Array.isArray(w.image.palette) || w.image.palette.some((v) => !colour(v))) errors.push('Image palette is invalid.')
    if (w.image.observation && (w.image.observation.points.length > 4096 || w.image.observation.points.some((p) => !Array.isArray(p.position) || p.position.length !== 3 || !p.position.every(finite) || !colour(p.color)))) errors.push('Image observation must contain at most 4096 coloured 3D points.')
  }
  return errors
}
