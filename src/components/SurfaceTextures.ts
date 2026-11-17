import * as THREE from 'three'
import { SURFACES, type SurfaceKind } from '../assets/manifest.ts'

const materials: Partial<Record<SurfaceKind, Set<THREE.MeshStandardMaterial>>> = {}
const pending = new Map<SurfaceKind, Promise<void>>()
const images = new Map<string, Promise<THREE.Texture>>()
type Prepared = Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap'>
const baseTints = new WeakMap<THREE.MeshStandardMaterial, THREE.Color>()
const referenceAlbedo = 0.55
function applySurface(kind: SurfaceKind, material: THREE.MeshStandardMaterial, pack: Prepared) {
  const tint = baseTints.get(material) ?? material.color.clone()
  if (!baseTints.has(material)) baseTints.set(material, tint)
  material.map = pack.map
  material.normalMap = pack.normalMap
  material.normalScale.setScalar(kind === 'plaster' ? 0.65 : 0.38)
  material.roughnessMap = pack.roughnessMap
  // Restore the procedural base tint's mean reflectance without brightening scene lights.
  material.color.copy(tint)
  for (const channel of ['r', 'g', 'b'] as const) material.color[channel] = tint[channel] * referenceAlbedo / SURFACES[kind].linearMean[['r', 'g', 'b'].indexOf(channel)]
  material.needsUpdate = true
}
const prepared = new Map<SurfaceKind, Prepared>()
const loader = typeof document === 'undefined' ? undefined : new THREE.TextureLoader()
const status: { loaded: SurfaceKind[]; errors: string[] } = { loaded: [], errors: [] }
export const getSurfaceStatus = () => ({ ...status, loaded: [...status.loaded], errors: [...status.errors] })

export function registerSurfaceMaterial(kind: SurfaceKind, material: THREE.MeshStandardMaterial) {
  ;(materials[kind] ??= new Set()).add(material)
  const pack = prepared.get(kind)
  if (pack) applySurface(kind, material, pack)
}

function texture(url: string, srgb: boolean, reference: THREE.Texture): Promise<THREE.Texture> {
  const key = `${url}:${reference.repeat.x},${reference.repeat.y}`
  let pending = images.get(key)
  if (!pending) {
    pending = new Promise<THREE.Texture>((resolve, reject) => loader!.load(url, result => {
      result.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      result.wrapS = result.wrapT = THREE.RepeatWrapping
      result.repeat.copy(reference.repeat)
      result.anisotropy = 4
      resolve(result)
    }, undefined, () => reject(new Error(`Texture failed: ${url}`))))
    images.set(key, pending)
  }
  return pending
}

/** Each actor/set requests only the kinds it uses; Character Lab loads none of these surfaces. */
export function loadSurfacePack(kinds: SurfaceKind[] = ['plaster', 'wood', 'denim']) {
  if (typeof document === 'undefined') return Promise.resolve()
  return Promise.all(Object.entries(SURFACES).map(async ([key, definition]) => {
    const kind = key as SurfaceKind
    if (!kinds.includes(kind)) return
    if (pending.has(kind)) return pending.get(kind)
    const promise = (async () => {
      const material = [...(materials[kind] ?? [])][0]
      if (!material) throw new Error(`No surface material registered: ${kind}`)
      const reference = material.map!
      const [color, normal, roughness] = await Promise.all([
        texture(`/textures/${definition.id}/color.webp`, true, reference),
        texture(`/textures/${definition.id}/normal.webp`, false, reference),
        texture(`/textures/${definition.id}/roughness.webp`, false, reference),
      ])
      prepared.set(kind, { map: color, normalMap: normal, roughnessMap: roughness })
      for (const material of materials[kind] ?? []) applySurface(kind, material, { map: color, normalMap: normal, roughnessMap: roughness })
      status.loaded.push(kind)
    })().catch(error => {
      status.errors.push(error instanceof Error ? error.message : String(error))
      if (import.meta.env.DEV) console.warn(`Surface pack fallback: ${status.errors.at(-1)}`)
    })
    pending.set(kind, promise)
    return promise
  })).then(() => undefined)
}
