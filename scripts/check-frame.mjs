import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from 'three'
import { inspectFrame } from '../src/cinematic/quality.ts'
import { practicalIntensity } from '../src/cinematic/lighting.ts'
import { validateScene } from '../src/cinematic/validate.ts'

const burnScene = JSON.parse(fs.readFileSync('src/scenes/childhood-house/ending_forgetting.json', 'utf8'))
assert.deepEqual(validateScene(burnScene), [])
for (const paperBurn of [{ at: -1, duration: 5 }, { at: 1, duration: 0 }, { at: 1000, duration: 5 }]) {
  assert(validateScene({ ...burnScene, props: { ...burnScene.props, paperBurn } }).some(error => error.includes('paperBurn')))
}

const mistScene = JSON.parse(fs.readFileSync('src/scenes/railway-crossing/p1_turn.json', 'utf8'))
assert.deepEqual(validateScene(mistScene), [])
for (const overrides of [{ width: -1 }, { height: 2 }, { opacity: 0.8 }]) {
  assert(validateScene({ ...mistScene, props: { groundMist: { ...mistScene.props.groundMist, ...overrides } } }).some(error => error.includes('groundMist')))
}

function camera(position) {
  const result = new THREE.PerspectiveCamera(40, 390 / 844, 0.05, 40)
  result.position.set(...position)
  result.lookAt(0, 0, 0)
  result.updateMatrixWorld(true)
  return result
}
const material = new THREE.MeshStandardMaterial({ color: '#777777' })
function box(name, position, size) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.name = name
  mesh.position.set(...position)
  return mesh
}
const root = new THREE.Group(), subject = box('horse', [0, 0, 0], [0.25, 0.35, 0.2])
root.add(subject)
const shot = { focus: { object: 'horse', local: [0, 0, 0], radius: 0.16 } }
const lens = camera([0, 0, 2])
assert.deepEqual(inspectFrame(root, lens, shot), [])
lens.position.y = 0.3
lens.lookAt(0, 0, 0)
lens.updateMatrixWorld(true)
const before = { position: lens.position.toArray(), rotation: lens.quaternion.toArray(), matrix: lens.projectionMatrix.toArray() }
const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material)
floor.rotation.x = -Math.PI / 2
floor.position.y = 0.29
root.add(floor)
assert(inspectFrame(root, lens, shot).some(issue => issue.kind === 'camera-inside-solid'))
floor.position.y = 0
assert(!inspectFrame(root, lens, shot).some(issue => issue.kind === 'camera-inside-solid'))
root.remove(floor)
subject.rotation.x = [-Math.PI / 2, 0, 0]
root.updateMatrixWorld(true)
assert(inspectFrame(root, lens, shot).some(issue => issue.kind === 'invalid-transform'))
subject.rotation.x = 0
root.updateMatrixWorld(true)
assert.equal(subject.material.side, THREE.FrontSide)
root.add(box('door', [0, 0, 0.8], [1, 2, 0.1]))
assert(inspectFrame(root, lens, shot).some(issue => issue.kind === 'subject-occluded' && issue.object === 'horse'))
const clipping = camera([0, 0, 0.8])
assert(inspectFrame(root, clipping, shot).some(issue => issue.kind === 'camera-inside-solid'))
assert.deepEqual(before, { position: lens.position.toArray(), rotation: lens.quaternion.toArray(), matrix: lens.projectionMatrix.toArray() })
assert.equal(practicalIntensity([0, 2, 0], [0, 0, 0], 3), 12)
assert.throws(() => practicalIntensity([0, 0, 0], [0, 0, 0], 1), /Invalid practical light placement/)
fs.mkdirSync('/tmp/kaali-story-completion/system', { recursive: true })
fs.writeFileSync('/tmp/kaali-story-completion/system/frame-checks.json', JSON.stringify({ clear: true, occlusion: true, exactCameraContact: true, nonFiniteTransformRejected: true, materialsUnchanged: true, cameraUnchanged: true, calibratedPointLight: true, mistVisibilityLimits: true }, null, 2))
console.log('✓ rendered-frame guards: sightline, exact geometry contact, invalid transforms, immutability, calibrated lighting and valid paper-burn timing')
