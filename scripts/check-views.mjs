import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from 'three'
import { frameAxisView, directorOverview, directorFramePoints } from '../src/studio/viewpoints.ts'

const focus = [2, 3, -7]
const origin = new THREE.Vector3(...focus)
const cases = {
  top: { eye: [2, 63, -7], axes: [[1, 0, 0, 1, 0], [0, 0, 1, 0, -1]] },
  bottom: { eye: [2, -57, -7], axes: [[1, 0, 0, 1, 0], [0, 0, 1, 0, 1]] },
  left: { eye: [-58, 3, -7], axes: [[0, 0, 1, 1, 0], [0, 1, 0, 0, 1]] },
  right: { eye: [62, 3, -7], axes: [[0, 0, 1, -1, 0], [0, 1, 0, 0, 1]] },
}
for (const [view, test] of Object.entries(cases)) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1)
  frameAxisView(camera, view, focus, 2)
  assert.equal(camera.isOrthographicCamera, true)
  assert.deepEqual(camera.position.toArray(), test.eye)
  const centre = origin.clone().project(camera).toArray()
  assert.ok(Math.abs(centre[0]) < 1e-10 && Math.abs(centre[1]) < 1e-10, `${view} must stay centred`)
  for (const [x, y, z, expectedX, expectedY] of test.axes) {
    const projected = origin.clone().add(new THREE.Vector3(x, y, z)).project(camera).sub(origin.clone().project(camera))
    if (expectedX) assert.equal(Math.sign(projected.x), expectedX, `${view} horizontal axis`)
    else assert.ok(Math.abs(projected.x) < 1e-10, `${view} vertical screen axis`)
    if (expectedY) assert.equal(Math.sign(projected.y), expectedY, `${view} vertical axis`)
    else assert.ok(Math.abs(projected.y) < 1e-10, `${view} horizontal screen axis`)
  }
}
console.log('✓ orthographic views: Top/Bottom = X/Z; Left/Right = Z/Y; focused centre and handedness')

const cfg = JSON.parse(fs.readFileSync('src/scenes/railway-crossing/p1_car.json', 'utf8'))
const { sampleShot } = await import('../src/cinematic/curve.ts')
const before = JSON.stringify(cfg)
const camera = new THREE.PerspectiveCamera(50, 1084 / 702.8125, .05, 600)
const { target } = directorOverview(camera, cfg)
camera.lookAt(...target)
camera.updateMatrixWorld(true)
assert.equal(JSON.stringify(cfg), before, 'director framing never edits film cameras')
for (const shot of cfg.shots) for (let i = 0; i <= 32; i++) {
  const projected = new THREE.Vector3(...sampleShot(shot, shot.duration * i / 32).position).project(camera)
  assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1, 'overview includes every authored camera position')
}
console.log('✓ director overview keeps camera paths in view without changing scene JSON')

camera.fov = 30; camera.updateProjectionMatrix()
const pairTarget = directorFramePoints(camera, [cfg.shots[1].from, cfg.shots[1].to])
camera.lookAt(...pairTarget.target); camera.updateMatrixWorld(true)
for (const point of [cfg.shots[1].from, cfg.shots[1].to]) {
  const projected = new THREE.Vector3(...point).project(camera)
  assert(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1, 'pair framing includes both numbered camera positions')
}
console.log('✓ current→next framing keeps both camera points in view')
