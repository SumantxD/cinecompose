import assert from 'node:assert/strict'
import { planEnvironment, worldScene, shotViewClearAt } from '../src/world/EnvironmentPlanner.ts'
import { storyToScene } from '../src/world/StoryToScene.ts'
import { analyseImage, imageToScene } from '../src/world/ImageToScene.ts'
import { validateWorld } from '../src/world/types.ts'
import { createTerrain, registerTerrainProfile } from '../src/world/TerrainGenerator.ts'
import { assembly, registerAssembly } from '../src/world/AssetRegistry.ts'
import * as THREE from 'three'

const story = 'An abandoned Indian village with an old temple at the end of the road and a well beside it'
const spec = storyToScene(story, 2009)
assert.deepEqual(validateWorld(spec), [])
assert.deepEqual(storyToScene(story, 2009), spec, 'Same description and seed must reproduce the exact specification')
assert.deepEqual(worldScene('world_test', spec), worldScene('world_test', spec), 'Compilation must be deterministic')
assert.notDeepEqual(storyToScene(story, 2010), spec, 'Different seeds should vary continuous parameters and geometry')
assert.equal(spec.props, undefined)
const compiled = worldScene('world_test', spec)
assert.equal(compiled.shots[0].from[0], spec.camera.position[0])
assert.equal(compiled.shots[0].from[2], spec.camera.position[1])
assert.equal(compiled.shots[0].to[0], spec.camera.position[0])
assert.equal(compiled.shots[0].to[2], spec.camera.position[1] - 2)
const focal = spec.landmarks.find((landmark) => landmark.id === spec.camera.target)
assert.ok(focal)
for (const axis of [0, 2]) assert.equal(compiled.shots[1].lookAt[axis], focal.position[axis === 0 ? 0 : 1])
const overview = compiled.shots[1]
const corridorShot = { ...overview, from: [0, 0, 0], to: [0, 0, 4], lookAt: [0, 0, -20], lookAtTo: [0, 0, -20] }
const sightline = [0, -10]
assert.equal(shotViewClearAt(corridorShot, ...sightline, 7), false)
assert.equal(shotViewClearAt(corridorShot, sightline[0] + 8, sightline[1], 7), true)
assert.equal(shotViewClearAt(corridorShot, corridorShot.lookAt[0], corridorShot.lookAt[2], 7), true)

for (const profile of ['rolling', 'ridged', 'terraced', 'island']) {
  const world = planEnvironment(310 + profile.length, profile, { kind: 'random', description: profile, reconstructed: false, notes: [] })
  assert.deepEqual(validateWorld(world), [], `${profile}: valid specification`)
  const terrain = createTerrain(world)
  assert.equal(terrain.heightAt(2, 4), terrain.heightAt(2, 4))
  assert.ok([...terrain.geometry.attributes.position.array].every(Number.isFinite), `${profile}: invalid terrain vertices`)
  for (const landmark of world.landmarks) assert.ok(terrain.clearAt(...landmark.position) === false, `${profile}: landmark footprint must be clear`)
  for (let i = 0; i < world.landmarks.length; i++) for (let j = 0; j < i; j++) {
    const a = world.landmarks[i].position, b = world.landmarks[j].position
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 3, `${profile}: overlapping landmark footprints`)
  }
  terrain.geometry.dispose()
}

const streamed = planEnvironment(44, 'rolling', { kind: 'random', description: 'forest with brook', reconstructed: false, notes: [] })
const streamGround = createTerrain(streamed)
for (const [x, z] of streamed.routes[1].points) assert.ok(streamGround.heightAt(x, z) < (streamed.routes[1].level ?? 0), 'Streams must be cut into their continuous surface')

registerTerrainProfile('test/continuous-height', (_x, _z, context) => context.relief)
const custom = { ...streamed, terrain: { ...streamed.terrain, profile: 'test/continuous-height' } }
assert.deepEqual(validateWorld(custom), [], 'Custom profiles are data, not a closed biome enum')
assert.ok(Math.abs(createTerrain(custom).heightAt(0, 0) - 3.4) < 1e-9, 'Registered profiles must be used by the compiler')
assert.throws(() => createTerrain({ ...custom, terrain: { ...custom.terrain, profile: 'unregistered' } }), /Unregistered terrain profile/)
registerAssembly('test/procedural-landmark', { footprint: 1, build: () => [{ geometry: new THREE.SphereGeometry(0.5), color: '#555555' }] })
assert.equal(assembly('test/procedural-landmark').build(1)[0].color, '#555555')
assert.throws(() => assembly('not-registered'), /Unregistered world assembly/)
for (const part of assembly('classic/banyan').build(82)) {
  assert.ok(part.geometry.attributes.position.count > 0)
  assert.ok([...part.geometry.attributes.position.array].every(Number.isFinite), 'Tree geometry must be finite')
  part.geometry.dispose()
}

const bad = structuredClone(spec)
bad.terrain.size = 0; bad.landmarks[0].position[0] = Infinity; bad.routes[0].width = -1
assert.ok(validateWorld(bad).length >= 3)

const image = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) }
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const p = (y * 32 + x) * 4
  image.data[p] = y < 13 ? 80 : 45; image.data[p + 1] = y < 13 ? 110 : 85; image.data[p + 2] = y < 13 ? 150 : 35; image.data[p + 3] = 255
}
const analysis = analyseImage(image)
assert.ok(analysis.palette.length > 1 && analysis.vegetationFraction > 0.2, 'Pixel analysis must measure the supplied image, not use a stock palette')
const observed = imageToScene(image, undefined, 54)
assert.equal(observed.source.reconstructed, false)
assert.ok(observed.source.notes.join(' ').includes('No depth analysis was supplied'))
const depth = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) }
for (let i = 0; i < depth.data.length; i += 4) depth.data[i] = 128
const reconstructed = imageToScene(image, { model: 'Depth-Anything-V2-Small', depth }, 54)
assert.equal(reconstructed.image?.observation?.points.length, 96)
assert.ok(reconstructed.source.notes.join(' ').includes('2.5D'))
assert.deepEqual(validateWorld(reconstructed), [], 'Depth observations must be finite and bounded')
assert.notEqual(reconstructed.image?.observation?.model, 'Depth-Anything-V2-Large', 'Noncommercial models are not an allowed dependency')

console.log('World generation checks passed: deterministic specs, 4 height profiles, custom profile/assembly, grounded landmarks, waterways, image analysis and 96 explicit depth samples.')
