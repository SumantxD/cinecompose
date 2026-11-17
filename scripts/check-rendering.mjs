import assert from 'node:assert/strict'
import * as THREE from 'three'
import { RENDER_PROFILES, applyShadowBudget, applyTextureQuality, resolveRenderSettings, validateRenderSettings } from '../src/cinematic/rendering.ts'
import { validateScene } from '../src/cinematic/validate.ts'

for (const name of ['ultra', 'high', 'performance']) {
  const profile = RENDER_PROFILES[name]
  assert.deepEqual(resolveRenderSettings(profile), profile)
  assert.deepEqual(validateRenderSettings(profile), [])
  assert.equal(profile.antialias, 'smaa')
  assert(profile.textureAnisotropy >= 1)
  assert(profile.renderScale <= 2)
}
assert.equal(resolveRenderSettings().ao.enabled, false)
assert.equal(resolveRenderSettings().antialias, 'none')
assert.deepEqual(resolveRenderSettings().grade, { saturation: -0.22, contrast: 0.08 })
assert.equal(resolveRenderSettings({ bloom: { intensity: 0.2 } }).bloom.intensity, 0.2)
assert(validateRenderSettings({ ao: { radius: -1 } }).length)
assert(validateRenderSettings({ renderScale: 4 }).length)
assert.equal(validateRenderSettings({ environment: { hdri: 'moonless_golf', intensity: 0.35, rotation: 45 } }).length, 0)
assert(validateRenderSettings({ environment: { hdri: 'remote-url', intensity: 0.35, rotation: 0 } }).length)
const scene = JSON.parse('{"sceneId":"render_test","environment":"void","duration":1,"shots":[],"lighting":{"ambientIntensity":1,"fogDensity":0.02},"audio":{"ambience":[],"music":null},"cues":[]}')
scene.shots = [{ id: 'hold', type: 'static', duration: 1, from: [0, 1, 0], lookAt: [0, 1, -3], fov: 40 }]
scene.rendering = { ...RENDER_PROFILES.high }
assert.deepEqual(validateScene(scene), [])
const meshes = new THREE.Group()
const light = new THREE.SpotLight()
meshes.add(light)
light.shadow.map = new THREE.WebGLRenderTarget(256, 256)
applyShadowBudget(meshes, resolveRenderSettings({ ...RENDER_PROFILES.performance }))
assert.equal(light.shadow.map, null)
assert.equal(light.shadow.mapSize.width, 512)
const texture = new THREE.Texture()
const material = new THREE.MeshStandardMaterial({ map: texture })
meshes.add(new THREE.Mesh(new THREE.BoxGeometry(), material))
applyTextureQuality(meshes, RENDER_PROFILES.ultra, 4)
assert.equal(texture.anisotropy, 4)
assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter)
assert.equal(texture.magFilter, THREE.LinearFilter)
texture.dispose()
console.log('✓ rendering profiles, settings validation, textures and shadow-budget release')
