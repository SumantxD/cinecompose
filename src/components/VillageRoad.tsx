import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { asphalt, signboard } from '../utils/textures'
import { fbm, rng } from '../utils/random'

/** Height offset shared by everything near a raised track bed (road, ground, props). */
export type Terrain = (x: number, z: number) => number

interface Props {
  width?: number
  zFrom?: number
  zTo?: number
  terrain?: Terrain
  /** Fallen leaves strewn along the edges. */
  leaves?: number
}

/** A narrow, crowned, broken-edged village road along -z, wet enough to mirror lamps. */
export function VillageRoad({ width = 5.6, zFrom = 45, zTo = -90, terrain = () => 0, leaves = 260 }: Props) {
  const maps = useMemo(() => asphalt(), [])
  const geometry = useMemo(() => {
    const len = zFrom - zTo
    const g = new THREE.PlaneGeometry(width, len, 10, Math.round(len * 1.5))
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, (zFrom + zTo) / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i)
      const z = p.getZ(i)
      const edge = Math.abs(x) > width / 2 - 0.01
      if (edge) x += Math.sign(x) * (fbm(z * 0.6, x) - 0.5) * 0.7 // crumbling edges
      const crown = 0.035 - 0.004 * x * x
      p.setXYZ(i, x, crown + terrain(x, z) + (fbm(x * 0.8, z * 0.8) - 0.5) * 0.015, z)
    }
    g.computeVertexNormals()
    return g
  }, [width, zFrom, zTo, terrain])

  const leafMatrices = useMemo(() => {
    const rand = rng(91)
    const m = new THREE.Object3D()
    return Array.from({ length: leaves }, () => {
      const side = rand() > 0.5 ? 1 : -1
      const x = side * (width / 2 - rand() * rand() * 2)
      const z = zTo + rand() * (zFrom - zTo)
      m.position.set(x, 0.045 + terrain(x, z), z)
      m.rotation.set(-Math.PI / 2, 0, rand() * Math.PI * 2)
      m.scale.setScalar(0.06 + rand() * 0.07)
      m.updateMatrix()
      return m.matrix.clone()
    })
  }, [leaves, width, zFrom, zTo, terrain])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial {...maps} metalness={0} />
      </mesh>
      <instancedMesh args={[undefined, undefined, leaves]} receiveShadow
        ref={(im) => { if (im) { leafMatrices.forEach((mx, i) => im.setMatrixAt(i, mx)); im.instanceMatrix.needsUpdate = true } }}>
        <circleGeometry args={[1, 5]} />
        <meshStandardMaterial color="#3a2a17" roughness={0.6} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}

/** Indian roadside milestone. Orange cap = village road. */
export function Milestone({ position, rotationY = 0, place, km }: { position: [number, number, number]; rotationY?: number; place: string; km: string }) {
  const [face, setFace] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    signboard([{ text: place, font: '64px "Tiro Devanagari Hindi"', y: 0.38 }, { text: km, font: 'bold 96px sans-serif', y: 0.72 }], '#d9d4c5', '#1d1a16', 256, 256).then(setFace)
  }, [place, km])
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.27, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.54, 0.16]} />
        <meshStandardMaterial color="#cfc9b8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.54, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.21, 0.16, 20, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#b4561f" roughness={0.85} />
      </mesh>
      {face && (
        <mesh position={[0, 0.3, 0.081]}>
          <planeGeometry args={[0.38, 0.38]} />
          <meshStandardMaterial map={face} roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}
