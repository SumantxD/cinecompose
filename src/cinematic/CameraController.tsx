import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cam } from './timeline'
import { clock } from './clock'
import { PRESETS, STEP_HZ } from './presets'
import { AudioManager } from '../audio/AudioManager'
import { cceFrame } from '../cce/runtime'

const PORTRAIT = 9 / 16
const LANDSCAPE = 16 / 9
const look = new THREE.Vector3()
const fwd = new THREE.Vector3()
const right = new THREE.Vector3()
const vertical = new THREE.Vector3()
const offset = new THREE.Vector3()

/** Applies `cam` (written by the scene timeline) to the R3F camera, with aspect-aware FOV and preset drift. */
export function CameraController() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const eye = useRef<THREE.PointLight>(null!)

  useFrame(() => {
    eye.current.intensity = cam.free ? 0 : cam.eyeLight
    if (cam.free) return // Studio free camera owns it
    const p = PRESETS[cam.type]
    const w = clock.t * p.driftRate
    camera.position.set(
      cam.px + Math.sin(w * 1.3) * p.drift,
      cam.py + Math.sin(w * 0.9 + 1.7) * p.drift * 0.7,
      cam.pz + Math.sin(w * 0.7 + 0.4) * p.drift * 0.5,
    )
    if (cceFrame.dolly || cceFrame.truck || cceFrame.lift) {
      fwd.subVectors(look, camera.position).normalize()
      right.crossVectors(fwd, camera.up).normalize()
      vertical.crossVectors(right, fwd).normalize()
      camera.position.addScaledVector(fwd, cceFrame.dolly).addScaledVector(right, cceFrame.truck).addScaledVector(vertical, cceFrame.lift)
    }
    if (cceFrame.orbit) camera.position.copy(look).add(offset.subVectors(camera.position, look).applyAxisAngle(camera.up, cceFrame.orbit))
    camera.lookAt(look.set(cam.lx, cam.ly, cam.lz))
    camera.rotateY(cceFrame.yaw)
    camera.rotateX(cceFrame.pitch)
    if (cam.roll || cceFrame.roll) camera.rotateZ(cam.roll + cceFrame.roll)
    if (p.bob) {
      // One dip per footstep, sway alternating left/right — applied in the camera's own frame.
      const s = Math.sin(clock.t * Math.PI * STEP_HZ)
      camera.translateY((Math.abs(s) - 0.64) * p.bob)
      camera.translateX(s * p.bob * 0.35)
    }

    // Portrait gets its own authored FOV; aspects in between blend so resizing never jumps.
    const k = THREE.MathUtils.clamp((size.width / size.height - PORTRAIT) / (LANDSCAPE - PORTRAIT), 0, 1)
    const fov = THREE.MathUtils.clamp(THREE.MathUtils.lerp(cam.fovP, cam.fov, k) + cceFrame.fov, 8, 120)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    eye.current.position.set(-0.35, 0.55, 0.1)
    camera.localToWorld(eye.current.position)

    camera.getWorldDirection(fwd)
    AudioManager.listener([camera.position.x, camera.position.y, camera.position.z], [fwd.x, fwd.y, fwd.z])
  })

  return <pointLight ref={eye} color="#a9bcd8" distance={9} decay={2} intensity={0} />
}
