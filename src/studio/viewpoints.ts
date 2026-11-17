import type { OrthographicCamera } from 'three'
import type { Vec3 } from '../cinematic/types'

export type ViewMode = 'orbit' | 'top' | 'bottom' | 'left' | 'right'
export type AxisView = Exclude<ViewMode, 'orbit'>

export const AXIS_VIEWS: Record<AxisView, { distance: Vec3; up: Vec3 }> = {
  top: { distance: [0, 60, 0], up: [0, 0, -1] },
  bottom: { distance: [0, -60, 0], up: [0, 0, 1] },
  left: { distance: [-60, 0, 0], up: [0, 1, 0] },
  right: { distance: [60, 0, 0], up: [0, 1, 0] },
}

export function frameAxisView(camera: OrthographicCamera, view: AxisView, focus: Vec3, aspect: number) {
  const { distance, up } = AXIS_VIEWS[view]
  camera.position.set(focus[0] + distance[0], focus[1] + distance[1], focus[2] + distance[2])
  camera.up.set(...up)
  camera.lookAt(...focus)
  const width = 3 * Math.max(aspect, 0.01)
  camera.left = -width; camera.right = width; camera.top = 3; camera.bottom = -3
  camera.near = 0.01; camera.far = 600; camera.zoom = 1
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}
