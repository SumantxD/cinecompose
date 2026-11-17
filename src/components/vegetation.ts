import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clock } from '../cinematic/clock.ts'
import { rng } from '../utils/random.ts'

// Procedural vegetation: seeded archetypes (geometry built once) drawn as InstancedMeshes.
// Trees = tapered curved trunk + branches (bark) and alpha-cut leaf cards (foliage) with crown-spherical normals.

type Rand = () => number

/** Tapered tube along a curve. Radius goes r0 → r1. */
export function limb(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, segs: number, radial: number) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false)
  const p = g.attributes.position as THREE.BufferAttribute
  const c = new THREE.Vector3(), v = new THREE.Vector3()
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c)
    const r = THREE.MathUtils.lerp(r0, r1, i / segs)
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c)
      p.setXYZ(k, v.x, v.y, v.z)
    }
  }
  g.computeVertexNormals()
  // u around the limb, v along it (bark streaks run lengthwise).
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (k % (radial + 1)) / radial, (Math.floor(k / (radial + 1)) / segs) * 6)
  return g
}

/** Leaf cards around points. Normals point away from `center` so the crown shades like a volume, not like planes. */
function cards(rand: Rand, spots: THREE.Vector3[], perSpot: number, spread: number, size: [number, number], center: THREE.Vector3) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = []
  const q = new THREE.Quaternion(), e = new THREE.Euler(), n = new THREE.Vector3()
  const corners = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]]
  for (const s of spots)
    for (let k = 0; k < perSpot; k++) {
      const at = new THREE.Vector3((rand() - 0.5) * 2, (rand() - 0.3) * 1.2, (rand() - 0.5) * 2).multiplyScalar(spread).add(s)
      const w = size[0] + rand() * (size[1] - size[0])
      q.setFromEuler(e.set(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI))
      const base = pos.length / 3
      for (const [x, y, u, v] of corners) {
        const c = new THREE.Vector3(x * w, y * w, 0).applyQuaternion(q).add(at)
        pos.push(c.x, c.y, c.z)
        n.copy(c).sub(center).normalize()
        nor.push(n.x, n.y, n.z)
        uv.push(u, v)
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** One sal-like tree: tall, nearly straight trunk; branches in the upper half; crown in the top third. */
export function salTree(seed: number) {
  const rand = rng(seed)
  const H = 13 + rand() * 7
  const r0 = 0.22 + rand() * 0.14
  const wander = () => (rand() - 0.5) * 0.5
  const trunkCurve = new THREE.CatmullRomCurve3([0, 0.3, 0.55, 0.8, 1].map((t, i) => new THREE.Vector3(i ? wander() * t * 2 : 0, t * H, i ? wander() * t * 2 : 0)))
  const bark: THREE.BufferGeometry[] = [limb(trunkCurve, r0, r0 * 0.25, 12, 8)]
  // Root flare so the trunk sits in the ground instead of on it.
  const flare = new THREE.CylinderGeometry(r0 * 1.05, r0 * 1.7, 0.6, 8, 1, true)
  flare.translate(0, 0.2, 0)
  bark.push(flare)

  const center = new THREE.Vector3().copy(trunkCurve.getPointAt(0.8))
  const spots: THREE.Vector3[] = [trunkCurve.getPointAt(1).clone().add(new THREE.Vector3(0, 0.6, 0))]
  const branches = 5 + Math.floor(rand() * 4)
  for (let b = 0; b < branches; b++) {
    const t = 0.5 + rand() * 0.42
    const start = trunkCurve.getPointAt(t)
    const a = rand() * Math.PI * 2
    const len = 2 + rand() * 3.2 * (1.1 - t)
    const lift = 0.6 + rand() * 0.6
    const dir = new THREE.Vector3(Math.cos(a), lift, Math.sin(a)).normalize()
    const mid = start.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3(0, -0.2 * rand(), 0))
    const end = start.clone().addScaledVector(dir, len).add(new THREE.Vector3(0, 0.3, 0))
    bark.push(limb(new THREE.QuadraticBezierCurve3(start, mid, end), r0 * (0.55 - t * 0.3), 0.03, 4, 5))
    spots.push(end, mid.clone().lerp(end, 0.5))
  }
  const leaves = cards(rand, spots, 7, 1.15, [1.4, 2.4], center)
  return { bark: mergeGeometries(bark.map((g) => g.toNonIndexed()))!, leaves }
}

/** Low monsoon undergrowth: a mound of leaf cards. */
export function bush(seed: number) {
  const rand = rng(seed)
  const spots = Array.from({ length: 5 }, () => new THREE.Vector3((rand() - 0.5) * 1.2, 0.35 + rand() * 0.5, (rand() - 0.5) * 1.2))
  return cards(rand, spots, 6, 0.45, [0.5, 0.95], new THREE.Vector3(0, 0, 0))
}

/** Grass clump: three crossed blade cards, rooted at y = 0. */
export function grassClump() {
  const gs = [0, 1, 2].map((i) => {
    const g = new THREE.PlaneGeometry(0.7, 0.6)
    g.translate(0, 0.3, 0)
    g.rotateY((i * Math.PI) / 3)
    return g
  })
  const g = mergeGeometries(gs)!
  const n = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0) // lit like ground cover, no card-facing shading
  return g
}

