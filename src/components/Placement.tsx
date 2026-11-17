import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../cinematic/types.ts'

/** Places local geometric bounds on an analytic surface; repeat measurements are idempotent. */
export function Grounded({ children, position, floor, visible = true, name }: { children: ReactNode; position: Vec3; floor: number; visible?: boolean; name?: string }) {
  const group = useRef<THREE.Group>(null!)
  const authorY = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    const object = group.current
    authorY.current ??= object.position.y
    object.position.y = authorY.current
    object.updateWorldMatrix(false, true)
    const box = new THREE.Box3().setFromObject(object)
    object.position.y += floor + 0.0005 - box.min.y
    object.updateMatrixWorld(true)
  }, [floor, position[0], position[2], children])
  return <group ref={group} position={position} visible={visible} name={name}>{children}</group>
}
