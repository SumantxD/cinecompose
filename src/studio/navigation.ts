import { Vector3, type PerspectiveCamera, type Quaternion, type Vector2 } from 'three'

const movement = new Vector3()

/** Constant-speed fly-through zoom. Moving the pivot too keeps orbit optional, never a zoom limit. */
export function freeDolly(position: Vector3, target: Vector3, forward: Vector3, delta: number, navSpeed = 1) {
  movement.copy(forward).normalize().multiplyScalar(-delta * 0.015 * navSpeed)
  position.add(movement)
  target.add(movement)
}

interface TouchCameraOrigin { position: Vector3; target: Vector3; quaternion: Quaternion; span: number; centre: Vector2 }

// ponytail: fixed-plane two-finger pan/dolly; add twist here if the film needs it.
export function touchDollyPan(camera: PerspectiveCamera, target: Vector3, from: TouchCameraOrigin, centre: Vector2, span: number, height: number): void {
  const zoom = from.span / Math.max(0.001, span)
  const distance = from.position.distanceTo(from.target) * zoom
  const units = 2 * distance * Math.tan(camera.fov * Math.PI / 360) / height
  const right = new Vector3(1, 0, 0).applyQuaternion(from.quaternion)
  const up = new Vector3(0, 1, 0).applyQuaternion(from.quaternion)
  const shift = right.multiplyScalar((from.centre.x - centre.x) * units).addScaledVector(up, (centre.y - from.centre.y) * units)
  target.copy(from.target).add(shift)
  camera.position.copy(from.position).sub(from.target).multiplyScalar(zoom).add(target)
}
