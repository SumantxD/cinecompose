import gsap from 'gsap'
import * as THREE from 'three'
import { PRESETS } from './presets.ts'
import type { CameraNode, CameraPath, CameraSegment, HandleMode, Shot, Vec3 } from './types.ts'

const N = 512
const clamp = THREE.MathUtils.clamp
const v3 = (v: Vec3) => new THREE.Vector3(...v)
const tuple = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z]
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const end = (shot: Shot) => shot.to ?? shot.from
const aimEnd = (shot: Shot) => shot.lookAtTo ?? shot.lookAt
const easeCache = new Map<string, (p: number) => number>()
const ease = (name: string) => {
  let fn = easeCache.get(name)
  if (!fn) { fn = gsap.parseEase(name); easeCache.set(name, fn) }
  return fn
}
const shotEase = (shot: Shot) => shot.ease ?? PRESETS[shot.type].ease

export function pathFromShot(shot: Shot): CameraPath {
  const node = (id: string, position: Vec3, aim: Vec3, inHandle: Vec3, outHandle: Vec3, aimIn: Vec3, aimOut: Vec3): CameraNode => ({
    id, position: [...position], aim: [...aim], in: [...inHandle], out: [...outHandle], aimIn: [...aimIn], aimOut: [...aimOut], mode: 'locked',
  })
  return {
    nodes: [
      node('start', shot.from, shot.lookAt, mix(shot.from, end(shot), 0), mix(shot.from, end(shot), 1 / 3), mix(shot.lookAt, aimEnd(shot), 0), mix(shot.lookAt, aimEnd(shot), 1 / 3)),
      node('end', end(shot), aimEnd(shot), mix(shot.from, end(shot), 2 / 3), mix(shot.from, end(shot), 1), mix(shot.lookAt, aimEnd(shot), 2 / 3), mix(shot.lookAt, aimEnd(shot), 1)),
    ],
    segments: [{ id: 'curve', from: 0, to: 1, duration: shot.duration, easing: shotEase(shot), easeRange: [0, 1] }],
  }
}

type Cubic = [Vec3, Vec3, Vec3, Vec3]
function curves(path: CameraPath, index: number): { position: Cubic; aim: Cubic } {
  const s = path.segments[index], a = path.nodes[s.from], b = path.nodes[s.to]
  return {
    position: [a.position, a.out, b.in, b.position],
    aim: [a.aim, a.aimOut, b.aimIn, b.aim],
  }
}

export function segmentCurve(path: CameraPath, index: number, aim = false) {
  const p = curves(path, index)[aim ? 'aim' : 'position']
  return new THREE.CubicBezierCurve3(...p.map(v3) as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3])
}

function parameterAt(table: Float64Array, progress: number) {
  const target = clamp(progress, 0, 1) * table[N]
  let lo = 0, hi = N
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (table[mid] < target) lo = mid
    else hi = mid
  }
  const span = table[hi] - table[lo]
  return (lo + (span > 1e-12 ? (target - table[lo]) / span : 0)) / N
}

function fractionAt(table: Float64Array, u: number) {
  if (!table[N]) return 0
  const x = clamp(u, 0, 1) * N, i = Math.min(N - 1, Math.floor(x)), t = x - i
  return (table[i] + (table[i + 1] - table[i]) * t) / table[N]
}

