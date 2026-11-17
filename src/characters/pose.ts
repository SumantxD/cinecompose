import * as THREE from 'three'
import type { CharacterClip, IKTarget, PositionKey, RotationKey, ScalarKey } from './types.ts'
import type { CharacterRig } from './rig.ts'

export function samplePositionKeys(keys: PositionKey[] | undefined, time: number, out: THREE.Vector3): boolean {
  if (!keys?.length) return false
  let low = 0, high = keys.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (keys[middle].t <= time) low = middle
    else high = middle - 1
  }
  const a = keys[low], b = keys[low + 1] ?? a
  out.set(...a.v)
  if (a !== b) out.lerp(new THREE.Vector3(...b.v), THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1))
  return true
}

export function sampleRotationKeys(keys: RotationKey[] | undefined, time: number, out: THREE.Quaternion): boolean {
  if (!keys?.length) return false
  let low = 0, high = keys.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (keys[middle].t <= time) low = middle
    else high = middle - 1
  }
  const a = keys[low], b = keys[low + 1] ?? a
  out.set(...a.q)
  if (a !== b) out.slerp(new THREE.Quaternion(...b.q), THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1))
  return true
}

export function sampleScalarKeys(keys: ScalarKey[] | undefined, time: number): number | undefined {
  if (!keys?.length) return undefined
  let low = 0, high = keys.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (keys[middle].t <= time) low = middle
    else high = middle - 1
  }
  const a = keys[low], b = keys[low + 1] ?? a
  if (a === b) return a.v
  return THREE.MathUtils.lerp(a.v, b.v, THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1))
}

/** Analytic solve in the target's parent space. Used by the editor and offline authored clips. */
export function solveTwoBone(root: THREE.Bone, joint: THREE.Bone, tip: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3) {
  root.updateWorldMatrix(true, false)
  const start = root.getWorldPosition(new THREE.Vector3())
  const toTarget = target.clone().sub(start)
  if (toTarget.lengthSq() < 1e-8) toTarget.set(0, -0.001, 0)
  const a = joint.position.length(), b = tip.position.length()
  const chainLength = a + b
  if (toTarget.length() > chainLength - 1e-5) toTarget.setLength(chainLength - 1e-5)
  const direction = toTarget.clone().normalize()
  const distance = threeClamp(toTarget.length(), 0.0001, chainLength - 0.00001)
  const bend = pole.clone().sub(start).addScaledVector(direction, -pole.clone().sub(start).dot(direction))
  if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1).addScaledVector(direction, -direction.z)
  if (bend.lengthSq() < 1e-8) bend.set(1, 0, 0).addScaledVector(direction, -direction.x)
  bend.normalize()
  const angle = Math.acos(threeClamp((a * a + distance * distance - b * b) / (2 * a * distance), -1, 1))
  const upperDirection = direction.clone().multiplyScalar(Math.cos(angle)).addScaledVector(bend, Math.sin(angle)).normalize()
  const rest = joint.position.clone().normalize()
  root.quaternion.copy(root.parent!.getWorldQuaternion(new THREE.Quaternion()).invert()
    .multiply(new THREE.Quaternion().setFromUnitVectors(rest, upperDirection))).normalize()
  root.updateWorldMatrix(false, false)
  const middle = root.localToWorld(joint.position.clone())
  const lowerDirection = target.clone().sub(middle).normalize()
  joint.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert()
    .multiply(new THREE.Quaternion().setFromUnitVectors(tip.position.clone().normalize(), lowerDirection))).normalize()
}

const threeClamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function fitPoseCamera(rig: CharacterRig, camera: THREE.PerspectiveCamera) {
  rig.group.updateMatrixWorld(true)
  rig.skinned.computeBoundingBox()
  const box = rig.skinned.boundingBox.clone().applyMatrix4(rig.skinned.matrixWorld)
  const target = box.getCenter(new THREE.Vector3()), half = THREE.MathUtils.degToRad(camera.fov / 2)
  const aperture = Math.atan(Math.tan(half) * Math.min(1, camera.aspect))
  const distance = Math.max(.7, box.getSize(new THREE.Vector3()).length() * .7) / Math.sin(aperture)
  const position = target.clone().add(new THREE.Vector3(2.4, .48, 3.2).normalize().multiplyScalar(distance))
  return { position, target }
}

export function sampleIKTarget(clip: CharacterClip, target: IKTarget, time: number): THREE.Vector3 | undefined {
  const value = new THREE.Vector3()
  if (samplePositionKeys(clip.targets[target], time, value)) return value
  const fallback = clip.motion.reach?.[target]
  return fallback ? value.set(...fallback) : undefined
}

const labels: Record<string, string> = {
  root: 'Body root', hips: 'Hips', spine: 'Lower spine', chest: 'Chest', neck: 'Neck', head: 'Head',
  leftShoulder: 'Left upper arm', leftElbow: 'Left elbow', leftWrist: 'Left wrist',
  rightShoulder: 'Right upper arm', rightElbow: 'Right elbow', rightWrist: 'Right wrist',
  leftHip: 'Left thigh', leftKnee: 'Left knee', leftAnkle: 'Left foot',
  rightHip: 'Right thigh', rightKnee: 'Right knee', rightAnkle: 'Right foot',
}
export const boneLabel = (part: string) => part.startsWith('ik:') ? `${part.startsWith('ik:left') ? 'Left' : 'Right'} hand IK` : labels[part] ?? part
