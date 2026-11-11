import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock, lightRegistry } from '../cinematic/clock'
import { rng } from '../utils/random'

// Monsoon rain: GPU-animated streaks in a box that follows the camera, plus splashes popping on the ground.
// Both read clock.t and up to MAX_LIGHTS registered lamps (rain only really shows where light catches it).
// Materials are built once and their uniforms mutated in place — never pass `uniforms` as a JSX prop (R3F copies it).

const MAX_LIGHTS = 4

const LIGHTS_GLSL = /* glsl */ `
  uniform vec3 uLightPos[${MAX_LIGHTS}]; uniform vec3 uLightCol[${MAX_LIGHTS}];
  vec3 lampLight(vec3 p) {
    vec3 c = vec3(0.07, 0.085, 0.11);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) { vec3 d = p - uLightPos[i]; c += uLightCol[i] / (1.0 + dot(d, d) * 0.12); }
    return c;
  }`

const streakVert = /* glsl */ `
  uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform float uLen; uniform vec2 uWind;
  ${LIGHTS_GLSL}
  attribute vec3 aSeed; attribute float aEnd;
  varying vec3 vCol; varying float vA;
  void main() {
    float speed = 11.0 + aSeed.z * 4.0;
    vec3 p = aSeed * uBox;
    p.y -= uTime * speed;
    p.xz += uWind * uTime * speed * 0.12;
    vec3 origin = vec3(uCam.x - uBox.x * 0.5, uCam.y - uBox.y * 0.45, uCam.z - uBox.z * 0.5);
    p = origin + mod(p - origin, uBox);
    vec3 dir = normalize(vec3(-uWind.x * 0.12, 1.0, -uWind.y * 0.12));
    p += dir * uLen * (0.7 + aSeed.x * 0.6) * aEnd; // motion-blurred streak
    float dist = distance(p, uCam);
    vA = smoothstep(0.3, 1.2, dist) * exp(-dist * 0.05) * (0.35 + aEnd * 0.65);
    vCol = lampLight(p);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`

const streakFrag = /* glsl */ `
  varying vec3 vCol; varying float vA;
  void main() { gl_FragColor = vec4(vCol * vA * 1.6, vA); }`

const splashVert = /* glsl */ `
  uniform float uTime; uniform vec3 uCam; uniform float uRadius; uniform float uPx;
  ${LIGHTS_GLSL}
  attribute vec3 aSeed;
  varying float vPhase; varying vec3 vCol; varying float vFade;
  float h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  void main() {
    float rate = 1.6 + aSeed.z * 1.8;
    float cyc = uTime * rate + aSeed.x * 10.0;
    float k = floor(cyc);
    vPhase = fract(cyc);
    // new random spot every cycle, on a disc around the camera's feet
    float a = h(k + aSeed.y * 91.0) * 6.2832, r = sqrt(h(k * 1.7 + aSeed.x * 37.0)) * uRadius;
    vec3 p = vec3(uCam.x + cos(a) * r, 0.0, uCam.z + sin(a) * r);
    p.y = GROUND + 0.02;
    vCol = lampLight(p);
    float dist = distance(p, uCam);
    vFade = exp(-dist * 0.12);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_PointSize = uPx * (0.4 + vPhase) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`

const splashFrag = /* glsl */ `
  varying float vPhase; varying vec3 vCol; varying float vFade;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    q.y *= 2.6; // flattened onto the ground
    float d = length(q);
    float ring = smoothstep(0.12, 0.0, abs(d - vPhase * 0.9)) * (1.0 - vPhase);
    float crown = smoothstep(0.35, 0.0, d) * smoothstep(0.25, 0.0, vPhase); // the initial hit
    float a = (ring * 0.9 + crown) * vFade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vCol * a * 1.8, a);
  }`

interface Props {
  count?: number
  splashes?: number
  box?: [number, number, number]
  wind?: [number, number]
  /** GLSL expression for ground height at vec3 p (e.g. a road ramp). */
  ground?: string
}

export function RainSystem({ count = 9000, splashes = 700, box = [30, 14, 36], wind = [0.6, 0.2], ground = '0.0' }: Props) {
  const camera = useThree((s) => s.camera)
  const lights = useMemo(
    () => ({
      uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -999, 0)) },
      uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
    }),
    [],
  )

  const streaks = useMemo(() => {
    const rand = rng(42)
    const seed = new Float32Array(count * 6)
    const end = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const s = [rand(), rand(), rand()]
      seed.set(s, i * 6)
      seed.set(s, i * 6 + 3)
      end[i * 2 + 1] = 1
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    const m = new THREE.ShaderMaterial({
      vertexShader: streakVert, fragmentShader: streakFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...box) }, uLen: { value: 0.7 }, uWind: { value: new THREE.Vector2(...wind) }, ...lights },
    })
    return { g, m }
  }, [count, box, wind, lights])

  const splash = useMemo(() => {
    const rand = rng(77)
    const seed = new Float32Array(splashes * 3).map(() => rand())
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(splashes * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    const m = new THREE.ShaderMaterial({
      vertexShader: splashVert.replace('GROUND', `(${ground})`), fragmentShader: splashFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uRadius: { value: 14 }, uPx: { value: 260 }, ...lights },
    })
    return { g, m }
  }, [splashes, ground, lights])

  useFrame(({ size, viewport }) => {
    streaks.m.uniforms.uTime.value = splash.m.uniforms.uTime.value = clock.t
    streaks.m.uniforms.uCam.value.copy(camera.position)
    splash.m.uniforms.uCam.value.copy(camera.position)
    splash.m.uniforms.uPx.value = 0.12 * size.height * viewport.dpr
    let i = 0
    for (const l of lightRegistry.values()) {
      if (i === MAX_LIGHTS) break
      lights.uLightPos.value[i].copy(l.position)
      lights.uLightCol.value[i].set(l.color.r, l.color.g, l.color.b).multiplyScalar(l.level * 1.1)
      i++
    }
  })

  return (
    <>
      <lineSegments geometry={streaks.g} material={streaks.m} frustumCulled={false} renderOrder={3} />
      <points geometry={splash.g} material={splash.m} frustumCulled={false} renderOrder={3} />
    </>
  )
}
