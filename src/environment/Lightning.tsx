import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import { rng } from '../utils/random'
import type { EnvironmentEffect } from '../cinematic/types'
import { effectEnvelope } from './EnvironmentEffects'

type Fx = Extract<EnvironmentEffect, { type: 'lightning' }>

function boltGeometry(seed: number) {
  const random = rng(seed)
  const points: number[] = []
  let x = 0, z = 0
  for (let i = 0; i < 16; i++) {
    const y0 = 15 - i * (15 / 16), y1 = 15 - (i + 1) * (15 / 16)
    const nx = x + (random() - 0.5) * 1.1
    const nz = z + (random() - 0.5) * 1.1
    points.push(x, y0, z, nx, y1, nz)
    if (i > 3 && random() > 0.55) {
      // A short fork off the main channel.
      const bx = nx + (random() - 0.5) * 3.2, bz = nz + (random() - 0.5) * 3.2
      points.push(nx, y1, nz, bx, y1 - 1.1 - random() * 1.4, bz)
    }
    x = nx; z = nz
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geometry
}

/** Seeded branching bolts, a local flash and a sky-wide pulse. Timing is entirely clock.t. */
export function Lightning({ fx }: { fx: Fx }) {
  const origin = fx.position ?? [0, 0, -24]
  const strikes = useMemo(() => {
    const random = rng(fx.seed ?? 7)
    const out: { at: number; variant: number }[] = []
    for (let t = 0; t < fx.duration; t += 0.55 + random() * 1.7) out.push({ at: fx.at + t, variant: Math.floor(random() * 3) })
    return out
  }, [fx.at, fx.duration, fx.seed])
  const bolts = useMemo(() => [0, 1, 2].map((i) => boltGeometry((fx.seed ?? 7) * 31 + i * 977)), [fx.seed])
  const point = useRef<THREE.PointLight>(null!)
  const sky = useRef<THREE.DirectionalLight>(null!)
  const lines = useRef<(THREE.LineSegments | null)[]>([])

  useFrame(() => {
    const t = clock.t
    const active = effectEnvelope(fx, t) > 0
    let flash = 0, variant = -1
    if (active) {
      for (const strike of strikes) {
        const d = t - strike.at
        if (d < 0 || d > 0.42) continue
        // Two-pulse flash: a hard first hit, then a weaker return stroke.
        const envelope = Math.exp(-d * 16) + (d > 0.11 ? Math.exp(-(d - 0.11) * 20) * 0.65 : 0)
        if (envelope > flash) { flash = envelope; variant = strike.variant }
      }
    }
    const energy = flash * fx.intensity
    point.current.intensity = energy * 1400
    sky.current.intensity = energy * 2.4
    lines.current.forEach((line, i) => {
      if (!line) return
      line.visible = i === variant && flash > 0.12
      ;(line.material as THREE.LineBasicMaterial).opacity = Math.min(1, flash * 1.6)
    })
  })

  return (
    <group>
      <pointLight ref={point} position={[origin[0], 11, origin[2]]} color="#c7dcff" intensity={0} distance={90} decay={1.4} />
      <directionalLight ref={sky} position={[origin[0] - 8, 24, origin[2] - 12]} color="#b8ceff" intensity={0} />
      {bolts.map((geometry, i) => (
        <lineSegments key={i} ref={(node) => { lines.current[i] = node }} geometry={geometry} position={origin} visible={false} frustumCulled={false}>
          <lineBasicMaterial color="#dceaff" transparent opacity={0} toneMapped={false} />
        </lineSegments>
      ))}
    </group>
  )
}
