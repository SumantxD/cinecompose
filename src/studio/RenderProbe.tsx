import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStudio } from './studioStore'

/** Director Panel reads the composed film renderer, not the guide-only viewport. */
export function RenderProbe() {
  const gl = useThree((s) => s.gl)
  const last = useMemo(() => ({ at: performance.now(), frames: 0 }), [])
  useEffect(() => {
    gl.info.autoReset = false
    gl.info.reset()
    return () => { gl.info.autoReset = true; gl.info.reset() }
  }, [gl])
  useFrame(() => {
    last.frames++
    const now = performance.now()
    if (now - last.at < 500) return
    const info = gl.info
    useStudio.getState().set({ metrics: {
      fps: Math.round(last.frames * 1000 / Math.max(1, now - last.at)),
      calls: Math.round(info.render.calls / last.frames), triangles: Math.round(info.render.triangles / last.frames),
      textures: info.memory.textures, geometries: info.memory.geometries, programs: info.programs?.length ?? 0,
    } })
    last.at = now
    last.frames = 0
    // Count each compositor pass, but report a per-frame average rather than an interval total.
    gl.info.reset()
  }, 2)
  return null
}
