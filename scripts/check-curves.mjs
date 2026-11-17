import assert from 'node:assert/strict'
import {
  pathFromShot, splitCameraPath, segmentCurve, sampleShot, createSegmentRuntime,
  movePathHandle, pathDuration, setNodeMode,
} from '../src/cinematic/curve.ts'
import { moveCameraPoint } from '../src/cinematic/curve.ts'
import { validateScene } from '../src/cinematic/validate.ts'
import { readFileSync } from 'node:fs'

const shot = {
  id: 'move', type: 'slow_push', duration: 10,
  from: [0, 0, 0], to: [4, 0, 0], lookAt: [0, 1, -5], lookAtTo: [1, 2, -6], fov: 40, ease: 'none',
}
const path = pathFromShot(shot)
shot.path = path
path.nodes[0].out = [1, 3, 1]
path.nodes[1].in = [3, -2, 1]

const split = splitCameraPath(path, 0, 0.37)
assert.equal(split.nodes.length, 3)
assert.equal(split.segments.length, 2)
assert.equal(new Set(split.nodes.map((n) => n.id)).size, split.nodes.length)
assert.equal(new Set(split.segments.map((s) => s.id)).size, split.segments.length)
assert.ok(Math.abs(pathDuration(path) - pathDuration(split)) < 1e-9)

let splitError = 0
for (let i = 0; i <= 500; i++) {
  const time = 10 * i / 500
  const a = sampleShot(shot, time), b = sampleShot({ ...shot, path: split }, time)
  splitError = Math.max(splitError, Math.hypot(...a.position.map((n, k) => n - b.position[k])))
}
assert.ok(splitError < 0.003, `insert changed shape by ${splitError}m`)

const original = segmentCurve(path, 0), left = segmentCurve(split, 0), right = segmentCurve(split, 1)
for (let i = 0; i <= 500; i++) {
  const u = i / 500, p = original.getPoint(u)
  const q = u <= 0.37 ? left.getPoint(u / 0.37) : right.getPoint((u - 0.37) / 0.63)
  assert.ok(p.distanceTo(q) < 1e-8, 'De Casteljau geometry must be exact')
}

const nested = splitCameraPath(split, 0, 0.42)
let nestedError = 0
for (let i = 0; i <= 200; i++) {
  const time = 10 * i / 200
  const a = sampleShot({ ...shot, path: split }, time), b = sampleShot({ ...shot, path: nested }, time)
  nestedError = Math.max(nestedError, Math.hypot(...a.position.map((n, k) => n - b.position[k])))
}
assert.ok(nestedError < 0.003, `nested insert changed shape by ${nestedError}m`)

const speeds = []
for (let i = 0; i < 1000; i++) {
  const a = createSegmentRuntime(path, 0).at(i / 1000).position
  const b = createSegmentRuntime(path, 0).at((i + 1) / 1000).position
  speeds.push(Math.hypot(...a.map((n, k) => n - b[k])))
}
const average = speeds.reduce((a, b) => a + b, 0) / speeds.length
const speedError = Math.max(...speeds.map((s) => Math.abs(s - average) / average))
assert.ok(speedError < 0.005, `constant speed error ${(speedError * 100).toFixed(3)}%`)

setNodeMode(split, 1, 'locked')
movePathHandle(split, 1, 'in', [2, 4, 0])
const node = split.nodes[1]
assert.deepEqual(node.position.map((p, i) => (node.in[i] + node.out[i]) / 2), node.position)
setNodeMode(split, 1, 'direction')
movePathHandle(split, 1, 'out', [3, 1, 2])
const incoming = node.position.map((p, i) => p - node.in[i])
const outgoing = node.out.map((p, i) => p - node.position[i])
const dot = incoming.map((n, i) => n * outgoing[i]).reduce((a, b) => a + b, 0)
assert.ok(dot > 0, 'direction-locked handles must remain collinear and opposite')

const scene = JSON.parse(readFileSync('src/scenes/railway-crossing/crossing_prototype.json', 'utf8'))
scene.shots[1].path = nested
const scale = scene.shots[1].duration / pathDuration(nested)
for (const segment of nested.segments) segment.duration *= scale
assert.deepEqual(validateScene(scene), [])
scene.shots[1].path.segments[0].duration += 1
assert.ok(validateScene(scene).some((error) => error.includes('path')))

const zero = pathFromShot({ ...shot, path: undefined, to: shot.from, lookAtTo: shot.from })
const stationary = sampleShot({ ...shot, path: zero }, 5)
assert.deepEqual(sampleShot({ ...shot, path, type: 'static' }, 5).position, path.nodes[0].position)
assert.ok(stationary.position.every(Number.isFinite))
assert.ok(stationary.aim.every(Number.isFinite))
assert.ok(stationary.position.some((value, i) => value !== stationary.aim[i]))

setNodeMode(split, 1, 'free')
const independentOut = [...split.nodes[1].out]
movePathHandle(split, 1, 'in', [2, 2, 2])
assert.deepEqual(split.nodes[1].out, independentOut, 'free handles must be independent')
const beforeMove = JSON.stringify(split.nodes[1])
moveCameraPoint({ ...shot, path: split }, 1, [5, 6, 7])
assert.deepEqual(split.nodes[1].position, [5, 6, 7])
assert.deepEqual(split.nodes[1].aim, JSON.parse(beforeMove).aim)

console.log(`✓ curve checks: split ${splitError.toFixed(8)}m, nested ${nestedError.toFixed(8)}m, speed ${(speedError * 100).toFixed(3)}%`)
