import * as THREE from 'three'
import type { Shot } from './types.ts'

export interface FrameIssue {
  kind: 'camera-inside-solid' | 'subject-occluded' | 'subject-outside-frame' | 'subject-not-mounted' | 'invalid-transform'
  object: string
  detail: string
  optional?: boolean
}

const solid = (object: THREE.Object3D): object is THREE.Mesh => {
  if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return false
  if (Array.isArray(object.material)) return object.material.some(material => material instanceof THREE.MeshStandardMaterial && material.depthWrite && !material.wireframe)
  return object.material instanceof THREE.MeshStandardMaterial && object.material.depthWrite && !object.material.wireframe && !object.material.transparent
}
const owner = (object: THREE.Object3D, ancestor: THREE.Object3D) => {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === ancestor) return true
  return false
}
const finiteArray = (values: ArrayLike<number>) => Array.from(values).every(Number.isFinite)
const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const
const contactMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
function closeContact(mesh: THREE.Mesh, point: THREE.Vector3) {
  // Original material/transform stays untouched: side-agnostic tests are only on this proxy.
  const proxy = new THREE.Mesh(mesh.geometry, contactMaterial)
  proxy.matrixAutoUpdate = false
  proxy.matrix.copy(mesh.matrixWorld)
  proxy.matrixWorld.copy(mesh.matrixWorld)
  return directions.some(direction => new THREE.Raycaster(point, new THREE.Vector3(...direction), 0, 0.075).intersectObject(proxy, false).length > 0)
}
const label = (mesh: THREE.Mesh) => mesh.name || mesh.geometry.type
function pathOf(object: THREE.Object3D) {
  const path = []
  for (let node: THREE.Object3D | null = object; node; node = node.parent) path.unshift(node.name || node.type)
  return path.join('/')
}
function where(mesh: THREE.Mesh) {
  const box = new THREE.Box3().setFromObject(mesh)
  return { path: pathOf(mesh), geometry: mesh.geometry.type, position: mesh.getWorldPosition(new THREE.Vector3()).toArray(), bounds: [box.min.toArray(), box.max.toArray()] }
}

/** Audits the actual rendered geometry at the current scene clock. Never moves the supplied camera. */
export function inspectFrame(root: THREE.Object3D, camera: THREE.PerspectiveCamera, shot: Shot): FrameIssue[] {
  root.updateMatrixWorld(true)
  const lens = camera.clone()
  lens.updateMatrixWorld()
  const issues: FrameIssue[] = []
  const meshes: THREE.Mesh[] = []
  const boxes = new Map<THREE.Mesh, THREE.Box3>()
  root.traverseVisible(object => {
    if (!finiteArray(object.matrixWorld.elements)) {
      issues.push({ kind: 'invalid-transform', object: object.name || object.type, detail: 'Non-finite world matrix; check scalar axis rotations and positions' })
      return
    }
    if (!solid(object)) return
    const box = new THREE.Box3().setFromObject(object)
    if (!finiteArray([...box.min.toArray(), ...box.max.toArray()])) {
      issues.push({ kind: 'invalid-transform', object: object.name || object.type, detail: 'Geometry bounds are not finite' })
      return
    }
    meshes.push(object)
    boxes.set(object, box)
  })
  let focus: THREE.Object3D | null = null
  let point: THREE.Vector3 | null = null
  let bounds = new THREE.Box3()
  const named = shot.focus?.object ?? ''
  if (named) {
    root.traverseVisible(object => { if (!focus && object.name === named) focus = object })
    if (!focus) return [...issues, { kind: 'subject-not-mounted', object: named, detail: 'No visible object with this id', optional: shot.focus?.optional }]
    const subject = focus as THREE.Object3D
    bounds = new THREE.Box3().setFromObject(subject)
    point = shot.focus!.local ? subject.localToWorld(new THREE.Vector3(...shot.focus!.local)) : bounds.getCenter(new THREE.Vector3())
  }
  const cameraPoint = lens.getWorldPosition(new THREE.Vector3())
  for (const mesh of meshes) {
    if (focus && owner(mesh, focus)) continue
    const box = boxes.get(mesh)!
    // Conservative contact probe. It is a camera guard, not a claim of rigid-body simulation.
    const sphere = new THREE.Sphere(cameraPoint, 0.075)
    if (box.intersectsSphere(sphere) && closeContact(mesh, cameraPoint)) {
      issues.push({ kind: 'camera-inside-solid', object: label(mesh), detail: JSON.stringify(where(mesh)) })
    }
  }
  if (!focus || !point || !shot.focus) return issues
  const subject = focus as THREE.Object3D
  const ray = new THREE.Raycaster(cameraPoint, point.clone().sub(cameraPoint).normalize(), 0.02, cameraPoint.distanceTo(point) - 0.035)
  const hit = ray.intersectObjects(meshes, false).find(intersection => !owner(intersection.object, subject))
  if (hit) issues.push({ kind: 'subject-occluded', object: shot.focus.object, detail: JSON.stringify({ ...where(hit.object as THREE.Mesh), point: hit.point.toArray(), target: point.toArray() }) })
  const radius = shot.focus.radius ?? (new THREE.Box3().setFromObject(subject).getSize(new THREE.Vector3()).length() / 2)
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const projected = point.clone().add(new THREE.Vector3(x, y, z).multiplyScalar(radius / Math.sqrt(3))).project(lens)
    if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || projected.z < -1 || projected.z > 1) {
      issues.push({ kind: 'subject-outside-frame', object: shot.focus.object, detail: JSON.stringify({ message: 'Subject is clipped at this lens/fov', bounds: [bounds.min.toArray(), bounds.max.toArray()], center: point.toArray(), centerNDC: point.clone().project(lens).toArray() }) })
      return issues.slice(-8)
    }
  }
  return issues.slice(-8)
}
