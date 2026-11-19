import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { useGlide } from './useGlide'
import { radial } from '../utils/textures'
import type { Vec3 } from '../cinematic/types'

// An old white Ambassador-style taxi. Local forward is +z. Right-hand drive (India): driver seat at -x.
// Headlights are real spot lights (one shadow-caster for the pair) so the car can light — and leave — the road.
// Seat positions for actors (local): PASSENGER_SEAT, DRIVER_SEAT.
export const PASSENGER_SEAT: Vec3 = [0.4, 0.42, 0.15]
export const DRIVER_SEAT: Vec3 = [-0.4, 0.42, 0.15]

export function Taxi({ id, position = [0, 0, 0], rotationY = 0, lowShadows = false }: { id: string; position?: Vec3; rotationY?: number; lowShadows?: boolean }) {
  const { state, root, update } = useGlide(id, position, rotationY)
  const parts = useMemo(() => {
    const body = new RoundedBoxGeometry(1.66, 0.62, 4.3, 4, 0.16)
    const cabin = new RoundedBoxGeometry(1.48, 0.56, 2.25, 4, 0.14)
    const target = new THREE.Object3D()
    target.position.set(0, -0.5, 14)
    return { body, cabin, target, glow: radial() }
  }, [])
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f8a7c', roughness: 0.55, metalness: 0.12, side: THREE.DoubleSide }), [])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#05070a', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }), [])

  useFrame(() => update(0.08))

  const on = !!state?.visible
  return (
    <group ref={root} position={position} rotation-y={rotationY} visible={on}>
      <mesh geometry={parts.body} position={[0, 0.68, 0]} material={paint} castShadow receiveShadow />
      <mesh geometry={parts.cabin} position={[0, 1.24, -0.25]} material={glass} />
      <mesh position={[0, 1.53, -0.25]} material={paint} castShadow>
        <boxGeometry args={[1.42, 0.05, 2.1]} />
      </mesh>
      {[-0.7, 0.7].flatMap((x) => [0.85, -1.33].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 1.25, z]} material={paint}>
          <boxGeometry args={[0.06, 0.55, 0.08]} />
        </mesh>
      )))}
      {/* Interior: seats, dashboard glow. */}
      {[PASSENGER_SEAT, DRIVER_SEAT].map((p, i) => (
        <group key={i} position={[p[0], 0.62, p[2] - 0.15]}>
          <mesh position={[0, 0, 0]}><boxGeometry args={[0.55, 0.12, 0.55]} /><meshStandardMaterial color="#2a1d17" roughness={0.9} /></mesh>
          <mesh position={[0, 0.38, -0.27]} rotation-x={-0.12}><boxGeometry args={[0.55, 0.7, 0.12]} /><meshStandardMaterial color="#2a1d17" roughness={0.9} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.02, 0.95]}><boxGeometry args={[1.45, 0.18, 0.3]} /><meshStandardMaterial color="#141210" roughness={0.8} /></mesh>
      <mesh position={[-0.4, 1.06, 0.79]}><planeGeometry args={[0.32, 0.08]} /><meshBasicMaterial color={[0.25, 0.7, 0.45]} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      <pointLight position={[-0.2, 1.1, 0.7]} color="#6fd0a0" intensity={on ? 1.6 : 0} distance={2.2} decay={2} />
      {/* Headlights + one shared beam. */}
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 0.78, 2.16]}>
          <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.11, 0.11, 0.04, 16]} /><meshBasicMaterial color={[3, 2.7, 2.1]} toneMapped={false} /></mesh>
          <sprite position={[0, 0, 0.05]} scale={[0.9, 0.9, 1]}><spriteMaterial map={parts.glow} color="#fff1d6" blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.38} fog={false} /></sprite>
        </group>
      ))}
      <primitive object={parts.target} />
      <spotLight position={[0, 0.8, 2.2]} target={parts.target} color="#fff0d2" intensity={on ? 155 : 0} angle={0.42} penumbra={0.5} decay={2}
        castShadow shadow-mapSize={lowShadows ? [512, 512] : [1024, 1024]} shadow-bias={-0.0005} />
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.74, -2.16]}><boxGeometry args={[0.18, 0.1, 0.02]} /><meshBasicMaterial color={[1.6, 0.08, 0.05]} toneMapped={false} /></mesh>
      ))}
      {[-0.78, 0.78].flatMap((x) => [1.35, -1.35].map((z) => (
        <mesh key={`w${x}${z}`} position={[x, 0.33, z]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.33, 0.33, 0.2, 18]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.7} />
        </mesh>
      )))}
    </group>
  )
}
