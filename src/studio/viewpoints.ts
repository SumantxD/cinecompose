import type { OrthographicCamera, PerspectiveCamera } from 'three'
import type { SceneConfig, Vec3 } from '../cinematic/types'
import { sampleShot } from '../cinematic/curve.ts'

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

export function directorFramePoints(camera: PerspectiveCamera, points: Vec3[]): { target: Vec3 } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const point of points) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], point[i]); max[i] = Math.max(max[i], point[i]) }
  const target = min.map((n, i) => (n + max[i]) / 2) as Vec3
  const radius = Math.max(1, Math.hypot(...min.map((n, i) => max[i] - n)) / 2)
  const distance = Math.max(6, radius / Math.tan(camera.fov * Math.PI / 360) * 1.2)
  const direction: Vec3 = [1.25, .65, 1]
  const length = Math.hypot(...direction)
  camera.position.set(...target.map((n, i) => n + direction[i] / length * distance) as Vec3)
  return { target }
}

export function directorOverview(camera: PerspectiveCamera, cfg: SceneConfig): { target: Vec3 } {
  const home = cfg.props?.world ? cfg.shots.find((shot) => shot.id === 'world_overview') ?? cfg.shots[0] : undefined
  if (home) {
    camera.position.set(...(home.from ?? [13, 8, 19]))
    return { target: home.lookAt ?? [0, 1, -4] }
  }
  const points = cfg.shots.flatMap((shot) => Array.from({ length: 17 }, (_, i) => sampleShot(shot, shot.duration * i / 16).position))
  return directorFramePoints(camera, points)
}
