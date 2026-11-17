import { useEffect, useMemo, useRef } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlide } from './useGlide'
import { clock } from '../cinematic/clock'
import { hash } from '../utils/random'
import { sari } from '../utils/textures'
import type { Vec3 } from '../cinematic/types'
import { createFacialFeatures, applyExpression } from '../characters/face.ts'

// The woman from the crossing. Canon: docs/bible/entity.md — read it before changing her.
// Built from primitives on purpose: she is never shown in full, so silhouette, stillness and feet carry her.
// Faces +z. Height 1.84 m — a little too tall. Arms hang ~10 cm too low. Feet point backward.

const HEIGHT = 1.84

function bodyGeometry() {
  // Lathe profile from hem to neck: [radius, height].
  const prof: [number, number][] = [
    [0.2, 0.06], [0.215, 0.09], [0.205, 0.2], [0.19, 0.45], [0.175, 0.7], [0.16, 0.92],
    [0.145, 1.02], [0.155, 1.12], [0.175, 1.26], [0.17, 1.36], [0.13, 1.44], [0.055, 1.5], [0.045, 1.55],
  ]
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const a = Math.atan2(z, x)
    // Pleats in front below the waist, flattened torso, wet cloth clinging.
    const pleat = y < 1.0 && z > 0 ? Math.sin(a * 18) * 0.007 * (1 - y) : 0
    const s = 1 + pleat / Math.max(0.05, Math.hypot(x, z))
    p.setXYZ(i, x * s, y, z * s * 0.72)
  }
  g.computeVertexNormals()
  return g
}

function foot() {
  // Heel at +z (toward the viewer), toes trailing behind at -z.
  const g = new THREE.SphereGeometry(0.05, 12, 8)
  g.scale(0.85, 0.55, 2.3)
  g.translate(0, 0.025, -0.05)
  const toes = Array.from({ length: 5 }, (_, i) => {
    const t = new THREE.SphereGeometry(1, 8, 6)
    const r = 0.015 - i * 0.0015
    t.scale(r, r * 0.7, r * 1.15)
    t.translate(-0.031 + i * 0.015, 0.023, -0.11 - r)
    return t
  })
  return mergeGeometries([g, ...toes])
}

interface Props {
  id: string
  /** Default position when cues don't give one. */
  position?: Vec3
  rotationY?: number
  /** Projected mirror image, not a live render-target reflection. */
  reflection?: boolean
  surfaceAt?: (x: number, z: number) => number
}

