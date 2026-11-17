import type { Vec3 } from './types.ts'

/** Point-light candela for requested illuminance at metres d. All set dimensions are metres. */
export function practicalIntensity(source: Vec3, subject: Vec3, lux: number) {
  const distance = Math.hypot(...source.map((value, i) => value - subject[i]))
  if (!Number.isFinite(distance) || !Number.isFinite(lux) || !(lux >= 0) || distance < 0.03) throw new Error('Invalid practical light placement')
  return lux * distance * distance
}
