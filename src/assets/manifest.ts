export type SurfaceKind = 'wood' | 'plaster' | 'denim'
export const SURFACES: Record<SurfaceKind, {
  id: string
  source: string
  license: 'CC0-1.0'
  resolution: '1K'
  optimized: true
  /** Linear-RGB mean of this local 1K albedo (verified 2026-11-13). */
  linearMean: readonly [number, number, number]
  sourceUrl: string
  maps: { color: string; normal: string; roughness: string }
}> = {
  wood: { id: 'old_wood_floor', source: 'Poly Haven — Old Wood Floor', license: 'CC0-1.0', resolution: '1K', optimized: true, linearMean: [0.0958435, 0.0674457, 0.0492188], sourceUrl: 'https://polyhaven.com/a/old_wood_floor', maps: { color: 'color', normal: 'normal', roughness: 'roughness' } },
  plaster: { id: 'damaged_plaster', source: 'Poly Haven — Damaged Plaster', license: 'CC0-1.0', resolution: '1K', optimized: true, linearMean: [0.3017678, 0.2329064, 0.1761296], sourceUrl: 'https://polyhaven.com/a/damaged_plaster', maps: { color: 'color', normal: 'normal', roughness: 'roughness' } },
  denim: { id: 'denim_fabric', source: 'Poly Haven — Denim Fabric', license: 'CC0-1.0', resolution: '1K', optimized: true, linearMean: [0.0855631, 0.1763435, 0.2813996], sourceUrl: 'https://polyhaven.com/a/denim_fabric', maps: { color: 'color', normal: 'normal', roughness: 'roughness' } },
}

export type SceneModelId = 'tree_small_02' | 'tree_small_02_detail' | 'tree_stump_01' | 'rock_moss_set_01' | 'dead_tree_trunk' | 'brass_diya_lantern' | 'dry_branches_medium_01' | 'fern_02'
export const SCENE_MODELS: Record<SceneModelId, { file: string; source: string; license: 'CC0-1.0' }> = {
  tree_small_02: { file: '/models/forest/tree_small_02.glb', source: 'https://polyhaven.com/a/tree_small_02', license: 'CC0-1.0' },
  tree_small_02_detail: { file: '/models/forest/tree_small_02_detail.glb', source: 'https://polyhaven.com/a/tree_small_02', license: 'CC0-1.0' },
  tree_stump_01: { file: '/models/forest/tree_stump_01.glb', source: 'https://polyhaven.com/a/tree_stump_01', license: 'CC0-1.0' },
  rock_moss_set_01: { file: '/models/forest/rock_moss_set_01.glb', source: 'https://polyhaven.com/a/rock_moss_set_01', license: 'CC0-1.0' },
  dead_tree_trunk: { file: '/models/forest/dead_tree_trunk.glb', source: 'https://polyhaven.com/a/dead_tree_trunk', license: 'CC0-1.0' },
  brass_diya_lantern: { file: '/models/forest/brass_diya_lantern.glb', source: 'https://polyhaven.com/a/brass_diya_lantern', license: 'CC0-1.0' },
  dry_branches_medium_01: { file: '/models/forest/dry_branches_medium_01.glb', source: 'https://polyhaven.com/a/dry_branches_medium_01', license: 'CC0-1.0' },
  fern_02: { file: '/models/forest/fern_02.glb', source: 'https://polyhaven.com/a/fern_02', license: 'CC0-1.0' },
}
