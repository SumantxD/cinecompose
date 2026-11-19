import { useMemo } from 'react'
import { useStore } from '../state/store'
import { useRenderSettings } from '../cinematic/rendering'
import { ModelInstances, type ModelPlacement } from './ModelInstances'
import { rng } from '../utils/random'

interface Props {
  clear: (x: number, z: number) => boolean
  heightAt: (x: number, z: number) => number
  seed?: number
  density?: number
  zMin?: number
  zMax?: number
}

/** Bounded scanned roadside dressing. Procedural vegetation remains the distant/backfill canopy. */
export function RoadsideNature({ clear, heightAt, seed = 47, density = 1, zMin = -42, zMax = 32 }: Props) {
  const low = useStore(s => s.quality === 'low') || useRenderSettings()?.profile === 'performance'
  const layout = useMemo(() => {
    const random = rng(seed)
    const at = (x: number, z: number, height: number): ModelPlacement => ({ x, z, y: heightAt(x, z) - .035, height, rotation: random() * Math.PI * 2 })
    const place = (count: number, minHeight: number, maxHeight: number, near = 5.6) => {
      const placements: ModelPlacement[] = []
      for (let attempt = 0; attempt < count * 24 && placements.length < count; attempt++) {
        const x = (random() > .5 ? 1 : -1) * (near + random() * 7), z = zMin + random() * (zMax - zMin)
        const rounded = { x: +x.toFixed(3), z: +z.toFixed(3) }
        if (!clear(rounded.x, rounded.z)) continue
        placements.push(at(rounded.x, rounded.z, minHeight + random() * (maxHeight - minHeight)))
      }
      return placements
    }
    const scale = low ? density * .55 : density
    return {
      hero: place(Math.max(1, Math.round(scale)), 9.5, 11.5, 7.2),
      trees: place(Math.round(6 * scale), 8, 13),
      ferns: place(Math.round(14 * scale), .42, .72, 4.4),
      rocks: place(Math.round(4 * scale), .32, .65, 4.5),
      stumps: place(Math.max(1, Math.round(2 * scale)), .45, .72, 5.2),
      deadwood: place(Math.max(1, Math.round(2 * scale)), .28, .44, 5.1),
      branches: place(Math.round(4 * scale), .14, .28, 4.2),
    }
  }, [clear, heightAt, seed, density, low, zMin, zMax])
  return <group name="roadside-scanned-nature">
    {!low && <ModelInstances id="tree_small_02_detail" placements={layout.hero} />}
    <ModelInstances id="tree_small_02" placements={layout.trees} castShadow={false} />
    <ModelInstances id="fern_02" placements={layout.ferns} castShadow={false} wind={.35} />
    <ModelInstances id="rock_moss_set_01" placements={layout.rocks} />
    <ModelInstances id="tree_stump_01" placements={layout.stumps} />
    <ModelInstances id="dead_tree_trunk" placements={layout.deadwood} />
    <ModelInstances id="dry_branches_medium_01" placements={layout.branches} castShadow={false} />
  </group>
}
