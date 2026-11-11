import { Canvas, useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { CameraController } from '../cinematic/CameraController'
import { PostFX } from '../cinematic/PostFX'
import { ENVIRONMENTS } from '../scenes/registry'
import { useStore } from '../state/store'
import * as player from './player'
import { StudioRig } from '../studio/StudioRig'

function Clock() {
  useFrame((state, dt) => {
    player.tick(dt)
    if (import.meta.env.DEV) Object.assign(window, { r3f: state })
  })
  return null
}

function Environment() {
  useStore((s) => s.sceneId) // re-render on scene change
  const Env = ENVIRONMENTS[player.environment] ?? ENVIRONMENTS.void
  return <Env key={player.environment} lighting={player.lighting} />
}

export function Stage() {
  const low = useStore((s) => s.quality === 'low')
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={low ? [1, 1.25] : [1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: import.meta.env.DEV }}
      camera={{ fov: 40, near: 0.05, far: 600, position: [0, 1.6, 5] }}
    >
      <PerformanceMonitor onDecline={() => useStore.getState().set({ quality: 'low' })} />
      <Clock />
      <CameraController />
      <Environment />
      <PostFX />
      {player.studio && <StudioRig />}
    </Canvas>
  )
}
