import type { ReactNode } from 'react'
import * as THREE from 'three'
import { periodMaterial } from './DomesticProps'

export type HeadRole = 'aarav' | 'meera' | 'driver'

/** Attachments use normalized actor-head coordinates. Licensed models can use this same slot. */
export function HeadDetails({ role, material, children }: { role: HeadRole; material: THREE.Material; children?: ReactNode }) {
  return <group name='head-accessories'>
    <mesh position={[0, 0.1, -0.012]} scale={[0.92, 0.95, 1.05]} material={material} castShadow>
      <sphereGeometry args={[0.104, 20, 12, 0, Math.PI * 2, 0, 1.75]} />
    </mesh>
    {role === 'meera' && [-1, 1].map(side => <group key={side}>
      {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[side * (0.106 + i * 0.002), 0.069 - i * 0.019, -0.003 + i * 0.006]} scale={[1, 1.18, 0.88]} material={material} castShadow>
        <sphereGeometry args={[0.014 - i * 0.0011, 10, 7]} />
      </mesh>)}
      <mesh position={[side * 0.113, -0.013, 0.02]} material={periodMaterial('cloth', '#67514a')}>
        <sphereGeometry args={[0.009, 8, 6]} />
      </mesh>
    </group>)}
    {role === 'driver' && <>
      <mesh position={[0, 0.185, -0.008]} material={periodMaterial('cloth', '#34372f')} castShadow>
        <cylinderGeometry args={[0.104, 0.108, 0.044, 20]} />
      </mesh>
      <mesh position={[0, 0.169, 0.086]} material={periodMaterial('cloth', '#34372f')} castShadow>
        <boxGeometry args={[0.168, 0.009, 0.115]} />
      </mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side * 0.024, -0.021, 0.097]} scale={[0.029, 0.01, 0.009]} material={material}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>)}
      <mesh position={[0, -0.075, 0.079]} scale={[0.04, 0.017, 0.012]} material={material}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>
    </>}
    {children}
  </group>
}
