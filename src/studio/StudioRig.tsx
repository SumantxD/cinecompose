import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useStudio } from './studioStore'
import { cam } from '../cinematic/timeline'

/** Inside the Canvas: hands the camera to an orbit control when "Free camera" is on, and shares handles with the UI. */
export function StudioRig() {
  const free = useStudio((s) => s.free)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useRef<OrbitImpl>(null)

  useEffect(() => {
    cam.free = free
    if (free && controls.current) {
      // Start orbiting from exactly what the shot was showing.
      controls.current.target.set(cam.lx, cam.ly, cam.lz)
      controls.current.update()
    }
    useStudio.getState().set({ camera, target: controls.current?.target ?? null })
    return () => void (cam.free = false)
  }, [free, camera])

  return free ? <OrbitControls ref={controls as never} makeDefault enableDamping={false} /> : null
}
