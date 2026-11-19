import { useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  EffectComposer, Bloom, Noise, Vignette, HueSaturation, BrightnessContrast,
  ToneMapping, N8AO, SMAA, DepthOfField, ChromaticAberration, GodRays,
} from '@react-three/postprocessing'
import { BlendFunction, Effect, SMAAPreset, ToneMappingMode } from 'postprocessing'
import { Uniform, Mesh, SphereGeometry, MeshBasicMaterial, Color, Vector2 } from 'three'
import { cceFrame } from '../cce/runtime'
import { useStore } from '../state/store'
import * as player from '../app/player'
import { cam } from './timeline'
import { applyShadowBudget, applyTextureQuality, resolveRenderSettings } from './rendering'
import type { RenderSettings } from './types'
import { RenderProbe } from '../studio/RenderProbe'

/** Series exposure; scenes scale it with `lighting.exposure`. Tuned against scripts/analyze-video.sh targets. */
export const BASE_EXPOSURE = 1.35

class ExposureEffect extends Effect {
  constructor() {
    super('Exposure', 'uniform float exposure; void mainImage(const in vec4 c, const in vec2 uv, out vec4 o) { o = vec4(c.rgb * exposure, c.a); }', {
      uniforms: new Map([['exposure', new Uniform(1)]]),
    })
  }
}

function ResourceQuality({ settings }: { settings: RenderSettings }) {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    applyShadowBudget(scene, settings)
    const max = gl.capabilities.getMaxAnisotropy()
    applyTextureQuality(scene, settings, max)
    // Async PBR maps are picked up too. This is resource configuration, not scene animation.
    const interval = window.setInterval(() => applyTextureQuality(scene, settings, max), 2000)
    return () => window.clearInterval(interval)
  }, [scene, gl, settings.shadows, settings.shadowMapSize, settings.textureAnisotropy])
  return null
}

/** The series grade stays unchanged for scenes without a rendering block. Opt-in controls affect the film preview/export. */
export function PostFX() {
  // Studio reloads player.scene whenever an edit is made. Subscribe so the live preview follows it.
  useStore((s) => s.sceneId)
  const settings = resolveRenderSettings(player.scene.rendering)
  const low = useStore((s) => s.quality === 'low')
  const exposure = useMemo(() => new ExposureEffect(), [])
  const sun = useMemo(() => {
    const mesh = new Mesh(new SphereGeometry(0.35, 12, 8), new MeshBasicMaterial({ color: new Color('#fff0d0'), toneMapped: false }))
    mesh.name = 'rendering-godray-source'
    return mesh
  }, [])
  const chromaticOffset = useMemo(() => new Vector2(), [])
  useFrame(() => {
    exposure.uniforms.get('exposure')!.value = BASE_EXPOSURE * (player.lighting.exposure ?? 1) * cam.exposure
    const base = settings.chromatic.enabled ? settings.chromatic.offset : 0
    chromaticOffset.set(base + cceFrame.chromatic, base + cceFrame.chromatic)
  })
  const bloom = settings.bloom.enabled && (!low || !!player.scene.rendering)
  const tone = settings.toneMapping === 'none' ? null : settings.toneMapping === 'neutral' ? ToneMappingMode.NEUTRAL : ToneMappingMode.ACES_FILMIC
  return <>
    {player.scene.rendering && <ResourceQuality settings={settings} />}
    {player.studio && <RenderProbe />}
    {settings.godRays.enabled && <primitive object={sun} position={settings.godRays.position} />}
    <EffectComposer key={settings.godRays.enabled ? 'rays' : 'base'} multisampling={settings.antialias === 'msaa' ? settings.msaaSamples : 0} autoClear={!settings.godRays.enabled}>
      <primitive object={exposure} />
      {settings.ao.enabled && <N8AO quality={settings.ao.quality} aoRadius={settings.ao.radius} intensity={settings.ao.intensity} halfRes={settings.ao.halfRes} />}
      {bloom && <Bloom mipmapBlur luminanceThreshold={settings.bloom.threshold} luminanceSmoothing={0.2} intensity={settings.bloom.intensity} />}
      {settings.dof.enabled && <DepthOfField focusDistance={settings.dof.focusDistance} focalLength={settings.dof.focalLength} bokehScale={settings.dof.bokeh * (2.8 / settings.dof.fStop)} />}
      {(settings.chromatic.enabled || !!player.scene.props?.cce?.clips.length) && <ChromaticAberration offset={chromaticOffset} />}
      {settings.godRays.enabled && <GodRays sun={sun} density={settings.godRays.density} decay={settings.godRays.decay} opacity={settings.godRays.intensity} clampMax={1.2} samples={32} />}
      <HueSaturation saturation={settings.grade.saturation} />
      <BrightnessContrast contrast={settings.grade.contrast} />
      {tone && <ToneMapping mode={tone} />}
      {settings.vignette.enabled && <Vignette offset={0.28} darkness={settings.vignette.darkness} />}
      {settings.grain.enabled && <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={settings.grain.opacity} />}
      {settings.antialias === 'smaa' && <SMAA preset={settings.profile === 'ultra' ? SMAAPreset.ULTRA : SMAAPreset.MEDIUM} />}
    </EffectComposer>
  </>
}
