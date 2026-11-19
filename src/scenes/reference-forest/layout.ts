import type { ForestSettings } from '../../cinematic/types'
import type { ModelPlacement } from '../../components/ModelInstances'
import type { SceneModelId } from '../../assets/manifest'
import { fbm, rng } from '../../utils/random.ts'

export const pathX = (z: number) => Math.sin(z * .052) * 3.4
export const DEFAULT_RELIEF = .35
export const SOIL_SINK = .035

export function forestHeightAt(x: number, z: number, seed: number, relief = DEFAULT_RELIEF) {
  const base = (fbm(x * .023 + seed % 97, z * .023, 5) - .5) * 3.2
  const clearing = Math.max(0, Math.min(1, (Math.abs(x - pathX(z)) - 1.7) / 4.8))
  const bumps = (fbm(x * .48 + seed % 31, z * .48 - seed % 43, 4) - .5) * 3
  return base * (.18 + clearing * .82) + bumps * relief * (.72 + clearing * .28)
}

export function forestLayout(settings: ForestSettings, performance = false) {
  const random = rng(settings.seed)
  const at = (x: number, z: number, height: number, scale = 1): ModelPlacement => ({ x, z, y: forestHeightAt(x, z, settings.seed, settings.relief) - SOIL_SINK, height: height * scale, rotation: random() * Math.PI * 2 })
  const trees = [at(-3.7, 7.5, 8.6), at(5.8, 3, 10.6), at(-1.8, -8, 11.8), at(4.2, -14, 13), at(-4.8, -22, 14.3), at(6.5, -29, 13.2), at(-6.7, -37, 15), at(4.8, -45, 15)]
  const wanted = Math.round((performance ? 40 : 60) * settings.density)
  for (let attempt = 0; attempt < wanted * 14 && trees.length < wanted + 5; attempt++) {
    const x = (random() - .5) * 88, z = 18 - random() * 101
    if (Math.abs(x - pathX(z)) < 4.2 || Math.hypot(x - 2.4, z - 18) < 6 || trees.some((p) => Math.hypot(p.x - x, p.z - z) < 3.3)) continue
    trees.push(at(x, z, 8.5 + random() * 6.5))
  }
  const scattered = (id: SceneModelId, count: number, minHeight: number, maxHeight: number, edge: number) => {
    const result: ModelPlacement[] = []
    for (let i = 0; i < count; i++) {
      const z = 15 - random() * 72, side = random() > .5 ? 1 : -1
      const x = pathX(z) + side * (edge + random() * 16)
      result.push(at(x, z, minHeight + random() * (maxHeight - minHeight)))
    }
    return { id, placements: result }
  }
  return {
    trees,
    ferns: [
      at(pathX(13) - 1.65, 13, .64), at(pathX(12) + 2.1, 12, .62),
      at(pathX(10) - 2.1, 10, .56), at(pathX(8) + 2.2, 8, .6),
      ...Array.from({ length: Math.round(20 + 55 * settings.density) }, () => {
        const z = 18 - random() * 70, side = random() > .5 ? 1 : -1, x = pathX(z) + side * (2.15 + random() ** 1.6 * 18)
        return at(x, z, .4 + random() * .3)
      })],
    props: [
      scattered('rock_moss_set_01', performance ? 5 : 9, .38, .92, 3.9),
      scattered('tree_stump_01', 5, .42, .88, 3.2),
      scattered('dead_tree_trunk', 3, .28, .48, 4.8),
      scattered('dry_branches_medium_01', 9, .12, .32, 2.5),
    ],
    puddles: Array.from({ length: performance ? 4 : 8 }, (_, i) => {
      const z = 13 - i * 7 - random() * 4, x = pathX(z) + (random() - .5) * 2.1
      return { x, z, y: forestHeightAt(x, z, settings.seed, settings.relief) + .024, radius: .45 + random() * .8, rotation: random() * Math.PI }
    }),
  }
}
