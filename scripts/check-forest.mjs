import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { SCENE_MODELS } from '../src/assets/manifest.ts'
import { forestLayout, forestHeightAt, DEFAULT_RELIEF, SOIL_SINK } from '../src/scenes/reference-forest/layout.ts'
import { validateScene } from '../src/cinematic/validate.ts'

function glb(file) {
  const bytes = fs.readFileSync(file)
  const length = bytes.readUInt32LE(12)
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + length).toString()) }
}
const provenance = JSON.parse(fs.readFileSync('public/models/forest/provenance.json', 'utf8'))
const credits = fs.readFileSync('public/CREDITS.md', 'utf8')
for (const [id, source] of Object.entries(SCENE_MODELS)) {
  const { bytes, json } = glb(`public${source.file}`)
  const record = provenance.models[id]
  assert.equal(source.license, 'CC0-1.0')
  assert.equal(record.license, 'CC0 1.0')
  assert.equal(record.source, source.source)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, `${id}: provenance hash mismatch`)
  assert(credits.includes(source.file.slice(1)), `${id}: credit is required`)
  assert.equal(bytes.subarray(0, 4).toString(), 'glTF')
  assert.equal(json.asset.version, '2.0')
  const triangles = json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, p) => n + (json.accessors[p.indices] ?? json.accessors[p.attributes.POSITION]).count / 3, 0), 0)
  assert(triangles > 500 && triangles <= 100_000, `${id}: unexpected triangle budget ${triangles}`)
  if (id === 'tree_small_02') assert(triangles <= 18_000, 'Distant tree LOD exceeded its budget')
}

const textures = JSON.parse(fs.readFileSync('public/textures/forest_ground_04/provenance.json', 'utf8'))
for (const map of textures.maps) {
  const bytes = fs.readFileSync(`public/${map.file}`)
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF')
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), map.sha256)
}
assert(credits.includes('forest_ground_04') && credits.includes('fern_02') && credits.includes('tree_small_02_billboard.webp'))

const settings = { seed: 47, density: .86, textureScale: 42, normalStrength: .85, relief: DEFAULT_RELIEF, wetness: .38, wind: .6, mist: .095, puddles: true }
const localHeights = Array.from({ length: 49 }, (_, i) => [i % 7 - 3, 10 + Math.floor(i / 7) - 3])
const flatHeights = localHeights.map(([x, z]) => forestHeightAt(x, z, settings.seed, 0))
const bumpedHeights = localHeights.map(([x, z]) => forestHeightAt(x, z, settings.seed))
assert(Math.max(...bumpedHeights) - Math.min(...bumpedHeights) > .15, 'Terrain needs visible, non-hill relief')
assert(bumpedHeights.every((y, i) => Math.abs(y - flatHeights[i]) > .001), 'Relief must change the physical surface, not only the material')
console.log('Local terrain span (6 × 6 m sample):', (Math.max(...bumpedHeights) - Math.min(...bumpedHeights)).toFixed(3), 'm')
const high = forestLayout(settings), low = forestLayout(settings, true)
assert.deepEqual(high, forestLayout(settings), 'Forest placement must be deterministic')
assert(low.trees.length < high.trees.length, 'Performance profile must reduce vegetation work')
for (const placement of [...high.trees, ...high.ferns]) {
  assert(placement.height > .2 && placement.height < 18)
  assert(Number.isFinite(forestHeightAt(placement.x, placement.z, settings.seed)))
  assert.equal(placement.y, forestHeightAt(placement.x, placement.z, settings.seed, settings.relief) - SOIL_SINK)
}
const scene = JSON.parse(fs.readFileSync('src/scenes/reference-forest/reference_forest.json', 'utf8'))
assert.deepEqual(validateScene(scene), [])
assert.equal(scene.cues.find((cue) => cue.at === 0 && cue.action === 'fade')?.to, 0, 'The reference forest opening must fade in rather than cover a seek with blackout')
for (const shot of scene.shots) for (const point of [shot.from, shot.to].filter(Boolean)) {
  assert(point[1] - forestHeightAt(point[0], point[2], settings.seed, settings.relief) > .7, `${shot.id}: camera is too close to the terrain`)
  assert(!high.trees.some((tree) => Math.hypot(tree.x - point[0], tree.z - point[2]) < 4), `${shot.id}: camera intersects a tree's placement corridor`)
}
const invalid = { ...scene, props: { ...scene.props, forest: { ...settings, density: -1 } } }
assert(validateScene(invalid).some((error) => error.includes('forest.density')), 'Invalid forest values must be rejected')
const oldSavedSettings = { ...settings }
delete oldSavedSettings.relief
assert.deepEqual(validateScene({ ...scene, props: { ...scene.props, forest: oldSavedSettings } }), [], 'Old saved forests must still load')
assert.deepEqual(forestLayout(oldSavedSettings), high, 'Missing relief must use the documented default')
assert(validateScene({ ...scene, props: { ...scene.props, forest: { ...settings, relief: .61 } } }).some((error) => error.includes('forest.relief')), 'Invalid relief must be rejected')
console.log('✓ reference forest: verified assets, bounded relief, grounded props and clear cameras')
