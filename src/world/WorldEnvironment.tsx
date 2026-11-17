import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { clock as sceneClock } from '../cinematic/clock'
import { rng } from '../utils/random'
import { ground } from '../utils/textures'
import { leafTexture, barkTexture } from '../components/vegetation'
import { RainSystem } from '../components/RainSystem'
import { NightSky } from '../components/NightSky'
import { FogSystem } from '../components/FogSystem'
import { shotViewClearAt } from './EnvironmentPlanner.ts'
import type { RainConfig } from '../cinematic/types'
import { assembly, type GeometryPart } from './AssetRegistry.ts'
import { createTerrain, pathRibbon } from './TerrainGenerator.ts'
import type { SceneSpecification } from './types.ts'
import type { SceneConfig } from '../cinematic/types'

interface Placement { x: number; y: number; z: number; rotation: number; scale: number }
const dummy = new THREE.Object3D()

function Instances({ parts, placements, time }: { parts: GeometryPart[]; placements: Placement[]; time: { value: number } }) {
  const materials = useMemo(() => parts.map((part) => {
    const material = new THREE.MeshStandardMaterial({
      color: part.role === 'leaf' ? new THREE.Color(part.color).lerp(new THREE.Color(1, 1, 1), 0.68) : part.color, map: part.role === 'leaf' ? leafTexture() : part.role === 'bark' ? barkTexture() : undefined,
      roughness: 0.88, alphaTest: part.role === 'leaf' ? 0.45 : 0, side: part.role === 'leaf' ? THREE.DoubleSide : THREE.FrontSide,
    })
    if (part.role === 'leaf') {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = time
        shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
          float phase = instanceMatrix[3].x * 0.4 + instanceMatrix[3].z * 0.3;
          transformed.x += sin(uWindTime * 0.9 + phase) * pow(uv.y, 2.0) * 0.16;
          transformed.z += cos(uWindTime * 0.65 + phase) * pow(uv.y, 2.0) * 0.06;`)
      }
      material.customProgramCacheKey = () => 'procedural-world-leaf-wind-v1'
    }
    return material
  }), [parts, time])
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  return <>
    {parts.map((part, index) => <instancedMesh key={index} args={[part.geometry, materials[index], placements.length]} frustumCulled={false}
      ref={(mesh) => {
        if (!mesh) return
        placements.forEach((p, i) => {
          dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.rotation, 0); dummy.scale.setScalar(p.scale); dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
        })
        mesh.instanceMatrix.needsUpdate = true
      }} />)}
  </>
}

function Observation({ spec }: { spec: SceneSpecification }) {
  const geometry = useMemo(() => {
    const observation = spec.image?.observation
    if (!observation) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(observation.points.flatMap((p) => p.position), 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(observation.points.flatMap((p) => new THREE.Color(p.color).toArray()), 3))
    return geometry
  }, [spec])
  if (!geometry) return null
  return <points geometry={geometry} name="observed-depth-samples"><pointsMaterial vertexColors size={0.18} sizeAttenuation transparent opacity={0.65} depthWrite={false} /></points>
}

export function WorldEnvironment({ spec, shots, lighting, rain }: { spec: SceneSpecification; shots: SceneConfig['shots']; lighting: SceneConfig['lighting']; rain?: RainConfig }) {
  const terrain = useMemo(() => createTerrain(spec), [spec])
  const texture = useMemo(() => ground(spec.seed % 128), [spec.seed])
  const time = useMemo(() => ({ value: 0 }), [])
  useFrame(() => { time.value = sceneClock.t }, -5)
  useEffect(() => () => { terrain.geometry.dispose(); texture.dispose() }, [terrain, texture])
  const trees = useMemo(() => {
    const result: Placement[] = [], random = rng(spec.seed + 917)
    const count = Math.floor(spec.terrain.vegetation.density * 260)
    for (let i = 0; i < count * 12 && result.length < count; i++) {
      const x = (random() - 0.5) * spec.terrain.size * 0.94, z = (random() - 0.5) * spec.terrain.size * 0.94
      if (!terrain.clearAt(x, z) || !shots.every((shot) => shotViewClearAt(shot, x, z, assembly(spec.terrain.vegetation.asset).footprint + 2))) continue
      const slope = Math.hypot(terrain.heightAt(x + 1, z) - terrain.heightAt(x - 1, z), terrain.heightAt(x, z + 1) - terrain.heightAt(x, z - 1)) / 2
      if (slope > 1.1 || result.some((p) => Math.hypot(p.x - x, p.z - z) < 2.2)) continue
      result.push({ x, y: terrain.heightAt(x, z), z, rotation: random() * Math.PI * 2, scale: 0.45 + random() * 0.45 })
    }
    return result
  }, [spec, terrain, shots])
  const understory = useMemo(() => {
    const random = rng(spec.seed + 761), positions = Array.from({ length: 15 }, (_, i) => ({ x: (random() - 0.5) * 14, z: (i - 7) * 5 + 8 }))
    return positions.filter((p) => terrain.clearAt(p.x, p.z)).map((p) => ({
      ...p, y: terrain.heightAt(p.x, p.z), rotation: random() * Math.PI * 2, scale: 3.5 + random() * 5,
    }))
  }, [spec.seed, terrain])
  const landmarks = useMemo(() => [...spec.landmarks, ...understory.map((p, i) => ({ id: `grass_${i}`, assembly: 'classic/grass', tags: [], position: [p.x, p.z] as [number, number], scale: p.scale, rotation: p.rotation }))], [spec.landmarks, understory])
  const paths = useMemo(() => spec.routes.map((route) => ({
    route,
    geometry: pathRibbon(route.points, route.width, (x, z) => route.surface === 'water' ? (route.level ?? -0.65) : terrain.heightAt(x, z), 0.035),
  })), [spec.routes, terrain])
  useEffect(() => () => paths.forEach((p) => p.geometry.dispose()), [paths])

  return <group name="procedural-world">
    <NightSky intensity={lighting.gi ?? 0.65} color={spec.terrain.skyColor} />
    <FogSystem color={lighting.fogColor ?? spec.terrain.fogColor} density={lighting.fogDensity} />
    <mesh geometry={terrain.geometry} receiveShadow>
      <meshStandardMaterial map={texture} vertexColors roughness={0.98} />
    </mesh>
    {paths.map(({ route, geometry }) => <mesh key={route.id} geometry={geometry}>
      <meshStandardMaterial color={route.material ?? (route.surface === 'water' ? '#324e52' : '#514a3c')} roughness={route.surface === 'water' ? 0.17 : 1} metalness={route.surface === 'water' ? 0.16 : 0} transparent={route.surface === 'water'} opacity={route.surface === 'water' ? 0.86 : 1} side={THREE.DoubleSide} />
    </mesh>)}
    <Instances parts={useMemo(() => assembly(spec.terrain.vegetation.asset).build(spec.seed), [spec])} placements={trees} time={time} />
    {useMemo(() => {
      const groups = new Map<string, Placement[]>()
      for (const landmark of landmarks) {
        const group = groups.get(landmark.assembly) ?? []
        group.push({ x: landmark.position[0], y: terrain.heightAt(landmark.position[0], landmark.position[1]), z: landmark.position[1], rotation: landmark.rotation ?? 0, scale: landmark.scale ?? 1 })
        groups.set(landmark.assembly, group)
      }
      return [...groups]
    }, [landmarks, terrain]).map(([id, placements]) => <Instances key={id} parts={assembly(id).build(spec.seed + 47, spec.landmarks.find((l) => l.assembly === id)?.parameters)} placements={placements} time={time} />)}
    <Observation spec={spec} />
    <hemisphereLight args={[spec.terrain.skyColor, spec.terrain.groundColor, lighting.ambientIntensity * 1.7]} />
    <directionalLight color="#bfced0" intensity={(lighting.moon ?? spec.lighting.moon) * 2.4} position={[Math.cos(spec.lighting.azimuth) * 30, 45, Math.sin(spec.lighting.azimuth) * 30]} />
    <RainSystem count={rain?.enabled === false ? 0 : Math.min(rain?.count || 7500, 9000)} box={[spec.terrain.size * 0.55, 26, spec.terrain.size * 0.55]} wind={rain?.wind ?? [0.6, 0.2]} ground="0.0" />
  </group>
}
