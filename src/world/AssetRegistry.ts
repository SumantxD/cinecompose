import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '../utils/random.ts'
import { salTree, bush, limb, grassClump } from '../components/vegetation.ts'

export interface GeometryPart {
  geometry: THREE.BufferGeometry
  color: string
  role?: 'wall' | 'wood' | 'leaf' | 'bark'
}
export interface AssemblyDefinition {
  footprint: number
  build: (seed: number, parameters?: Record<string, number | string | boolean>) => GeometryPart[]
}
const assemblies = new Map<string, AssemblyDefinition>()
export function registerAssembly(id: string, definition: AssemblyDefinition) { assemblies.set(id, definition) }
export function assembly(id: string) {
  const definition = assemblies.get(id)
  if (!definition) throw new Error(`Unregistered world assembly "${id}". Register its builder or licensed asset first.`)
  return definition
}

function part(geometry: THREE.BufferGeometry, color: string, position: number[] = [0, 0, 0], role?: GeometryPart['role']): GeometryPart {
  geometry.translate(position[0], position[1], position[2])
  return { geometry, color, role }
}
const box = (size: number[], color: string, position: number[], role?: GeometryPart['role']) => part(new THREE.BoxGeometry(...size as [number, number, number]), color, position, role)
const cylinder = (top: number, bottom: number, height: number, color: string, position: number[], role?: GeometryPart['role']) => part(new THREE.CylinderGeometry(top, bottom, height, 10), color, position, role)
const sphere = (radius: number, color: string, position: number[], scale: number[] = [1, 1, 1]) => part(new THREE.SphereGeometry(radius, 10, 7).scale(...scale as [number, number, number]), color, position)

registerAssembly('classic/sal', { footprint: 3, build: (seed) => {
  const tree = salTree(seed)
  return [{ geometry: tree.bark, color: '#514134', role: 'bark' }, { geometry: tree.leaves, color: '#3d4b31', role: 'leaf' }]
} })
registerAssembly('classic/banyan', { footprint: 5, build: (seed) => {
  const random = rng(seed), bark: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = []
  const root = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 2.8, 0.1), new THREE.Vector3(-0.3, 5.7, 0)])
  bark.push(limb(root, 0.65, 0.2, 10, 8))
  for (let i = 0; i < 11; i++) {
    const angle = i / 11 * Math.PI * 2 + random() * 0.3
    const start = root.getPointAt(0.4 + random() * 0.5)
    const end = new THREE.Vector3(Math.cos(angle) * (3.2 + random() * 1.8), 4.5 + random() * 1.5, Math.sin(angle) * (3.2 + random() * 1.8))
    bark.push(limb(new THREE.QuadraticBezierCurve3(start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.7, 0)), end), 0.2, 0.035, 6, 6))
    if (i % 2 === 0) bark.push(limb(new THREE.LineCurve3(end.clone().lerp(start, 0.15), new THREE.Vector3(end.x, -0.08, end.z)), 0.075, 0.025, 4, 5))
    leaves.push(bush(seed * 31 + i).scale(1.6 + random() * 0.5, 1.2, 1.6 + random() * 0.5).translate(end.x, end.y, end.z))
  }
  return [{ geometry: mergeGeometries(bark.map((g) => g.toNonIndexed())), color: '#4b4030', role: 'bark' }, { geometry: mergeGeometries(leaves), color: '#42543a', role: 'leaf' }]
} })
registerAssembly('classic/dead-tree', { footprint: 2, build: (seed) => {
  const random = rng(seed), pieces: THREE.BufferGeometry[] = [limb(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0.3, 4.5, 0)), 0.25, 0.035, 6, 6)]
  for (let i = 0; i < 5; i++) {
    const a = random() * Math.PI * 2, start = new THREE.Vector3(0.15, 2 + random() * 1.8, 0)
    const end = new THREE.Vector3(Math.cos(a) * 1.6, start.y + 0.8, Math.sin(a) * 1.6)
    pieces.push(limb(new THREE.LineCurve3(start, end), 0.08, 0.01, 3, 5))
  }
  return [{ geometry: mergeGeometries(pieces.map((g) => g.toNonIndexed())), color: '#554b3d', role: 'bark' }]
} })
registerAssembly('classic/grass', { footprint: 0.4, build: () => [{ geometry: grassClump(), color: '#556342', role: 'leaf' }] })
registerAssembly('classic/rock', { footprint: 0.8, build: (seed) => [{ geometry: new THREE.DodecahedronGeometry(0.5, 0).scale(1 + rng(seed)(), 0.55, 0.8), color: '#68665d' }] })