function canvas(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!] as const
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** A cluster of broad, oval sal leaves with twigs, on transparent background. */
export function leafTexture(seed = 1) {
  const [c, x] = canvas(512)
  const rand = rng(seed)
  x.strokeStyle = 'rgba(40,32,24,0.9)'
  x.lineWidth = 3
  for (let i = 0; i < 9; i++) {
    x.beginPath()
    x.moveTo(256, 256)
    x.quadraticCurveTo(rand() * 512, rand() * 512, rand() * 512, rand() * 512)
    x.stroke()
  }
  for (let i = 0; i < 170; i++) {
    const r = Math.hypot(rand() - 0.5, rand() - 0.5)
    const px = 256 + (rand() - 0.5) * 460 * (1 - r * 0.4), py = 256 + (rand() - 0.5) * 460 * (1 - r * 0.4)
    if (Math.hypot(px - 256, py - 256) > 235) continue
    const l = 26 + rand() * 30
    const g = 50 + rand() * 45
    x.save()
    x.translate(px, py)
    x.rotate(rand() * Math.PI * 2)
    x.fillStyle = `rgb(${g * 0.55},${g},${g * 0.45})`
    x.beginPath()
    x.ellipse(0, 0, l * 0.42, l, 0, 0, Math.PI * 2)
    x.fill()
    x.strokeStyle = `rgba(${g * 0.9},${g * 1.3},${g * 0.7},0.5)`
    x.lineWidth = 1.5
    x.beginPath()
    x.moveTo(0, -l)
    x.lineTo(0, l)
    x.stroke()
    x.restore()
  }
  return tex(c)
}

export function grassTexture(seed = 2) {
  const [c, x] = canvas(256)
  const rand = rng(seed)
  for (let i = 0; i < 60; i++) {
    const bx = 20 + rand() * 216, h = 120 + rand() * 130, lean = (rand() - 0.5) * 70
    const g = 45 + rand() * 40
    x.strokeStyle = `rgb(${g * 0.7},${g},${g * 0.45})`
    x.lineWidth = 2 + rand() * 3
    x.beginPath()
    x.moveTo(bx, 256)
    x.quadraticCurveTo(bx + lean * 0.3, 256 - h * 0.6, bx + lean, 256 - h)
    x.stroke()
  }
  return tex(c)
}

export function barkTexture(seed = 3) {
  const [c, x] = canvas(256)
  const rand = rng(seed)
  x.fillStyle = '#3b342c'
  x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 260; i++) {
    const v = 30 + rand() * 45
    x.fillStyle = `rgb(${v},${v * 0.9},${v * 0.78})`
    x.fillRect(rand() * 256, rand() * 256, 1 + rand() * 4, 10 + rand() * 60)
  }
  // Wet streaks and lichen.
  for (let i = 0; i < 40; i++) {
    x.fillStyle = rand() > 0.5 ? 'rgba(10,10,8,0.5)' : 'rgba(90,100,70,0.25)'
    x.fillRect(rand() * 256, rand() * 256, 2 + rand() * 6, 30 + rand() * 120)
  }
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Adds monsoon wind to a material: whole-plant sway rising with height, plus leaf flutter. Reads clock.t. */
export function withWind(mat: THREE.Material, { sway = 0.25, flutter = 0.03, base = 3, top = 18 } = {}) {
  const uniforms = { uTime: { value: 0 } }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #else
          vec4 wWorld = modelMatrix * vec4(transformed, 1.0);
        #endif
        float wH = smoothstep(${base.toFixed(2)}, ${top.toFixed(2)}, transformed.y);
        float wS = sin(uTime * 0.9 + wWorld.x * 0.07 + wWorld.z * 0.05) + 0.45 * sin(uTime * 2.1 + wWorld.x * 0.2);
        transformed.xz += vec2(wS, wS * 0.4) * ${sway.toFixed(3)} * wH;
        transformed += vec3(sin(uTime * 7.0 + wWorld.y * 3.1 + wWorld.x), cos(uTime * 6.0 + wWorld.z * 2.7), 0.0) * ${flutter.toFixed(3)} * wH;`,
      )
  }
  mat.customProgramCacheKey = () => `wind-${sway}-${flutter}-${base}-${top}`
  return { mat, tick: () => (uniforms.uTime.value = clock.t) }
}
