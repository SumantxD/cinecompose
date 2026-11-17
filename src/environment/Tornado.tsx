import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import { rng } from '../utils/random'
import { useStore } from '../state/store'
import type { EnvironmentEffect } from '../cinematic/types'
import { effectEnvelope } from './EnvironmentEffects'

type Fx = Extract<EnvironmentEffect, { type: 'tornado' }>

const vertexShader = /* glsl */ `
  uniform float uTime; uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float a = uTime * uSpeed + p.y * 0.32;
    float c = cos(a), s = sin(a);
    p.xz = mat2(c, -s, s, c) * p.xz;
    p.x += sin(p.y * 0.55 + uTime * 1.4) * 0.45 * p.y / 12.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`

const fragmentShader = /* glsl */ `
  uniform float uTime; uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float bands = sin(vUv.y * 42.0 - uTime * 5.0 + sin(vUv.x * 28.0) * 2.5) * 0.5 + 0.5;
    float streaks = sin(vUv.x * 80.0 + vUv.y * 12.0 - uTime * 3.0) * 0.5 + 0.5;
    float shade = bands * 0.65 + streaks * 0.35;
    vec3 color = mix(vec3(0.055, 0.06, 0.065), vec3(0.24, 0.25, 0.25), shade);
    float alpha = (0.3 + shade * 0.45) * uOpacity * (0.5 + vUv.y * 0.5);
    gl_FragColor = vec4(color, alpha);
  }`

/** Procedural funnel + orbiting debris. Not a fluid simulation: an authored cinematic set piece. */
export function Tornado({ fx }: { fx: Fx }) {
  const low = useStore((s) => s.quality === 'low')
  const radius = fx.radius ?? 2.4, height = fx.height ?? 15
  const group = useRef<THREE.Group>(null!)
  const debris = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = low ? 110 : 200
  const seeds = useMemo(() => {
    const random = rng(fx.seed ?? 19)
    return Array.from({ length: count }, () => ({ angle: random() * Math.PI * 2, r: 0.7 + random() * 0.7, y: random(), spin: random() * 4, size: 0.05 + random() * 0.18 }))
  }, [count, fx.seed])
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uSpeed: { value: 1.6 + fx.intensity }, uOpacity: { value: 0 } },
  }), [])

  useFrame(() => {
    const t = clock.t
    const envelope = effectEnvelope(fx, t)
    group.current.visible = envelope > 0.002
    if (!group.current.visible) return
    material.uniforms.uTime.value = t
    material.uniforms.uSpeed.value = 1.6 + fx.intensity
    material.uniforms.uOpacity.value = Math.min(1, envelope * (0.55 + fx.intensity * 0.35))
    group.current.scale.setScalar(0.55 + envelope * 0.45)
    for (let i = 0; i < count; i++) {
      const seed = seeds[i]
      const y = (seed.y * height + t * (0.7 + fx.intensity * 0.4)) % height
      const r = radius * seed.r * (0.35 + (y / height) * 1.4)
      const a = seed.angle + t * (1.8 + fx.intensity * 0.9) + y * 0.3
      dummy.position.set(Math.cos(a) * r, y + 0.15, Math.sin(a) * r)
      dummy.rotation.set(t * seed.spin, a, t * seed.spin * 0.7)
      dummy.scale.setScalar(seed.size)
      dummy.updateMatrix()
      debris.current.setMatrixAt(i, dummy.matrix)
    }
    debris.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={group} position={fx.position} visible={false}>
      <mesh position={[0, height / 2, 0]} material={material} frustumCulled={false}>
        <cylinderGeometry args={[radius * 1.9, radius * 0.28, height, 48, 20, true]} />
      </mesh>
      <instancedMesh ref={debris} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 0.35, 0.5]} />
        <meshStandardMaterial color="#4b4033" roughness={0.95} />
      </instancedMesh>
    </group>
  )
}