export function Entity({ id, position = [0, 0, 0], rotationY = 0, reflection = false, surfaceAt }: Props) {
  const { state, root, update } = useGlide(id, position, rotationY)
  const head = useRef<THREE.Group>(null!)
  const face = useMemo(createFacialFeatures, [])
  useEffect(() => () => face.dispose(), [face])
  const geo = useMemo(() => ({ body: bodyGeometry(), foot: foot() }), [])
  const mats = useMemo(() => {
    const optical = (material: THREE.MeshStandardMaterial) => {
      if (reflection) { material.transparent = true; material.opacity = 0.32; material.depthWrite = false }
      return material
    }
    const cloth = optical(new THREE.MeshStandardMaterial({ map: sari(), roughness: 0.92 }))
    return {
      cloth,
      skin: optical(new THREE.MeshStandardMaterial({ color: '#6d5445', roughness: 0.72 })),
      hair: optical(new THREE.MeshStandardMaterial({ color: '#030303', roughness: 0.28, metalness: 0.1 })),
    }
  }, [reflection])

  useFrame(() => {
    if (!state?.visible) return
    update(0.2) // she glides: no steps, no limbs moving
    if (surfaceAt) root.current.position.y = surfaceAt(root.current.position.x, root.current.position.z) + 0.003
    applyExpression(face, state?.smile ? 'trust' : 'tired')
    face.group.visible = !!(state?.face || state?.smile)
    face.eyes.forEach(eye => { eye.visible = !!state?.face })
    face.brows.forEach(brow => { brow.visible = !!state?.face })
    // Shadow-only: her body is gone but her shadow is still on the road.
    for (const m of Object.values(mats)) m.colorWrite = m.depthWrite = !state.shadowOnly
    // Head tilts slowly toward its target; every few seconds a sub-degree snap that's hard to be sure you saw.
    const snap = hash(Math.floor(clock.t * 0.7) + 11) > 0.93 ? 0.015 : 0
    head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, (state.tilt ?? 0) + snap, 0.015)
  })

  return (
    <group name={id} ref={root} position={position} rotation-y={rotationY} visible={!!state?.visible} scale={reflection ? 0.62 : HEIGHT / 1.84}>
      <mesh geometry={geo.body} material={mats.cloth} castShadow />
      {/* Pallu: the loose end draped over the head and down the back. */}
      <mesh position={[0, 1.62, -0.045]} scale={[0.96, 0.88, 0.95]} material={mats.cloth} castShadow>
        <sphereGeometry args={[0.14, 20, 12, Math.PI * 0.68, Math.PI * 0.64, 0, 1.93]} />
      </mesh>
      <mesh position={[0.02, 1.2, -0.11]} rotation={[0.08, 0, 0.04]} material={mats.cloth} castShadow>
        <cylinderGeometry args={[0.13, 0.19, 0.85, 16, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
      </mesh>
      <group ref={head} position={[0, 1.6, 0]}>
        {!state?.face && <mesh position={[0, -0.17, 0.085]} rotation={[0.06, 0, 0]} material={mats.hair} castShadow>
          <cylinderGeometry args={[0.1, 0.085, 0.42, 14, 1, true, -Math.PI * 0.45, Math.PI * 0.9]} />
        </mesh>}
        <mesh position={[0, 0.02, -0.012]} scale={[0.97, 1.1, 1.06]} material={mats.hair}>
          <sphereGeometry args={[0.108, 16, 12, state?.face ? Math.PI : 0, Math.PI * (state?.face ? 1 : 2), 0, 1.6]} />
        </mesh>
        <primitive object={face.group} position={[0, -0.06, 0.015]} />
        <mesh scale={[0.9, 1.12, 1]} material={mats.skin}>
          <sphereGeometry args={[0.105, 16, 12]} />
        </mesh>
        <group visible={!!state?.face}>
          {[-0.075, -0.046, 0.049, 0.076].map((x, i) => <mesh key={x} position={[x, -0.11 - (i % 2) * 0.025, 0.103]} rotation-z={(i - 1.5) * 0.025} material={mats.hair}>
            <cylinderGeometry args={[0.006 + (i % 2) * 0.004, 0.005, 0.28 + (i % 2) * 0.09, 8, 1, true]} />
          </mesh>)}
          {[-1, 1].map(side => <mesh key={side} position={[side * 0.087, -0.12, 0.026]} rotation-z={side * 0.07} material={mats.hair}>
            <cylinderGeometry args={[0.026, 0.021, 0.38, 10, 1, true]} />
          </mesh>)}
          <mesh position={[0, -0.011, 0.104]} rotation-x={Math.PI / 2} material={mats.skin}>
            <coneGeometry args={[0.012, 0.036, 8]} />
          </mesh>
        </group>
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.2, 1.06, 0.01]} rotation={[0, 0, side * 0.06]} material={mats.skin} castShadow>
            <capsuleGeometry args={[0.032, 0.66, 4, 8]} />
          </mesh>
          {/* Long fingers. */}
          <mesh position={[side * 0.225, 0.66, 0.01]} scale={[0.6, 1.9, 0.9]} material={mats.skin}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
          <mesh geometry={geo.foot} position={[side * 0.075, 0, 0.02]} rotation-y={(state?.feetForward ? Math.PI : 0) + side * 0.12} material={mats.skin} castShadow />
        </group>
      ))}
    </group>
  )
}
