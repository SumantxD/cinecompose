import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Noise, Vignette, HueSaturation, BrightnessContrast, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, Effect, ToneMappingMode } from 'postprocessing'
import { Uniform } from 'three'
import { useStore } from '../state/store'
import * as player from '../app/player'
import { cam } from './timeline'

/** Series exposure; scenes scale it with `lighting.exposure`. Tuned against scripts/analyze-video.sh targets. */
export const BASE_EXPOSURE = 1.35

class ExposureEffect extends Effect {
  constructor() {
    super('Exposure', 'uniform float exposure; void mainImage(const in vec4 c, const in vec2 uv, out vec4 o) { o = vec4(c.rgb * exposure, c.a); }', {
      uniforms: new Map([['exposure', new Uniform(1)]]),
    })
  }
}

/** The series grade: desaturated, slightly crushed, filmic. Bloom only for real light sources. */
export function PostFX() {
  const low = useStore((s) => s.quality === 'low')
  const exposure = useMemo(() => new ExposureEffect(), [])
  useFrame(() => (exposure.uniforms.get('exposure')!.value = BASE_EXPOSURE * (player.lighting.exposure ?? 1) * cam.exposure))
  return (
    <EffectComposer multisampling={0}>
      <primitive object={exposure} />
      {low ? <></> : <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.55} />}
      <HueSaturation saturation={-0.22} />
      <BrightnessContrast contrast={0.08} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.78} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.32} />
    </EffectComposer>
  )
}
