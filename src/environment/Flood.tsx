import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import type { EnvironmentEffect } from '../cinematic/types'

type Fx = Extract<EnvironmentEffect, { type: 'flood' }>

const vertexShader = /* glsl */ `
  uniform float uTime; uniform float uAmplitude;
  varying float vWave; varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float w = sin(p.x * 0.32 + uTime * 1.5) * 0.55 + sin(p.y * 0.55 - uTime * 1.1) * 0.45;
    p.z += w * uAmplitude;
    vWave = w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vWave; varying vec2 vUv;
  void main() {
    float foam = smoothstep(0.55, 1.0, vWave) * 0.35;
    vec3 color = uColor * (0.75 + vWave * 0.2) + foam;
    gl_FragColor = vec4(color, 0.88);
  }`

/** Rising wave surface. Water arrives over `duration` seconds and then remains for the scene. */
export function Flood({ fx }: { fx: Fx }) {
  const water = useRef<THREE.Mesh>(null!)
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAmplitude: { value: 0.12 * fx.intensity }, uColor: { value: new THREE.Color(fx.color ?? '#182c33') } },
  }), [fx.intensity, fx.color])

  useFrame(() => {
    const local = clock.t - fx.at
    water.current.visible = local >= 0
    if (local < 0) return
    const ease = Math.min(1, Math.max(0, local / fx.duration))
    water.current.position.y = fx.level * (ease * ease * (3 - 2 * ease))
    material.uniforms.uTime.value = clock.t
  })

  return (
    <mesh ref={water} rotation-x={-Math.PI / 2} position={[0, 0, 0]} material={material} visible={false} frustumCulled={false}>
      <planeGeometry args={[160, 160, 48, 48]} />
    </mesh>
  )
}
