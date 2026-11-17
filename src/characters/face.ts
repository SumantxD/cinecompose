import * as THREE from 'three'
import type { RigFace } from './rig.ts'

export interface FacialRig extends RigFace {
  group: THREE.Group
  materials: THREE.Material[]
  dispose: () => void
}

export type ExpressionName = 'guarded' | 'fear' | 'tired' | 'trust' | 'grief'
export interface Expression {
  eyes: number
  browRaise: number
  browAngle: number
  mouthOpen: number
  smile: number
  frown: number
}

/** Reference poses, in the same feature coordinates as Character Lab. */
export const EXPRESSIONS: Record<ExpressionName, Expression> = {
  guarded: { eyes: 0.78, browRaise: 0, browAngle: 0.04, mouthOpen: 0, smile: 0, frown: 0.08 },
  fear: { eyes: 1.15, browRaise: 0.014, browAngle: -0.24, mouthOpen: 0.14, smile: 0, frown: 0.45 },
  tired: { eyes: 0.38, browRaise: -0.007, browAngle: -0.16, mouthOpen: 0.025, smile: 0, frown: 0.18 },
  trust: { eyes: 0.88, browRaise: 0.001, browAngle: 0.08, mouthOpen: 0, smile: 0.38, frown: 0 },
  grief: { eyes: 0.56, browRaise: -0.003, browAngle: -0.2, mouthOpen: 0.04, smile: 0, frown: 0.62 },
}

function mouthGeometry() {
  const geometry = new THREE.SphereGeometry(1, 10, 7)
  const p = geometry.getAttribute('position')
  const delta: number[] = [], smile: number[] = [], frown: number[] = []
  for (let i = 0; i < p.count; i++) {
    delta.push(0, p.getY(i) * 2, 0)
    const corner = p.getX(i) ** 2
    smile.push(0, corner - p.getY(i) * 0.35, 0)
    frown.push(0, -corner + p.getY(i) * 0.35, 0)
  }
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(delta, 3), new THREE.Float32BufferAttribute(smile, 3), new THREE.Float32BufferAttribute(frown, 3)]
  geometry.morphTargetsRelative = true
  return geometry
}

/** The rig and the episode share these actual meshes and named export tracks. */
export function createFacialFeatures(): FacialRig {
  const group = new THREE.Group()
  group.name = 'facialFeatures'
  const white = new THREE.MeshStandardMaterial({ color: '#827c70', roughness: 0.82 })
  const dark = new THREE.MeshStandardMaterial({ color: '#171514', roughness: 0.7 })
  const hair = new THREE.MeshStandardMaterial({ color: '#101213', roughness: 0.82 })
  const materials = [white, dark, hair]
  const eyes = [-1, 1].map(side => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 7), white)
    mesh.name = side < 0 ? 'rightEye' : 'leftEye'
    mesh.position.set(side * 0.032, 0.078, 0.094)
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0038, 10), dark)
    pupil.position.z = 0.0132
    mesh.add(pupil)
    group.add(mesh)
    return mesh
  }) as unknown as [THREE.Mesh, THREE.Mesh]
  const brows = [-1, 1].map(side => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.041, 0.006, 0.008), hair)
    mesh.name = side < 0 ? 'rightBrow' : 'leftBrow'
    mesh.position.set(side * 0.032, 0.106, 0.094)
    group.add(mesh)
    return mesh
  }) as unknown as [THREE.Mesh, THREE.Mesh]
  const mouth = new THREE.Mesh(mouthGeometry(), dark)
  mouth.name = 'mouth'
  mouth.position.set(0, 0.018, 0.095)
  mouth.scale.set(0.027, 0.005, 0.004)
  mouth.morphTargetDictionary = { mouthOpen: 0, smile: 1, frown: 2 }
  mouth.morphTargetInfluences = [0, 0, 0]
  group.add(mouth)
  const face: FacialRig = {
    group, materials, eyes, brows, mouth,
    eyeRest: eyes.map(mesh => mesh.position.clone()), browRest: brows.map(mesh => mesh.position.clone()),
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>()
      group.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry) })
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
    },
  }
  applyExpression(face, 'guarded')
  return face
}

export function applyExpression(face: FacialRig, name: ExpressionName) {
  const pose = EXPRESSIONS[name]
  face.eyes.forEach((eye, index) => {
    eye.scale.set(0.85, 0.65 * pose.eyes, 0.35)
    eye.position.copy(face.eyeRest[index])
  })
  face.brows.forEach((brow, index) => {
    const side = index === 0 ? -1 : 1
    brow.position.copy(face.browRest[index])
    brow.position.y += pose.browRaise
    brow.rotation.z = side * pose.browAngle
  })
  face.mouth.morphTargetInfluences = [pose.mouthOpen, pose.smile, pose.frown]
}
