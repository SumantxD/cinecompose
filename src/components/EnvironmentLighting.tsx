import { Environment } from '@react-three/drei'
import { HDRI_LIBRARY } from '../cinematic/rendering'
import type { RenderSettings } from '../cinematic/types'

/** Optional local HDRI lighting. Scenes without this block retain their procedural night fill. */
export function EnvironmentLighting({ environment }: { environment?: RenderSettings['environment'] }) {
  if (!environment) return null
  const asset = HDRI_LIBRARY[environment.hdri]
  if (!asset) return null
  return (
    <Environment
      files={asset.file}
      background={false}
      environmentIntensity={environment.intensity}
      environmentRotation={[0, (environment.rotation * Math.PI) / 180, 0]}
    />
  )
}
