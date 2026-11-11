import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import { useGlide } from './useGlide'
import { AudioManager } from '../audio/AudioManager'
import type { Vec3 } from '../cinematic/types'

// A person on screen (Aarav, the driver). Procedural, rigged by nested pivots, animated in code:
// walk is distance-driven (feet don't slide), idle breathes, sit folds the legs. Faces +z at rotation 0.
// ponytail: primitive-built figure read mostly in silhouette at night — upgrade path is a CC0 rigged GLB
// (same pivot names) once the team picks one; cues and scenes stay unchanged.

const STRIDE = 1.25 // metres per full cycle (two steps)

interface Look {
  jacket: string
  trousers: string
  skin: string
  hair: string
}

const AARAV: Look = { jacket: '#2b2a26', trousers: '#1b1c20', skin: '#4e3a2e', hair: '#080808' }

/** `steps`: sound played at each foot contact, at his position (footsteps always match the walk). */
export function Actor({ id, position = [0, 0, 0], rotationY = 0, look = AARAV, height = 1.74, steps = 'footstep' }: { id: string; position?: Vec3; rotationY?: number; look?: Look; height?: number; steps?: string }) {
  const { state, root, update } = useGlide(id, position, rotationY)
  const j = {
    hips: useRef<THREE.Group>(null!), chest: useRef<THREE.Group>(null!), head: useRef<THREE.Group>(null!),
    lThigh: useRef<THREE.Group>(null!), rThigh: useRef<THREE.Group>(null!), lKnee: useRef<THREE.Group>(null!), rKnee: useRef<THREE.Group>(null!),
    lArm: useRef<THREE.Group>(null!), rArm: useRef<THREE.Group>(null!), lElbow: useRef<THREE.Group>(null!), rElbow: useRef<THREE.Group>(null!),
  }
  const m = useMemo(() => ({
    jacket: new THREE.MeshStandardMaterial({ color: look.jacket, roughness: 0.85 }),
    trousers: new THREE.MeshStandardMaterial({ color: look.trousers, roughness: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.6 }),
    hair: new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.35 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.4 }),
  }), [look])
  const torso = useMemo(() => {
    const prof: [number, number][] = [[0.15, 0], [0.165, 0.12], [0.175, 0.3], [0.19, 0.42], [0.2, 0.5], [0.13, 0.56], [0.05, 0.6]]
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24)
    g.scale(1, 1, 0.62)
    return g
  }, [])
  const startRot = useRef(true)
  const lastStep = useRef(0)

  useFrame(() => {
    if (startRot.current) {
      root.current.rotation.y = state?.rotationY ?? rotationY
      startRot.current = false
    }
    const { moving, travelled } = update()
    const anim = state?.anim ?? (moving ? 'walk' : 'idle')
    const ph = (travelled / STRIDE) * Math.PI * 2
    const step = Math.floor(ph / Math.PI + 0.25)
    if (moving && step !== lastStep.current) {
      const p = root.current.position
      AudioManager.sfx(steps, 0.55 + 0.1 * Math.sin(step * 2.3), [p.x, 0.1, p.z], 0.92 + 0.08 * Math.sin(step * 1.7))
    }
    lastStep.current = moving ? step : 0
    const s = Math.sin(ph), c = Math.cos(ph)
    const breathe = Math.sin(clock.t * 1.6) * 0.012
    const ease = (r: { current: THREE.Group }, x: number, k = 0.25) => (r.current.rotation.x += (x - r.current.rotation.x) * k)

    if (anim === 'walk' && moving) {
      j.hips.current.position.y = 0.94 + Math.abs(c) * 0.035 - 0.02
      ease(j.lThigh, 0.42 * s, 1); ease(j.rThigh, -0.42 * s, 1)
      // knee folds during the swing (leg moving forward), nearly straight on contact
      ease(j.lKnee, 0.08 + 0.75 * Math.max(0, Math.sin(ph + 1.9)), 1)
      ease(j.rKnee, 0.08 + 0.75 * Math.max(0, Math.sin(ph + 1.9 + Math.PI)), 1)
      ease(j.lArm, -0.3 * s, 1); ease(j.rArm, 0.3 * s, 1)
      ease(j.lElbow, -0.25 - 0.15 * Math.max(0, -s), 1); ease(j.rElbow, -0.25 - 0.15 * Math.max(0, s), 1)
      j.chest.current.rotation.y = 0.06 * s
      j.chest.current.rotation.x = 0.07 // head down, shoulders in — rain, fear
    } else if (anim === 'sit') {
      j.hips.current.position.y = 0.52
      ease(j.lThigh, -1.45); ease(j.rThigh, -1.45); ease(j.lKnee, 1.45); ease(j.rKnee, 1.45)
      ease(j.lArm, -0.55); ease(j.rArm, -0.55); ease(j.lElbow, -0.9); ease(j.rElbow, -0.9)
      j.chest.current.rotation.x = 0.04 + breathe
    } else {
      j.hips.current.position.y += (0.94 - j.hips.current.position.y) * 0.2
      for (const r of [j.lThigh, j.rThigh, j.lKnee, j.rKnee]) ease(r, 0.02, 0.15)
      ease(j.lArm, 0.04, 0.15); ease(j.rArm, 0.04, 0.15); ease(j.lElbow, -0.12, 0.15); ease(j.rElbow, -0.12, 0.15)
      j.chest.current.rotation.x = 0.05 + breathe
      j.chest.current.rotation.y *= 0.9
    }
    // Head turns independently (toward a sound, a door, behind him).
    j.head.current.rotation.y += ((state?.headYaw ?? 0) - j.head.current.rotation.y) * 0.08
  })

  const scale = height / 1.74
  // Limb helper: a capsule hanging down from its pivot.
  const limb = (r: number, len: number, mat: THREE.Material) => (
    <mesh position={[0, -len / 2, 0]} material={mat} castShadow receiveShadow>
      <capsuleGeometry args={[r, len - 2 * r, 4, 10]} />
    </mesh>
  )

  return (
    <group ref={root} position={position} visible={!!state?.visible} scale={scale}>
      <group ref={j.hips} position={[0, 0.94, 0]}>
        {/* pelvis */}
        <mesh position={[0, 0.02, 0]} scale={[1, 0.7, 0.68]} material={m.trousers} castShadow>
          <sphereGeometry args={[0.16, 14, 10]} />
        </mesh>
        {([-1, 1] as const).map((side) => (
          <group key={side} ref={side < 0 ? j.lThigh : j.rThigh} position={[side * 0.09, 0, 0]}>
            {limb(0.068, 0.45, m.trousers)}
            <group ref={side < 0 ? j.lKnee : j.rKnee} position={[0, -0.45, 0]}>
              {limb(0.052, 0.44, m.trousers)}
              <mesh position={[0, -0.47, 0.05]} scale={[0.9, 0.55, 2.4]} material={m.shoe} castShadow>
                <sphereGeometry args={[0.055, 10, 8]} />
              </mesh>
            </group>
          </group>
        ))}
        <group ref={j.chest} position={[0, 0.04, 0]}>
          <mesh geometry={torso} material={m.jacket} castShadow receiveShadow />
          {/* raised collar against the rain */}
          <mesh position={[0, 0.575, -0.01]} scale={[1, 1, 0.8]} material={m.jacket} castShadow>
            <cylinderGeometry args={[0.075, 0.1, 0.09, 14, 1, true]} />
          </mesh>
          {/* jhola: cloth shoulder bag on a strap across the chest */}
          <mesh position={[0.02, 0.32, 0.005]} rotation-z={-0.75} scale={[1, 1, 0.66]}>
            <torusGeometry args={[0.24, 0.012, 4, 24, Math.PI * 0.62]} />
            <meshStandardMaterial color="#3b3024" roughness={0.9} />
          </mesh>
          <mesh position={[-0.2, 0.05, 0.02]} rotation-z={0.08} castShadow>
            <boxGeometry args={[0.07, 0.3, 0.26]} />
            <meshStandardMaterial color="#3b3024" roughness={0.95} />
          </mesh>
          <group ref={j.head} position={[0, 0.64, 0.01]}>
            <mesh position={[0, 0.06, 0]} scale={[0.86, 1.08, 1]} material={m.skin} castShadow>
              <sphereGeometry args={[0.1, 16, 12]} />
            </mesh>
            <mesh position={[0, 0.1, -0.012]} scale={[0.92, 0.95, 1.05]} material={m.hair} castShadow>
              <sphereGeometry args={[0.104, 16, 10, 0, Math.PI * 2, 0, 1.75]} />
            </mesh>
            <mesh position={[0, -0.045, 0]} material={m.skin}>
              <cylinderGeometry args={[0.045, 0.05, 0.09, 10]} />
            </mesh>
          </group>
          {([-1, 1] as const).map((side) => (
            <group key={side} ref={side < 0 ? j.lArm : j.rArm} position={[side * 0.2, 0.5, 0]} rotation-z={side * 0.06}>
              {limb(0.05, 0.3, m.jacket)}
              <group ref={side < 0 ? j.lElbow : j.rElbow} position={[0, -0.3, 0]}>
                {limb(0.043, 0.27, m.jacket)}
                <mesh position={[0, -0.31, 0.01]} scale={[0.75, 1.2, 0.5]} material={m.skin} castShadow>
                  <sphereGeometry args={[0.045, 10, 8]} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

export const DRIVER_LOOK: Look = { jacket: '#4a4636', trousers: '#2a2925', skin: '#5a3c2a', hair: '#151515' }
