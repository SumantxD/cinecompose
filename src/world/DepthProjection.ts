import type { PixelImage } from './ImageToScene.ts'
import type { ImageObservation } from './types.ts'

export interface DepthProjectionOptions {
  columns?: number
  rows?: number
  near?: number
  far?: number
  focalY?: number
  cameraHeight?: number
  maxOffset?: number
  edgeThreshold?: number
  photoUrl?: string
}

/** The supplied depth is relative. White means nearer; numeric metres are authoring scale, not recovered camera intrinsics. */
export function projectDepthMesh(image: PixelImage, depth: PixelImage, options: DepthProjectionOptions = {}): NonNullable<ImageObservation['projection']> {
  const columns = options.columns ?? 64, rows = options.rows ?? 72
  const near = options.near ?? .7, far = options.far ?? 7, focalY = options.focalY ?? 1.6
  const cameraHeight = options.cameraHeight ?? 1.6, maxOffset = options.maxOffset ?? .25
  const edgeThreshold = options.edgeThreshold ?? .18
  if (columns < 2 || rows < 2 || columns * rows > 8192) throw new Error('Depth mesh must have 4–8192 vertices.')
  if (image.width < 1 || image.height < 1 || depth.width < 1 || depth.height < 1 || depth.data.length < depth.width * depth.height * 4) throw new Error('Photo and depth map need valid dimensions/pixels.')
  if (!(near > 0 && far > near && focalY > .25 && cameraHeight >= .4 && cameraHeight <= 2.2 && maxOffset >= 0 && maxOffset <= .5 && edgeThreshold > 0)) throw new Error('Invalid depth projection or camera-envelope settings.')

  const sample = (x: number, y: number) => {
    const px = Math.max(0, Math.min(depth.width - 1, x * (depth.width - 1))), py = Math.max(0, Math.min(depth.height - 1, y * (depth.height - 1)))
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(depth.width - 1, x0 + 1), y1 = Math.min(depth.height - 1, y0 + 1)
    const tx = px - x0, ty = py - y0, at = (x: number, y: number) => depth.data[(y * depth.width + x) * 4] / 255
    return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty
  }
  const distances: number[] = [], positions: number[] = [], uvs: number[] = []
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const x = col / (columns - 1), y = row / (rows - 1)
    const distance = far - (far - near) * sample(x, y)
    distances.push(distance)
    positions.push((x - .5) * 2 * distance / focalY * (image.width / image.height), cameraHeight + (.5 - y) * 2 * distance / focalY, -distance)
    uvs.push((col + .5) / columns, 1 - (row + .5) / rows)
  }
  const indices: number[] = []
  let skippedTriangles = 0
  const triangle = (a: number, b: number, c: number) => {
    const lo = Math.min(distances[a], distances[b], distances[c]), hi = Math.max(distances[a], distances[b], distances[c])
    // Cut large depth jumps rather than stretching a texture across an unknown hidden surface.
    if (hi - lo > (far - near) * edgeThreshold) { skippedTriangles++; return }
    indices.push(a, b, c)
  }
  for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns - 1; col++) {
    const a = row * columns + col, b = a + 1, c = a + columns, d = c + 1
    triangle(a, c, b); triangle(b, c, d)
  }
  if (!indices.length) throw new Error('Depth discontinuities removed every triangle; lower edgeThreshold or inspect the depth map.')
  return { columns, rows, positions, uvs, indices, photoUrl: options.photoUrl, near, far, focalY, cameraHeight, maxOffset, skippedTriangles }
}

/** Two reviewed shots inside the authoring envelope, not free navigation or claimed recovered 3D coverage. */
export function depthStudyShots(spec: import('./types.ts').SceneSpecification) {
  const mesh = spec.image?.observation?.projection
  if (!mesh) throw new Error('A projected depth mesh is required.')
  const fov = Math.atan(1 / mesh.focalY) * 360 / Math.PI
  const from: [number, number, number] = [0, mesh.cameraHeight, 0]
  const target: [number, number, number] = [0, mesh.cameraHeight, -Math.min(4, mesh.far)]
  return [
    { id: 'reference_frame', type: 'slow_push' as const, duration: 5, from, to: [0, mesh.cameraHeight, -mesh.maxOffset * .35] as [number, number, number], lookAt: target, fov: fov * .82, fovPortrait: Math.min(75, fov) },
    { id: 'parallax_check', type: 'track_lateral' as const, duration: 4, from: [-mesh.maxOffset * .45, mesh.cameraHeight, 0] as [number, number, number], to: [mesh.maxOffset * .45, mesh.cameraHeight, 0] as [number, number, number], lookAt: target, fov: fov * .82, fovPortrait: Math.min(75, fov) },
  ]
}
