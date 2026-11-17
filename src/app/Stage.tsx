import { Canvas, useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { CameraController } from '../cinematic/CameraController'
import { PostFX } from '../cinematic/PostFX'
import { ENVIRONMENTS } from '../scenes/registry'
import { useStore } from '../state/store'
import * as player from './player'
import { StudioRig } from '../studio/StudioRig'
import { StageModeContext } from './StageContext'

function Clock({ drive }: { drive: boolean }) {
  useFrame((state, dt) => {
    if (!drive) return
    player.tick(dt)
    if (import.meta.env.DEV) Object.assign(window, { r3f: state })
  })
  return null
}

function Environment() {
  useStore((s) => s.sceneId)
  const Env = ENVIRONMENTS[player.environment] ?? ENVIRONMENTS.void
  return <Env key={player.environment} lighting={player.lighting} scene={player.scene} />
}

export function Stage({ mode = 'game' }: { mode?: 'game' | 'preview' | 'director' }) {
  const low = useStore((s) => s.quality === 'low')
  const director = mode === 'director'
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={low ? [1, 1.25] : director ? [1, 1.5] : [1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: import.meta.env.DEV }}
      camera={{ fov: director ? 50 : 40, near: 0.05, far: 600, position: director ? [13, 8, 19] : [0, 1.6, 5] }}
    >
      {!director && <PerformanceMonitor onDecline={() => useStore.getState().set({ quality: 'low' })} />}
      <Clock drive={!director} />
      {!director && <CameraController />}
      <StageModeContext.Provider value={{ director }}>
        <Environment />
      </StageModeContext.Provider>
      {!director && <PostFX />}
      {director && <StudioRig />}
    </Canvas>
  )
}