export function createSegmentRuntime(path: CameraPath, index: number) {
  const segment = path.segments[index]
  const position = segmentCurve(path, index), aim = segmentCurve(path, index, true)
  const table = new Float64Array(N + 1)
  const previous = position.getPoint(0), point = new THREE.Vector3()
  for (let i = 1; i <= N; i++) {
    position.getPoint(i / N, point)
    table[i] = table[i - 1] + point.distanceTo(previous)
    previous.copy(point)
  }
  const range = segment.easeRange ?? [0, 1]
  const timing = ease(segment.easing)
  const progress0 = timing(range[0]), progress1 = timing(range[1])
  const at = (t: number) => {
    if (!table[N]) return { position: tuple(position.getPoint(0)), aim: tuple(aim.getPoint(0)), u: 0 }
    const parentProgress = timing(range[0] + (range[1] - range[0]) * clamp(t, 0, 1))
    const progress = (parentProgress - progress0) / (progress1 - progress0 || 1)
    const u = parameterAt(table, progress)
    return { position: tuple(position.getPoint(u)), aim: tuple(aim.getPoint(u)), u }
  }
  const timeAt = (u: number) => {
    const progress = progress0 + fractionAt(table, u) * (progress1 - progress0)
    let lo = 0, hi = 1
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2
      if (timing(range[0] + (range[1] - range[0]) * mid) < progress) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  return { at, timeAt }
}

export const pathDuration = (path: CameraPath) => path.segments.reduce((sum, s) => sum + s.duration, 0)
const runtimeCache = new WeakMap<CameraPath, ReturnType<typeof createSegmentRuntime>[]>()
function segmentRuntime(path: CameraPath, index: number) {
  let runtimes = runtimeCache.get(path)
  if (!runtimes) { runtimes = path.segments.map((_, i) => createSegmentRuntime(path, i)); runtimeCache.set(path, runtimes) }
  return runtimes[index]
}

export function sampleShot(shot: Shot, t: number) {
  if (shot.type === 'static' || shot.type === 'security') {
    const initial = shot.path?.nodes[0]
    return { position: initial?.position ?? shot.from, aim: initial?.aim ?? shot.lookAt, u: 0, segment: 0 }
  }
  if (shot.path) {
    let start = 0
    for (let i = 0; i < shot.path.segments.length; i++) {
      const segment = shot.path.segments[i]
      if (t <= start + segment.duration + 1e-8 || i === shot.path.segments.length - 1) {
        const local = clamp((t - start) / segment.duration, 0, 1)
        const sample = segmentRuntime(shot.path, i).at(local)
        if (new THREE.Vector3(...sample.position).distanceToSquared(new THREE.Vector3(...sample.aim)) > 1e-12)
          return { ...sample, segment: i }
        const dt = local < 0.5 ? 1e-4 : -1e-4
        const before = segmentRuntime(shot.path, i).at(clamp(local + dt, 0, 1))
        const dir = new THREE.Vector3(...before.position).sub(new THREE.Vector3(...sample.position))
        if (dir.lengthSq() < 1e-12) dir.set(0, 0, -1)
        return { ...sample, aim: tuple(new THREE.Vector3(...sample.position).add(dir)), segment: i }
      }
      start += segment.duration
    }
  }
  const progress = ease(shotEase(shot))(clamp(t / shot.duration, 0, 1))
  return {
    position: mix(shot.from, end(shot), progress),
    aim: mix(shot.lookAt, aimEnd(shot), progress),
    u: progress,
    segment: 0,
  }
}

export function splitCameraPath(path: CameraPath, index: number, u: number): CameraPath {
  u = clamp(u, 1e-5, 1 - 1e-5)
  const original = curves(path, index)
  const position = deCasteljau(original.position, u)
  const aim = deCasteljau(original.aim, u)
  const segment = path.segments[index]
  const range = segment.easeRange ?? [0, 1]
  const t = createSegmentRuntime(path, index).timeAt(u)
  const splitTime = range[0] + (range[1] - range[0]) * t
  const leftDuration = segment.duration * ((splitTime - range[0]) / (range[1] - range[0]))
  const next = JSON.parse(JSON.stringify(path)) as CameraPath
  const nodeIndex = segment.to
  next.nodes.splice(nodeIndex, 0, next.nodes[nodeIndex])
  const left: CameraSegment = { ...segment, id: `${segment.id}.a`, to: nodeIndex, duration: leftDuration, easeRange: [range[0], splitTime] }
  const right: CameraSegment = { ...segment, id: `${segment.id}.b`, from: nodeIndex, to: segment.to + 1, duration: segment.duration - leftDuration, easeRange: [splitTime, range[1]] }
  next.segments.splice(index, 1, left, right)
  for (let i = index + 2; i < next.segments.length; i++) {
    next.segments[i].from++
    next.segments[i].to++
  }
  next.nodes[nodeIndex - 1].out = [...position.left[1]]
  next.nodes[nodeIndex + 1].in = [...position.right[2]]
  next.nodes[nodeIndex] = {
    ...next.nodes[nodeIndex],
    id: `P${path.nodes.length}`,
    position: [...position.left[3]], in: [...position.left[2]], out: [...position.right[1]],
    aim: [...aim.left[3]], aimIn: [...aim.left[2]], aimOut: [...aim.right[1]],
    mode: 'direction',
  }
  next.nodes[nodeIndex + 1].aimIn = [...aim.right[2]]
  return next
}

function deCasteljau(p: Cubic, t: number) {
  const a = mix(p[0], p[1], t), b = mix(p[1], p[2], t), c = mix(p[2], p[3], t)
  const d = mix(a, b, t), e = mix(b, c, t), f = mix(d, e, t)
  return { left: [p[0], a, d, f] as Cubic, right: [f, e, c, p[3]] as Cubic }
}

export function getCameraPoint(shot: Shot, index: number) {
  if (shot.path) {
    const node = shot.path.nodes[index]
    let time = 0
    for (let i = 0; i < index; i++) time += shot.path.segments[i].duration
    return { position: node.position, aim: node.aim, time, node: index }
  }
  const last = index > 0
  return { position: last ? end(shot) : shot.from, aim: last ? aimEnd(shot) : shot.lookAt, time: last ? shot.duration - 0.01 : 0, node: last ? 1 : 0 }
}

export const shotPointCount = (shot: Shot) => shot.path ? shot.path.nodes.length : 2

export function moveCameraPoint(shot: Shot, index: number, position: Vec3) {
  if (!shot.path) { if (index > 0) shot.to = [...position]; else shot.from = [...position]; return }
  const node = shot.path.nodes[index]
  const delta = v3(position).sub(v3(node.position))
  node.position = [...position]
  node.in = tuple(v3(node.in).add(delta))
  node.out = tuple(v3(node.out).add(delta))
}

export function moveCameraAim(shot: Shot, index: number, aim: Vec3) {
  if (!shot.path) { if (index > 0) shot.lookAtTo = [...aim]; else shot.lookAt = [...aim]; return }
  const node = shot.path.nodes[index]
  const delta = v3(aim).sub(v3(node.aim))
  node.aim = [...aim]
  node.aimIn = tuple(v3(node.aimIn).add(delta))
  node.aimOut = tuple(v3(node.aimOut).add(delta))
}

type HandleKey = 'in' | 'out' | 'aimIn' | 'aimOut'
export function movePathHandle(path: CameraPath, index: number, key: HandleKey, position: Vec3) {
  const node = path.nodes[index]
  const aim = key.startsWith('aim'), outgoing = key === 'out' || key === 'aimOut'
  const other = outgoing ? (aim ? 'aimIn' : 'in') : (aim ? 'aimOut' : 'out')
  node[key] = [...position]
  const p = v3(node[aim ? 'aim' : 'position']), h = v3(position)
  if (node.mode === 'locked') node[other] = tuple(p.clone().multiplyScalar(2).sub(h))
  else if (node.mode === 'direction') {
    const length = v3(node[other]).distanceTo(p)
    const direction = p.sub(h)
    node[other] = direction.lengthSq() < 1e-12 ? tuple(p) : tuple(p.add(direction.normalize().multiplyScalar(length)))
  }
}

export function setNodeMode(path: CameraPath, index: number, mode: HandleMode) {
  path.nodes[index].mode = mode
  if (mode !== 'free') movePathHandle(path, index, 'in', [...path.nodes[index].in])
}

export function setShotDuration(shot: Shot, duration: number) {
  if (shot.path && shot.duration > 0) {
    const ratio = duration / shotDurationSafe(shot)
    for (const segment of shot.path.segments) segment.duration *= ratio
  }
  shot.duration = duration
}
const shotDurationSafe = (shot: Shot) => shot.duration || 1e-6
