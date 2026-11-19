import { Environment } from '@react-three/drei'
import { HDRI_LIBRARY } from '../cinematic/rendering'
import type { RenderSettings } from '../cinematic/types'

/** HDRI illumination and visible background are deliberately separate. Keep NightSky for scenes without this explicit opt-in. */
export function EnvironmentLighting({ environment }: { environment?: RenderSettings['environment'] }) {
  if (!environment) return null
  const asset = HDRI_LIBRARY[environment.hdri]
  if (!asset) return null
  return (
    <Environment
      files={asset.file}
      background={environment.background === true}
      backgroundIntensity={environment.backgroundIntensity ?? .45}
      backgroundBlurriness={environment.backgroundBlurriness ?? .03}
      backgroundRotation={[0, (environment.backgroundRotation ?? environment.rotation) * Math.PI / 180, 0]}
      environmentIntensity={environment.intensity}
      environmentRotation={[0, (environment.rotation * Math.PI) / 180, 0]}
    />
  )
}
