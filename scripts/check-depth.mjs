import assert from 'node:assert/strict'
import { projectDepthMesh, depthStudyShots } from '../src/world/DepthProjection.ts'
import { imageToScene } from '../src/world/ImageToScene.ts'
import { validateWorld } from '../src/world/types.ts'
import { sampleShot } from '../src/cinematic/curve.ts'

const image = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(128) }
const depth = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(128) }
const flat = projectDepthMesh(image, depth, { columns: 4, rows: 4 })
assert.equal(flat.positions.length, 16 * 3)
assert.equal(flat.uvs.length, 16 * 2)
assert.equal(flat.indices.length, 9 * 6)
assert(flat.positions.filter((_, i) => i % 3 === 2).every((z) => Math.abs(z + (7 - (7 - .7) * 128 / 255)) < 1e-9))
assert(flat.uvs.every((uv) => uv >= 0 && uv <= 1))
for (let i = 0; i < flat.indices.length; i += 3) {
  const [a, b, c] = flat.indices.slice(i, i + 3).map((index) => flat.positions.slice(index * 3, index * 3 + 3))
  const crossZ = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  assert(crossZ > 0, 'mesh winding faces the reference camera')
}
const steps = { width: 4, height: 1, data: new Uint8ClampedArray(4 * 4) }
for (let x = 0; x < 4; x++) for (let channel = 0; channel < 4; channel++) steps.data[x * 4 + channel] = x < 2 ? 255 : 0
const edited = imageToScene({ width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(128) }, { model: 'Depth-Anything-V2-Small', depth: { width: 1, height: 1, data: new Uint8ClampedArray([128, 128, 128, 255]) } }, 54)
assert(!edited.image.observation.projection, 'existing sparse depth analysis stays unchanged')
assert.equal(edited.image.observation.points.length, 96)
const spec = imageToScene(image, { model: 'Depth-Anything-V2-Small', depth: steps }, 54, { columns: 4, rows: 3, edgeThreshold: .08, photoUrl: '/__depth/depth_test/photo.jpg' })
const mesh = spec.image.observation.projection
assert(mesh && mesh.skippedTriangles > 0, 'large depth jumps are pruned')
assert(mesh.indices.length > 0, 'valid surfaces remain')
assert.equal(validateWorld(spec).join('\n'), '')
assert.equal(validateWorld({ ...spec, image: { ...spec.image, observation: { ...spec.image.observation, projection: { ...mesh, photoUrl: 'https://example.com/x.jpg' } } } }).length > 0, true, 'private photo URLs cannot be replaced by network assets')
assert(!JSON.stringify(spec).includes('data:image'), 'source image bytes are not embedded in scene JSON')
const shots = depthStudyShots(spec)
for (const shot of shots) {
  const sample = sampleShot(shot, shot.duration)
  assert(Math.abs(sample.position[0]) <= mesh.maxOffset + 1e-8 && Math.abs(sample.position[2]) <= mesh.maxOffset + 1e-8)
  assert(sample.position.every(Number.isFinite))
}
assert.throws(() => projectDepthMesh(image, depth, { columns: 2, rows: 8192 }), /8192/)
assert.throws(() => projectDepthMesh(image, { ...steps, data: steps.data.map((_, i) => i % 8 < 4 ? 255 : 0) }, { columns: 4, rows: 3, edgeThreshold: .01 }), /every triangle/)
console.log(`Depth checks passed · ${mesh.positions.length / 3} projected vertices · ${mesh.skippedTriangles} discontinuity triangles pruned · camera offset ≤ ${mesh.maxOffset}m`)
