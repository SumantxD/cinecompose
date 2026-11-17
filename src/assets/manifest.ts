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
