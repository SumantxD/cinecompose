import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import type { GroundMistConfig, Vec3 } from '../cinematic/types'

const vertexShader = /* glsl */ `
  varying vec2 vUv; varying vec3 vWorld;
  void main() { vUv = uv; vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }
`
const fragmentShader = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform float uPhase;
  uniform vec3 uColor; uniform vec3 uGlowPosition; uniform vec3 uGlowColor;
  varying vec2 vUv; varying vec3 vWorld;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float cloud(vec2 p) { return n(p) * 0.5 + n(p * 2.07) * 0.25 + n(p * 4.13) * 0.125; }
  void main() {
    vec2 p = vUv * vec2(5.0, 8.0) + vec2(uTime * 0.035, -uTime * 0.021) + uPhase;
    float m = cloud(p + cloud(p * 0.65) * 1.4);
    float edge = smoothstep(0.0, 0.2, min(vUv.x, 1.0 - vUv.x)) * smoothstep(0.0, 0.22, min(vUv.y, 1.0 - vUv.y));
    float alpha = smoothstep(0.35, 0.72, m) * edge * uOpacity;
    vec3 d = vWorld - uGlowPosition;
    vec3 color = uColor + uGlowColor / (1.0 + dot(d, d) * 0.04);
    gl_FragColor = vec4(color, alpha);
  }
`

export function GroundMist({ config, surfaceAt, lamps, layers = 3 }: { config: GroundMistConfig; surfaceAt: (x: number, z: number) => number; lamps: Vec3[]; layers?: number }) {
  const [cx, , cz] = config.center
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(config.width, config.length, Math.ceil(config.width), Math.ceil(config.length * 1.5))
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setY(i, surfaceAt(cx + p.getX(i), cz + p.getZ(i)) + 0.045)
    g.computeBoundingSphere()
    return g
  }, [config.width, config.length, cx, cz, surfaceAt])
  const materials = useMemo(() => Array.from({ length: layers }, (_, i) => {
    const color = i % 2 ? '#9b806a' : '#708394'
    return new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uOpacity: { value: (config.opacity ?? 0.085) * (1 - i * 0.24) }, uPhase: { value: i * 4.7 },
        uColor: { value: new THREE.Color(color).multiplyScalar(0.42) },
        uGlowPosition: { value: new THREE.Vector3(...(lamps[Math.min(i, lamps.length - 1)] ?? [0, 3, 0])) },
        uGlowColor: { value: new THREE.Color('#c7c7bf').multiplyScalar(0.12) },
      },
    })
  }), [config.opacity, layers, lamps])
  useFrame(() => materials.forEach(material => { material.uniforms.uTime.value = clock.t }))
  useEffect(() => () => { geometry.dispose(); materials.forEach(material => material.dispose()) }, [geometry, materials])
  const step = ((config.height ?? 0.3) - 0.045) / Math.max(1, layers - 1)
  return <group name='ground_mist' position={[cx, 0, cz]} renderOrder={1}>
    {materials.map((material, i) => <mesh key={i} geometry={geometry} material={material} position-y={i * step} receiveShadow={false} />)}
  </group>
}
