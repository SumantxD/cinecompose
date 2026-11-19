import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Vec3 } from './types.ts'
import type { FaceDetails } from './face.ts'
import { createFacialFeatures } from './face.ts'

const JOINTS: [string, string | null, Vec3][] = [
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.94, 0]],
  ['spine', 'hips', [0, 0.16, 0]],
  ['chest', 'spine', [0, 0.22, 0]],
  ['neck', 'chest', [0, 0.16, 0]],
  ['head', 'neck', [0, 0.12, 0.005]],
  ['leftShoulder', 'chest', [0.205, 0.09, 0]],
  ['leftElbow', 'leftShoulder', [0, -0.29, 0]],
  ['leftWrist', 'leftElbow', [0, -0.26, 0]],
  ['rightShoulder', 'chest', [-0.205, 0.09, 0]],
  ['rightElbow', 'rightShoulder', [0, -0.29, 0]],
  ['rightWrist', 'rightElbow', [0, -0.26, 0]],
  ['leftHip', 'hips', [0.085, 0, 0]],
  ['leftKnee', 'leftHip', [0, -0.435, 0]],
  ['leftAnkle', 'leftKnee', [0, -0.425, 0]],
  ['rightHip', 'hips', [-0.085, 0, 0]],
  ['rightKnee', 'rightHip', [0, -0.435, 0]],
  ['rightAnkle', 'rightKnee', [0, -0.425, 0]],
]

export interface RigFace {
  group: THREE.Group
  details?: FaceDetails
  mouth: THREE.Mesh
  eyes: [THREE.Mesh, THREE.Mesh]
  brows: [THREE.Mesh, THREE.Mesh]
  eyeRest: THREE.Vector3[]
  browRest: THREE.Vector3[]
}
export interface CharacterRig {
  group: THREE.Group
  bones: Record<string, THREE.Bone>
  skeleton: THREE.Skeleton
  skinned: THREE.SkinnedMesh
  rest: Record<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>
  face: RigFace
  animationNodes: THREE.Object3D[]
  dispose: () => void
}
export interface CharacterLook { coat?: string; trousers?: string; skin?: string; hair?: string }

function limb(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const direction = b.clone().sub(a)
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(0.01, direction.length() - radius * 2), 4, 10)
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()))
  geometry.translate(...a.clone().add(b).multiplyScalar(0.5).toArray())
  return geometry
}

