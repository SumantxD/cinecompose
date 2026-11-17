import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import type { EnvironmentEffect } from '../cinematic/types'
import { effectEnvelope } from './EnvironmentEffects'

type Fx = Extract<EnvironmentEffect, { type: 'earthquake' }>

// Deterministic multi-sine rumble, not Math.random or wall time.
const shake = (t: number, seed: number) => Math.sin(t * 1.9 + seed) * 0.55 + Math.sin(t * 4.7 + seed * 2.3) * 0.3 + Math.sin(t * 11.3 + seed * 0.7) * 0.15

/** Camera rumble applied after the camera controller, with the previous offset removed first (no drift). */
export function Earthquake({ effects }: { effects: Fx[] }) {
  const camera = useThree((s) => s.camera)
  const previous = useRef(new THREE.Vector3())
  const previousRoll = useRef(0)

  useEffect(() => () => {
    camera.position.sub(previous.current)
    camera.rotation.z -= previousRoll.current
  }, [camera])

  useFrame(() => {
    camera.position.sub(previous.current)
    camera.rotation.z -= previousRoll.current
    previous.current.set(0, 0, 0)
    previousRoll.current = 0

    for (const fx of effects) {
      const envelope = effectEnvelope(fx, clock.t)
      if (envelope <= 0) continue
      const t = clock.t * (fx.frequency ?? 10)
      const amp = envelope * fx.intensity * 0.045
      previous.current.set(shake(t, 3.1) * amp, shake(t, 17.7) * amp * 0.65, shake(t, 29.3) * amp * 0.4)
      previousRoll.current = shake(t * 0.65, 8.9) * amp * 0.055
    }
    camera.position.add(previous.current)
    camera.rotation.z += previousRoll.current
  }, 1)

  return null
}
