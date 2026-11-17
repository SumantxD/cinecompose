import assert from 'node:assert/strict'
import * as THREE from 'three'
import { frameAxisView } from '../src/studio/viewpoints.ts'

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