registerAssembly('classic/stone-temple', { footprint: 5, build: () => [
  box([7, 0.5, 6], '#736b5c', [0, 0.25, 0], 'wall'),
  box([7.7, 0.22, 6.6], '#827967', [0, 0.58, 0], 'wall'),
  box([6.1, 0.2, 1.2], '#766b58', [0, 0.1, 3.6], 'wall'),
  box([1.15, 2.8, 3.7], '#75684f', [-2.25, 2, -0.4], 'wall'),
  box([1.15, 2.8, 3.7], '#75684f', [2.25, 2, -0.4], 'wall'),
  box([3.5, 2.8, 0.6], '#75684f', [0, 2, -2.1], 'wall'),
  box([5.6, 0.45, 1], '#8b7e63', [0, 3.4, 1.35], 'wall'),
  cylinder(0.2, 0.28, 2.8, '#918264', [-1.72, 2, 1.3], 'wall'),
  cylinder(0.2, 0.28, 2.8, '#918264', [1.72, 2, 1.3], 'wall'),
  part(new THREE.LatheGeometry([[0, 0], [2.9, 0], [2.65, 0.5], [2.3, 0.7], [2.35, 0.95], [1.95, 1.2], [1.65, 1.8], [1.15, 2.55], [0.7, 3.3], [0.1, 3.5]].map(([x, y]) => new THREE.Vector2(x, y)), 16), '#857752', [0, 3.6, -0.55], 'wall'),
  cylinder(0.09, 0.13, 1.1, '#b19b5d', [0, 7.5, -0.55]),
  sphere(0.2, '#b19b5d', [0, 7.1, -0.55], [0.8, 1.25, 0.8]),
] })
registerAssembly('classic/stone-well', { footprint: 2, build: () => [
  part(new THREE.LatheGeometry([[0.75, 0], [1.0, 0], [1.0, 0.85], [1.13, 0.91], [1.13, 1.03], [0.75, 1.03], [0.75, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 24), '#80725e', [0, 0.05, 0], 'wall'),
  cylinder(0.075, 0.1, 2.7, '#4e3d2a', [-1.25, 1.35, 0], 'wood'),
  cylinder(0.075, 0.1, 2.7, '#4e3d2a', [1.25, 1.35, 0], 'wood'),
  part(new THREE.CylinderGeometry(0.1, 0.1, 2.7, 10).rotateZ(Math.PI / 2), '#4e3d2a', [0, 2.6, 0], 'wood'),
  cylinder(0.018, 0.018, 1.7, '#6e5c3d', [0, 1.6, 0], 'wood'),
  cylinder(0.22, 0.17, 0.32, '#514638', [0, 0.7, 0], 'wood'),
] })
registerAssembly('classic/mud-house', { footprint: 4, build: (seed) => {
  const random = rng(seed), warm = random() > 0.5 ? '#80664b' : '#766248'
  const roofColor = random() > 0.5 ? '#615449' : '#6e4935'
  return [
    box([5.3, 0.25, 4.7], '#706756', [0, 0.12, 0], 'wall'),
    box([0.22, 2.4, 4.4], warm, [-2.5, 1.45, 0], 'wall'), box([0.22, 2.4, 4.4], warm, [2.5, 1.45, 0], 'wall'),
    box([5, 2.4, 0.22], warm, [0, 1.45, -2.1], 'wall'),
    box([1.7, 2.4, 0.22], warm, [-1.65, 1.45, 2.1], 'wall'), box([1.7, 2.4, 0.22], warm, [1.65, 1.45, 2.1], 'wall'),
    box([1.6, 0.65, 0.22], warm, [0, 2.33, 2.1], 'wall'),
    part(new THREE.BoxGeometry(3.15, 0.13, 4.9).rotateZ(-0.38), roofColor, [-1.37, 3.13, 0], 'wall'),
    part(new THREE.BoxGeometry(3.15, 0.13, 4.9).rotateZ(0.38), roofColor, [1.37, 3.13, 0], 'wall'),
    box([2.5, 0.12, 1.8], '#615140', [0, 2.05, 2.85], 'wood'),
    cylinder(0.065, 0.075, 2, '#493720', [-1.1, 1.0, 3.55], 'wood'),
    cylinder(0.065, 0.075, 2, '#493720', [1.1, 1.0, 3.55], 'wood'),
    box([0.7, 0.85, 0.08], '#443c30', [1.65, 1.45, 2.25], 'wood'),
  ]
} })
registerAssembly('classic/broken-wall', { footprint: 3, build: (seed) => {
  const random = rng(seed), parts: GeometryPart[] = []
  for (let i = 0; i < 5; i++) parts.push(box([0.9, 0.7 + random() * 1.8, 0.35], '#706555', [(i - 2) * 0.95, 0.4 + random() * 0.3, 0], 'wall'))
  for (let i = 0; i < 8; i++) parts.push(sphere(0.3, '#6e6453', [(random() - 0.5) * 5.5, 0.15, (random() - 0.5) * 1.8], [1.4, 0.65, 1]))
  return parts
} })
registerAssembly('classic/wood-watchtower', { footprint: 3, build: () => {
  const pieces = [box([3, 0.2, 3], '#68503a', [0, 3.5, 0], 'wood'), box([3.7, 0.22, 3.7], '#534238', [0, 4.8, 0], 'wood')]
  for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) pieces.push(cylinder(0.08, 0.12, 3.5, '#51402b', [x, 1.75, z], 'wood'))
  pieces.push(box([0.9, 1.15, 0.14], '#68503a', [0, 0.6, 0.15], 'wood'))
  for (let i = 0; i < 6; i++) pieces.push(box([0.5, 0.1, 0.2], '#6f5235', [0.9, i * 0.55 + 0.2, 1.5], 'wood'))
  return pieces
} })

/** Retained for future non-growing classic props: still assembly-specific, never scenario special cases. */
export const ASSEMBLY_IDS = [...assemblies.keys()]
