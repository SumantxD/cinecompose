import { rng } from '../utils/random.ts'
import type { SceneConfig, Shot } from '../cinematic/types'
import type { SceneSpecification, Vec2, WorldLandmark, WorldRoute } from './types.ts'
import { createTerrain, pathDistance } from './TerrainGenerator.ts'
import { validateWorld } from './types.ts'

export function hashText(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

export const TERRAIN_PRESETS = ['rolling', 'ridged', 'terraced', 'island'] as const

/** Sparse vegetation sightline preservation, shared by all generated shot templates. */
export function shotViewClearAt(shot: Shot, x: number, z: number, radius: number) {
  const segments: [Vec2, Vec2][] = [
    [[shot.from[0], shot.from[2]], [shot.lookAt[0], shot.lookAt[2]]],
    [[(shot.to ?? shot.from)[0], (shot.to ?? shot.from)[2]], [(shot.lookAtTo ?? shot.lookAt)[0], (shot.lookAtTo ?? shot.lookAt)[2]]],
  ]
  return segments.every(([a, b]) => {
    const line = pathDistance([a, b], x, z)
    return line.distance >= radius || line.progress >= 0.98
  })
}

/** These are replaceable authoring presets, not a list of scenarios understood by the compiler. */
export function planEnvironment(seed: number, preset: string, source: SceneSpecification['source']): SceneSpecification {
  const random = rng(seed)
  const profile = TERRAIN_PRESETS.includes(preset as typeof TERRAIN_PRESETS[number]) ? preset : 'rolling'
  const landmark = (id: string, assembly: string, position: Vec2, tags: string[], scale = 1): WorldLandmark => ({ id, assembly, position, tags, rotation: (random() - 0.5) * 0.5, scale })
  const settlement = source.description.includes('village') || source.description.includes('temple') || source.description.includes('well')
  const landmarks = settlement ? [
    landmark('main_destination', 'classic/stone-temple', [0, -38], ['destination', 'religious'], 1.05),
    landmark('well', 'classic/stone-well', [9, -29], ['water', 'village-prop'], 0.9),
    landmark('house_1', 'classic/mud-house', [-10, -10], ['shelter', 'village'], 0.9),
    landmark('house_2', 'classic/mud-house', [12, -20], ['shelter', 'village']),
    landmark('ruin', 'classic/broken-wall', [-11, -32], ['ruin', 'village'], 0.85),
  ] : [landmark('lookout', 'classic/wood-watchtower', [0, -35], ['destination'], 0.9)]
  const approach: WorldRoute = { id: 'approach', kind: 'path', surface: 'ground', points: [[0, 38], [(random() - 0.5) * 4, 18], [(random() - 0.5) * 4, -10], [landmarks[0].position[0], landmarks[0].position[1]]], width: settlement ? 3.4 : 2.4, clearance: 2 }
  const water: WorldRoute = { id: 'watercourse', kind: 'stream', surface: 'water', points: [[-18, 45], [-16, 14], [-20, -12], [-14, -46]], width: profile === 'island' ? 12 : 3.2, clearance: 3, level: profile === 'island' ? -1.2 : -0.65 }
  return {
    version: 1, seed, biome: source.description.split(/[,.;]/)[0].slice(0, 60) || preset, source,
    terrain: {
      profile, size: 180,
      relief: profile === 'terraced' ? 16 : profile === 'island' ? 8 : profile === 'ridged' ? 10 : 3.4,
      waterLevel: profile === 'island' ? -1.15 : -30,
      groundColor: profile === 'terraced' ? '#79644c' : profile === 'island' ? '#706443' : '#35432d',
      skyColor: profile === 'island' ? '#587886' : '#172631',
      fogColor: profile === 'island' ? '#6e8990' : '#283941',
      fogDensity: profile === 'terraced' ? 0.008 : 0.019,
      vegetation: { asset: settlement ? 'classic/banyan' : profile === 'terraced' ? 'classic/dead-tree' : 'classic/sal', density: profile === 'terraced' ? 0.04 : profile === 'island' ? 0.32 : settlement ? 0.46 : 0.72 },
    },
    landmarks,
    routes: profile === 'terraced' ? [approach] : [approach, water],
    lighting: { moon: profile === 'island' ? 1.5 : 0.65, ambient: profile === 'island' ? 1.0 : 0.8, exposure: profile === 'island' ? 1.2 : 1.5, azimuth: -0.6 },
    camera: { position: [0, 36], target: landmarks[0].id },
  }
}

export function worldScene(sceneId: string, spec: SceneSpecification): SceneConfig {
  const errors = validateWorld(spec)
  if (errors.length) throw new Error(errors.join('\n'))
  const terrain = createTerrain(spec)
  const focal = spec.landmarks.find((l) => l.id === spec.camera.target) ?? spec.landmarks[0]
  const target = focal?.position ?? [0, -30]
  const targetY = terrain.heightAt(...target) + (focal?.tags.includes('elevated') ? 3.5 : 2)
  const [x, z] = spec.camera.position
  const from: [number, number, number] = [x, terrain.heightAt(x, z) + 1.75, z]
  const to: [number, number, number] = [x, terrain.heightAt(x, z - 2) + 1.75, z - 2]
  const overviewFrom: [number, number, number] = [target[0] + 22, terrain.heightAt(target[0] + 22, target[1] + 32) + 18, target[1] + 32]
  const overviewTo: [number, number, number] = [target[0] + 18, terrain.heightAt(target[0] + 18, target[1] + 26) + 18, target[1] + 26]
  return {
    sceneId, environment: 'procedural-world', duration: 16,
    shots: [
      { id: 'path_arrival', type: 'slow_push', duration: 8, from, to, lookAt: [target[0], targetY, target[1]], fov: 50, fovPortrait: 72 },
      { id: 'world_overview', type: 'high_angle', duration: 8, from: overviewFrom, to: overviewTo, lookAt: [target[0], targetY, target[1]], fov: 54, fovPortrait: 72 },
    ],
    lighting: { ambientIntensity: spec.lighting.ambient, moon: spec.lighting.moon, exposure: spec.lighting.exposure, fogDensity: spec.terrain.fogDensity, fogColor: spec.terrain.fogColor, gi: 0.65 },
    audio: { ambience: [{ sound: 'night_drone', volume: 0.12 }], music: null },
    cues: [], props: { world: spec },
  }
}
