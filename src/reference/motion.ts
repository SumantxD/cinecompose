import type { ReferenceMotion } from './compose.ts'

const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b)
  return ordered.length ? ordered[Math.floor(ordered.length / 2)] : 0
}

/** Coarse 4px block matching. The confidence is evidence strength, not 3D certainty. */
export function dominantFlow(from: Uint8Array, to: Uint8Array, width: number, height: number) {
  const tracked: { dx: number; dy: number; x: number; y: number; confidence: number }[] = []
  let blocks = 0
  const pixel = (data: Uint8Array, x: number, y: number) => data[y * width + x]
  for (let cy = 20; cy < height - 24; cy += 16) for (let cx = 8; cx < width - 8; cx += 12) {
    let variance = 0, zero = 0
    for (let by = 0; by < 4; by += 2) for (let bx = 0; bx < 4; bx += 2) {
      const a = pixel(from, cx + bx, cy + by)
      variance += Math.abs(a - pixel(from, cx + bx + 2, cy + by)) + Math.abs(a - pixel(from, cx + bx, cy + by + 2))
      zero += Math.abs(a - pixel(to, cx + bx, cy + by)) / 16
    }
    if (variance < 32 || zero < 2) continue
    blocks++
    let best = zero, dx = 0, dy = 0
    for (let sy = -2; sy <= 2; sy++) for (let sx = -2; sx <= 2; sx++) {
      let difference = 0
      for (let by = 0; by < 4; by += 2) for (let bx = 0; bx < 4; bx += 2) difference += Math.abs(pixel(from, cx + bx, cy + by) - pixel(to, Math.max(0, Math.min(width - 1, cx + bx + sx)), cy + by + sy)) / 16
      if (difference < best) { best = difference; dx = sx; dy = sy }
    }
    const confidence = (zero - best) / Math.max(8, zero)
    if (confidence > .12) tracked.push({ dx, dy, x: cx - width / 2, y: cy - height / 2, confidence })
  }
  if (tracked.length < 4) return { x: 0, y: 0, zoom: 0, confidence: 0 }
  const x = median(tracked.map((point) => point.dx)), y = median(tracked.map((point) => point.dy))
  const numerator = tracked.reduce((sum, p) => sum + (p.dx - x) * p.x + (p.dy - y) * p.y, 0)
  const denominator = tracked.reduce((sum, p) => sum + p.x ** 2 + p.y ** 2, 0)
  return {
    x, y, zoom: numerator / Math.max(1, denominator),
    confidence: Math.min(.95, tracked.length / Math.max(1, blocks) * median(tracked.map((point) => point.confidence))),
  }
}

export function summarizeMotion(pairs: ReturnType<typeof dominantFlow>[], fps: number, width: number, height: number): ReferenceMotion {
  if (!pairs.length) return { x: 0, y: 0, zoom: 0, confidence: 0 }
  return {
    x: pairs.map((pair) => pair.x * fps / width).sort((a, b) => a - b)[Math.floor(pairs.length / 2)],
    y: pairs.map((pair) => pair.y * fps / height).sort((a, b) => a - b)[Math.floor(pairs.length / 2)],
    zoom: Math.log(Math.max(.75, 1 + median(pairs.map((pair) => pair.zoom)))) * fps,
    confidence: median(pairs.map((pair) => pair.confidence)),
  }
}
