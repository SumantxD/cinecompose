import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { CameraController } from '../cinematic/CameraController'
import { PostFX } from '../cinematic/PostFX'
import { ENVIRONMENTS } from '../scenes/registry'
import { useStore } from '../state/store'
import * as player from './player'
import { StudioRig } from '../studio/StudioRig'
import { StageModeContext } from './StageContext'
import { EnvironmentEffects } from '../environment/EnvironmentEffects'
import { EnvironmentLighting } from '../components/EnvironmentLighting'
import { resolveRenderSettings, RenderSettingsContext } from '../cinematic/rendering'

function Clock({ drive, film = false }: { drive: boolean; film?: boolean }) {
  const state = useThree()
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { r3f: state, ...(film ? { filmR3f: state } : {}) })
  }, [state])
  useFrame((frameState, dt) => {
    if (!drive) return
    player.tick(dt)
      if (import.meta.env.DEV) Object.assign(window, { ...(film ? { filmR3f: frameState } : { r3f: frameState }) })
  })
  return null
}

function Environment() {
  useStore((s) => s.sceneId)
  const Env = ENVIRONMENTS[player.environment] ?? ENVIRONMENTS.void
  return <>
    <Env key={player.environment} lighting={player.lighting} scene={player.scene} />
    <EnvironmentLighting environment={player.scene.rendering?.environment} />
    <EnvironmentEffects effects={player.scene.effects ?? []} />
  </>
}

export function Stage({ mode = 'game' }: { mode?: 'game' | 'preview' | 'director' }) {
  useStore((s) => s.sceneId)
  const low = useStore((s) => s.quality === 'low')
  const director = mode === 'director'
  const render = resolveRenderSettings(player.scene.rendering)
  const configured = !!player.scene.rendering
  const dpr: number | [number, number] = configured
    ? Math.min(typeof window === 'undefined' ? 2 : (window.devicePixelRatio || 1), render.renderScale)
    : low ? [1, 1.25] : director ? [1, 1.5] : [1, 2]
  const shadowType = render.shadowType === 'pcf-soft' ? THREE.PCFSoftShadowMap : render.shadowType === 'basic' ? THREE.BasicShadowMap : THREE.PCFShadowMap
  return (
    <Canvas
      shadows={configured && !render.shadows ? false : { type: configured ? shadowType : THREE.PCFShadowMap }}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: import.meta.env.DEV }}
      camera={{ fov: director ? 50 : 40, near: 0.05, far: 600, position: director ? [13, 8, 19] : [0, 1.6, 5] }}
    >
      {!director && <PerformanceMonitor onDecline={() => useStore.getState().set({ quality: 'low' })} />}
      <Clock drive={!director} film={mode === 'preview'} />
      {!director && <CameraController />}
      <StageModeContext.Provider value={{ director }}>
        <RenderSettingsContext.Provider value={configured ? render : undefined}>
          <Environment />
        </RenderSettingsContext.Provider>
      </StageModeContext.Provider>
      {!director && <PostFX />}
      {director && <StudioRig />}
    </Canvas>
  )
}
