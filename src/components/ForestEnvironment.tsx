import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import { useRenderSettings } from '../cinematic/rendering'
import { fbm, rng } from '../utils/random'
import { ground } from '../utils/textures'
import { salTree, bush, grassClump, leafTexture, grassTexture, barkTexture, withWind } from './vegetation'
import type { Terrain } from './VillageRoad'

interface Props {
  /** Return false where nothing may grow (roads, tracks, buildings). */
  clear: (x: number, z: number) => boolean
  terrain?: Terrain
  trees?: number
  bushes?: number
  grass?: number
  seed?: number
}

const TREE_TYPES = 6
const BUSH_TYPES = 4

type Placement = { m: THREE.Matrix4; c: THREE.Color }

function fill(im: THREE.InstancedMesh | null, list: Placement[]) {
  if (!im) return
  list.forEach((p, i) => {
    im.setMatrixAt(i, p.m)
    im.setColorAt(i, p.c)
  })
  im.count = list.length
  im.instanceMatrix.needsUpdate = true
  if (im.instanceColor) im.instanceColor.needsUpdate = true
  im.computeBoundingSphere()
}

/** Monsoon sal forest: seeded tree/bush archetypes, instanced, wind-driven, on an uneven mud floor. */
export function ForestEnvironment({ clear, terrain = () => 0, trees = 420, bushes = 500, grass = 2600, seed = 5 }: Props) {
  const groundTex = useMemo(ground, [])
  const render = useRenderSettings()
  const camera = useThree((s) => s.camera)
  const treeMeshes = useRef<(THREE.InstancedMesh | null)[]>([])
  const bushMeshes = useRef<(THREE.InstancedMesh | null)[]>([])
  const bladeMesh = useRef<THREE.InstancedMesh | null>(null)
  const cullState = useRef({ tick: -1, position: camera.position.clone() })

  const height = useMemo(
    () => (x: number, z: number) => {
      const away = THREE.MathUtils.smoothstep(Math.abs(x), 3.5, 10)
      return terrain(x, z) - 0.03 + ((fbm(x * 0.05, z * 0.05) - 0.5) * 2.2 + (fbm(x * 0.4, z * 0.4) - 0.5) * 0.25) * away
    },
    [terrain],
  )

  const groundGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(320, 320, 160, 160)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)))
    g.computeVertexNormals()
    return g
  }, [height])

  const kit = useMemo(() => {
    const leaf = leafTexture(seed)
    // Bark and leaves share sway settings so foliage stays attached to its branches.
    const treeWind = { sway: 0.22, base: 3, top: 20 }
    return {
      trees: Array.from({ length: TREE_TYPES }, (_, i) => salTree(seed * 100 + i)),
      bushes: Array.from({ length: BUSH_TYPES }, (_, i) => bush(seed * 200 + i)),
      grass: grassClump(),
      bark: withWind(new THREE.MeshStandardMaterial({ map: barkTexture(seed), roughness: 0.95 }), { ...treeWind, flutter: 0 }),
      leaves: withWind(new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: '#353d31' }), { ...treeWind, flutter: 0.035 }),
      bushLeaves: withWind(new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: '#a7b08f' }), { sway: 0.05, flutter: 0.02, base: 0, top: 1.5 }),
      blades: withWind(new THREE.MeshStandardMaterial({ map: grassTexture(seed), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.75 }), { sway: 0.07, flutter: 0.01, base: 0, top: 0.6 }),
    }
  }, [seed])

  const placed = useMemo(() => {
    const rand = rng(seed)
    const o = new THREE.Object3D()
    const tint = (lo: number, hi: number) => {
      const v = lo + rand() * (hi - lo)
      return new THREE.Color(v * (0.95 + rand() * 0.1), v, v * (0.9 + rand() * 0.1))
    }
    const place = (x: number, y: number, z: number, s: number, lean: number) => {
      o.position.set(x, y, z)
      o.rotation.set(lean * (rand() - 0.5), rand() * Math.PI * 2, lean * (rand() - 0.5))
      o.scale.setScalar(s)
      o.updateMatrix()
      return o.matrix.clone()
    }
    const treeList = Array.from({ length: TREE_TYPES }, () => [] as Placement[])
    const bushList = Array.from({ length: BUSH_TYPES }, () => [] as Placement[])
    const bladeList: Placement[] = []

    for (let n = 0, tries = 0; n < trees && tries < trees * 6; tries++) {
      // Denser toward the road so the road reads as a corridor through forest, thinning with distance.
      const x = (rand() > 0.5 ? 1 : -1) * (6 + Math.pow(rand(), 1.6) * 74), z = -110 + rand() * 170
      if (!clear(x, z)) continue
      treeList[Math.floor(rand() * TREE_TYPES)].push({ m: place(x, height(x, z) - 0.1, z, 0.85 + rand() * 0.3, 0.05), c: tint(0.7, 1.1) })
      n++
    }
    for (let n = 0, tries = 0; n < bushes && tries < bushes * 6; tries++) {
      const x = (rand() - 0.5) * 90, z = -100 + rand() * 150
      if (!clear(x, z) || Math.abs(x) < 4.2) continue
      bushList[Math.floor(rand() * BUSH_TYPES)].push({ m: place(x, height(x, z) - 0.15, z, 0.7 + rand() * 0.9, 0.2), c: tint(0.6, 1.05) })
      n++
    }
    for (let n = 0, tries = 0; n < grass && tries < grass * 6; tries++) {
      const side = rand() > 0.5 ? 1 : -1
      const x = side * (3 + rand() * rand() * 9), z = -90 + rand() * 135
      if (!clear(x, z)) continue
      bladeList.push({ m: place(x, height(x, z) - 0.02, z, 0.6 + rand() * 0.9, 0.3), c: tint(0.65, 1.1) })
      n++
    }
    return { trees: treeList, bushes: bushList, blades: bladeList }
  }, [clear, height, trees, bushes, grass, seed])

  useFrame(() => {
    kit.bark.tick()
    kit.leaves.tick()
    kit.bushLeaves.tick()
    kit.blades.tick()
    if (!render) return
    // Distance LOD for profile-authored scenes. Culled order is camera position + authored clock.t, never random.
    const radius = render.profile === 'performance'
      ? { trees: 105, bushes: 72, grass: 55 }
      : render.profile === 'ultra'
        ? { trees: Infinity, bushes: Infinity, grass: Infinity }
        : { trees: 170, bushes: 118, grass: 92 }
    const tick = Math.floor(clock.t * 2)
    const moved = cullState.current.position.distanceToSquared(camera.position) > 16
    if (tick === cullState.current.tick && !moved) return
    cullState.current = { tick, position: camera.position.clone() }
    const within = (list: Placement[], max: number) => {
      if (!Number.isFinite(max)) return list
      const { x: cx, z: cz } = camera.position
      return list.filter((p) => {
        const dx = p.m.elements[12] - cx, dz = p.m.elements[14] - cz
        return dx * dx + dz * dz <= max * max
      })
    }
    kit.trees.forEach((_, i) => {
      const list = within(placed.trees[i], radius.trees)
      fill(treeMeshes.current[i * 2] ?? null, list)
      fill(treeMeshes.current[i * 2 + 1] ?? null, list)
    })
    kit.bushes.forEach((_, i) => fill(bushMeshes.current[i] ?? null, within(placed.bushes[i], radius.bushes)))
    fill(bladeMesh.current, within(placed.blades, radius.grass))
  })

  return (
    <group>
      <mesh geometry={groundGeo} receiveShadow>
        <meshStandardMaterial map={groundTex} roughness={0.85} />
      </mesh>
      {kit.trees.map((t, i) => (
        <group key={i}>
          <instancedMesh ref={(im) => { treeMeshes.current[i * 2] = im; fill(im, placed.trees[i]) }} args={[t.bark, kit.bark.mat, Math.max(1, placed.trees[i].length)]} castShadow receiveShadow />
          <instancedMesh ref={(im) => { treeMeshes.current[i * 2 + 1] = im; fill(im, placed.trees[i]) }} args={[t.leaves, kit.leaves.mat, Math.max(1, placed.trees[i].length)]} receiveShadow />
        </group>
      ))}
      {kit.bushes.map((g, i) => (
        <instancedMesh key={i} ref={(im) => { bushMeshes.current[i] = im; fill(im, placed.bushes[i]) }} args={[g, kit.bushLeaves.mat, Math.max(1, placed.bushes[i].length)]} receiveShadow />
      ))}
      <instancedMesh ref={(im) => { bladeMesh.current = im; fill(im, placed.blades) }} args={[kit.grass, kit.blades.mat, Math.max(1, placed.blades.length)]} />
    </group>
  )
}
