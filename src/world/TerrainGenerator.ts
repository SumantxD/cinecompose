import * as THREE from 'three'
import { fbm } from '../utils/random.ts'
import type { SceneSpecification, Vec2 } from './types.ts'

export type TerrainProfile = (x: number, z: number, context: { seed: number; relief: number; size: number }) => number
const profiles = new Map<string, TerrainProfile>()
export function registerTerrainProfile(id: string, height: TerrainProfile) { profiles.set(id, height) }

registerTerrainProfile('rolling', (x, z, c) => (fbm(x * 0.018 + c.seed, z * 0.018, 5) - 0.45) * c.relief * 1.8)
registerTerrainProfile('ridged', (x, z, c) => {
  const ridge = 1 - Math.abs(fbm(x * 0.028 + c.seed, z * 0.018, 4) * 2 - 1)
  return (fbm(x * 0.018 + c.seed, z * 0.018, 5) - 0.45) * c.relief + Math.pow(ridge, 2) * c.relief * 0.8
})
registerTerrainProfile('terraced', (x, z, c) => {
  const h = (fbm(x * 0.018 + c.seed, z * 0.018, 5) - 0.45) * c.relief * 2.4
  return Math.floor(h / 2.2) * 2.2 + THREE.MathUtils.smoothstep(h % 2.2, 0.1, 0.7) * 0.35
})
registerTerrainProfile('island', (x, z, c) => {
  const r = Math.hypot(x, z) / (c.size * 0.52)
  return (fbm(x * 0.018 + c.seed, z * 0.018, 5) - 0.45) * c.relief * 1.4 + 3.5 * (1 - r * r) - 3
})

export interface CompiledTerrain {
  heightAt: (x: number, z: number) => number
  clearAt: (x: number, z: number) => boolean
  geometry: THREE.BufferGeometry
}

const clamp = THREE.MathUtils.clamp

export function pathDistance(points: Vec2[], x: number, z: number) {
  let distance = Infinity, progress = 0
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i]
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (length * length), 0, 1)
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t))
    if (d < distance) { distance = d; progress = (i - 1 + t) / (points.length - 1) }
  }
  return { distance, progress }
}

/** Shared height representation: terrain, paths and every grounded asset query this function. */
export function createTerrain(spec: SceneSpecification): CompiledTerrain {
  const seed = spec.seed % 8192
  const profile = profiles.get(spec.terrain.profile)
  if (!profile) throw new Error(`Unregistered terrain profile "${spec.terrain.profile}". Register it before compiling.`)
  const base = (x: number, z: number) => {
    const wx = x + (fbm(x * 0.013 + seed, z * 0.013, 3) - 0.5) * 22
    const wz = z + (fbm(x * 0.013, z * 0.013 + seed, 3) - 0.5) * 22
    return profile(wx, wz, { seed, relief: spec.terrain.relief, size: spec.terrain.size })
  }

  const heightAt = (x: number, z: number) => {
    let h = base(x, z)
    for (const landmark of spec.landmarks) {
      const r = 5.5 * (landmark.scale ?? 1)
      const distance = Math.hypot(x - landmark.position[0], z - landmark.position[1])
      if (distance < r * 1.7) h = THREE.MathUtils.lerp(base(...landmark.position), h, THREE.MathUtils.smoothstep(distance, r, r * 1.7))
    }
    for (const route of spec.routes.filter((r) => r.surface === 'water')) {
      const { distance } = pathDistance(route.points, x, z)
      const channel = 1 - THREE.MathUtils.smoothstep(distance, route.width * 0.55, route.width * 1.8)
      h = THREE.MathUtils.lerp(h, Math.min(h, (route.level ?? -0.65) - 0.65), channel)
    }
    return h
  }

  const clearAt = (x: number, z: number) => {
    if (spec.routes.some((route) => pathDistance(route.points, x, z).distance < route.width / 2 + route.clearance)) return false
    if (spec.landmarks.some((l) => Math.hypot(x - l.position[0], z - l.position[1]) < 6 * (l.scale ?? 1))) return false
    return true
  }

  const segments = 112
  const geometry = new THREE.PlaneGeometry(spec.terrain.size, spec.terrain.size, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(position.count * 3)
  const low = new THREE.Color(spec.terrain.groundColor).lerp(new THREE.Color('#ffffff'), 0.78)
  const high = low.clone().multiplyScalar(1.45)
  const stone = new THREE.Color('#777269')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), y = heightAt(x, z)
    position.setY(i, y)
    const slope = Math.hypot(heightAt(x + 0.5, z) - heightAt(x - 0.5, z), heightAt(x, z + 0.5) - heightAt(x, z - 0.5))
    const c = low.clone().lerp(high, clamp((y + 2) / 16, 0, 1)).lerp(stone, clamp((slope - 1.1) / 3, 0, 0.7))
    c.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return { heightAt, clearAt, geometry }
}

/** Real terrain-following ribbons, not floating road/water planes. */
export function pathRibbon(points: Vec2[], width: number, heightAt: (x: number, z: number) => number, offset: number) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)]
    const dx = next[0] - prev[0], dz = next[1] - prev[1], length = Math.hypot(dx, dz) || 1
    const [x, z] = points[i], nx = -dz / length * width / 2, nz = dx / length * width / 2
    for (const side of [-1, 1]) {
      const px = x + side * nx, pz = z + side * nz
      positions.push(px, heightAt(px, pz) + offset, pz)
      uvs.push(side < 0 ? 0 : 1, i / (points.length - 1))
    }
    if (i > 0) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