export function createCharacterRig(look: CharacterLook = {}): CharacterRig {
  const group = new THREE.Group()
  group.name = 'character'
  const bones: Record<string, THREE.Bone> = {}
  const order: THREE.Bone[] = []
  const rest: CharacterRig['rest'] = {}
  for (const [name, parent, position] of JOINTS) {
    const bone = new THREE.Bone()
    bone.name = name
    bone.position.set(...position)
    bones[name] = bone
    order.push(bone)
    if (parent) bones[parent].add(bone)
  }
  group.updateMatrixWorld(true)

  const materials: THREE.Material[] = [
    new THREE.MeshStandardMaterial({ color: look.coat ?? '#343b35', roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ color: look.trousers ?? '#20242c', roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: look.skin ?? '#4e3a2e', roughness: 0.73 }),
    new THREE.MeshStandardMaterial({ color: look.hair ?? '#101213', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#111316', roughness: 0.68 }),
  ]
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, bone: string, material: number) => {
    const indices = new Uint16Array(g.getAttribute('position').count * 4)
    const weights = new Float32Array(indices.length)
    const index = order.indexOf(bones[bone])
    for (let i = 0; i < indices.length; i += 4) { indices[i] = index; weights[i] = 1 }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
    g.clearGroups()
    const offset = parts.reduce((sum, p) => sum + (p.getIndex()?.count ?? 0), 0)
    g.addGroup(offset, g.getIndex()!.count, material)
    parts.push(g)
  }
  const p = (name: string) => bones[name].getWorldPosition(new THREE.Vector3())
  add(limb(p('leftShoulder'), p('leftElbow'), 0.052), 'leftShoulder', 0)
  add(limb(p('rightShoulder'), p('rightElbow'), 0.052), 'rightShoulder', 0)
  add(limb(p('leftElbow'), p('leftWrist'), 0.043), 'leftElbow', 0)
  add(limb(p('rightElbow'), p('rightWrist'), 0.043), 'rightElbow', 0)
  add(limb(p('leftHip'), p('leftKnee'), 0.072), 'leftHip', 1)
  add(limb(p('rightHip'), p('rightKnee'), 0.072), 'rightHip', 1)
  add(limb(p('leftKnee'), p('leftAnkle'), 0.055), 'leftKnee', 1)
  add(limb(p('rightKnee'), p('rightAnkle'), 0.055), 'rightKnee', 1)
  for (const name of ['leftWrist', 'rightWrist'] as const) {
    const g = new THREE.SphereGeometry(0.045, 10, 8)
    g.scale(0.68, 1.12, 0.58)
    g.translate(...p(name).add(new THREE.Vector3(0, -0.025, 0)).toArray())
    add(g, name, 2)
  }
  for (const name of ['leftAnkle', 'rightAnkle'] as const) {
    const g = new THREE.SphereGeometry(0.055, 10, 8)
    g.scale(0.9, 0.55, 2.35)
    g.translate(...p(name).add(new THREE.Vector3(0, -0.052, 0.052)).toArray())
    add(g, name, 4)
  }
  const pelvis = new THREE.SphereGeometry(0.16, 16, 10)
  pelvis.scale(1, 0.7, 0.68); pelvis.translate(0, 0.96, 0)
  add(pelvis, 'hips', 1)
  const torso = new THREE.LatheGeometry([[0.13, 0], [0.15, 0.1], [0.17, 0.26], [0.19, 0.42], [0.14, 0.5], [0.055, 0.55]].map(([r, y]) => new THREE.Vector2(r, y)), 20)
  torso.scale(1, 1, 0.65); torso.translate(0, 0.985, 0)
  add(torso, 'chest', 0)
  const collar = new THREE.CylinderGeometry(0.075, 0.1, 0.085, 12, 1, true)
  collar.scale(1, 1, 0.8); collar.translate(0, 1.515, -0.005)
  add(collar, 'neck', 0)
  const head = new THREE.SphereGeometry(0.1, 16, 12)
  head.scale(0.86, 1.08, 1); head.translate(...p('head').add(new THREE.Vector3(0, 0.06, 0)).toArray())
  add(head, 'head', 2)
  const hair = new THREE.SphereGeometry(0.104, 16, 10, 0, Math.PI * 2, 0, 1.4)
  hair.scale(0.92, 0.95, 1.05); hair.translate(...p('head').add(new THREE.Vector3(0, 0.1, -0.012)).toArray())
  add(hair, 'head', 3)
  const bag = new THREE.BoxGeometry(0.065, 0.29, 0.22)
  bag.rotateZ(0.08); bag.translate(-0.18, 1.055, 0.015)
  add(bag, 'chest', 4)
  const strap = new THREE.TorusGeometry(0.24, 0.009, 4, 24, Math.PI * 0.62)
  strap.rotateZ(-0.75); strap.scale(1, 1, 0.66); strap.translate(0.02, 1.30, 0.005)
  add(strap, 'chest', 4)

  const geometry = mergeGeometries(parts)
  parts.forEach((part) => part.groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex)))
  const skinned = new THREE.SkinnedMesh(geometry, materials)
  skinned.name = 'proceduralHuman'
  skinned.castShadow = true
  skinned.receiveShadow = true
  skinned.frustumCulled = false
  skinned.add(bones.root)
  const skeleton = new THREE.Skeleton(order)
  skinned.bind(skeleton)
  group.add(skinned)
  for (const part of parts) part.dispose()
  group.updateMatrixWorld(true)

  const facial = createFacialFeatures()
  bones.head.add(facial.group)
  materials.push(...facial.materials)
  const { mouth, eyes, brows, eyeRest, browRest } = facial
  group.updateMatrixWorld(true)
  for (const bone of order) rest[bone.name] = { position: bone.position.clone(), quaternion: bone.quaternion.clone() }

  return {
    group, bones, skeleton, skinned, rest,
    face: { group: facial.group, details: facial.details, mouth, eyes, brows, eyeRest, browRest },
    animationNodes: [mouth, ...eyes, ...brows, ...facial.details.pupils],
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>(), materialSet = new Set(materials)
      group.traverse((node) => {
        if ('geometry' in node) geometries.add((node as THREE.Mesh).geometry)
        const material = (node as THREE.Mesh).material
        if (material) for (const value of Array.isArray(material) ? material : [material]) materialSet.add(value)
      })
      geometries.forEach((g) => g.dispose())
      materialSet.forEach((m) => m.dispose())
    },
  }
}
