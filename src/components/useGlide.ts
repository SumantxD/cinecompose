import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { clock } from '../cinematic/clock'
import type { Vec3 } from '../cinematic/types'

/**
 * Moves anything cue-driven (entity, actor, vehicle) by store state: teleport (speed 0) or glide from `from` /
 * its current spot to `position` at `speed` m/s, deterministic on clock.t. Faces travel direction unless
 * `rotationY` is given (then turns toward it). Call `update()` each frame; it reports distance covered.
 */
export function useGlide(id: string, position: Vec3, rotationY = 0) {
  const state = useStore((s) => s.entities[id])
  const root = useRef<THREE.Group>(null!)
  const from = useRef(new THREE.Vector3(...position))
  const step = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (state?.from) from.current.set(...state.from)
    else if (root.current) from.current.copy(root.current.position)
  }, [state?.since, state?.from])

  const update = (turnRate = 0.12) => {
    const g = root.current
    const target = state?.position ?? position
    let moving = false, travelled = 0
    if (state?.speed) {
      step.set(...target).sub(from.current)
      const len = step.length()
      travelled = Math.min(len, Math.max(0, clock.t - (state.since ?? 0)) * state.speed)
      g.position.copy(from.current).addScaledVector(step, len ? travelled / len : 0)
      moving = travelled < len - 1e-3
    } else g.position.set(...target)
    const want = state?.rotationY ?? (moving && step.lengthSq() > 1e-6 ? Math.atan2(step.x, step.z) : undefined)
    if (want !== undefined) {
      // shortest-path turn
      const d = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y))
      g.rotation.y += Math.abs(d) < 0.002 ? d : d * turnRate
    }
    return { moving, travelled }
  }

  return { state, root, update, initialRotation: rotationY }
}
