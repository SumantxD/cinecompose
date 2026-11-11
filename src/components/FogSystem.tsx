import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'

const vertexShader = /* glsl */ `
  varying vec2 vUv; varying vec3 vWorld;
  void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`

const fragmentShader = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uSeed; uniform vec3 uGlowPos; uniform vec3 uGlowCol;
  varying vec2 vUv; varying vec3 vWorld;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec2 p = vUv * vec2(6.0, 1.5) + vec2(uTime * 0.025 + uSeed, uSeed * 0.3);
    float m = fbm(p + fbm(p * 0.7 - uTime * 0.01));
    float edge = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y)) * smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
    float a = smoothstep(0.35, 0.8, m) * edge * uOpacity;
    vec3 d = vWorld - uGlowPos;
    vec3 c = uColor + uGlowCol / (1.0 + dot(d, d) * 0.04);
    gl_FragColor = vec4(c, a);
  }`

interface Sheet { z: number; y: number; w: number; h: number; opacity: number }

/**
 * Atmosphere: exponential fog, a sky whose horizon IS the fog colour (so distance dissolves into haze —
 * atmospheric perspective layers silhouettes), and slow mist sheets that separate depth planes.
 */
export function FogSystem({ color = '#0c1117', density = 0.03, sheets = [] as Sheet[], glowPos = [0, -99, 0] as [number, number, number], glowColor = '#000000' }) {
  const scene = useThree((s) => s.scene)
  useMemo(() => {
    scene.fog = new THREE.FogExp2(color, density)
    scene.background = new THREE.Color(color)
  }, [scene, color, density])

  const mats = useMemo(
    () =>
      sheets.map((s, i) => new THREE.ShaderMaterial({
        vertexShader, fragmentShader, transparent: true, depthWrite: false,
        uniforms: {
          uTime: { value: 0 }, uColor: { value: new THREE.Color('#29333d') }, uOpacity: { value: s.opacity }, uSeed: { value: i * 3.7 },
          uGlowPos: { value: new THREE.Vector3(...glowPos) }, uGlowCol: { value: new THREE.Color(glowColor).multiplyScalar(0.3) },
        },
      })),
    [sheets, glowPos, glowColor],
  )

  const sky = useMemo(
    () => new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uHorizon: { value: new THREE.Color(color) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      // Low monsoon cloud, faintly lit from below at the horizon, near-black overhead.
      fragmentShader: `uniform vec3 uHorizon; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uHorizon, uHorizon * 0.75, pow(h, 0.7)), 1.0); }`,
    }),
    [color],
  )

  useFrame(() => mats.forEach((m) => (m.uniforms.uTime.value = clock.t)))

  return (
    <>
      <mesh material={sky} renderOrder={-1}>
        <sphereGeometry args={[400, 32, 16]} />
      </mesh>
      {sheets.map((s, i) => (
        <mesh key={i} position={[0, s.y, s.z]} material={mats[i]} renderOrder={1}>
          <planeGeometry args={[s.w, s.h]} />
        </mesh>
      ))}
    </>
  )
}
