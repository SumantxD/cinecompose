import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { LIBRARY_DEFINITIONS } from '../src/characters/motion-pack.ts'

const source = process.argv[2] ? path.resolve(process.argv[2]) : '/tmp/kaali-animation-source'
const out = path.resolve(process.argv[3] || 'public/animations/kaali-raat-cc0.glb')
globalThis.FileReader ??= class {
  result = null
  onloadend = null
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.() }
}
const loader = new GLTFLoader(), exporter = new GLTFExporter()
const external = LIBRARY_DEFINITIONS.filter(entry => entry.sourceClip)
assert.equal(external.length, 35, 'The catalog declares 35 external clips')
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const byName = new Map(fs.readdirSync(path.join(source, 'GLB')).filter(name => name.endsWith('.glb')).map(name => [slug(path.basename(name, '.glb')), name]))
assert.equal(byName.size, 35, 'The source archive must contain 35 GLB clips')
let skeleton
const animations = [], metadata = []
for (const entry of external) {
  const filename = byName.get(slug(entry.sourceClip))
  assert.ok(filename, `Missing source clip: ${entry.sourceClip}`)
  const input = await loader.parseAsync(fs.readFileSync(path.join(source, 'GLB', filename)).buffer, '')
  assert.equal(input.animations.length, 1, `${filename} must have exactly one clip`)
  const clip = input.animations[0]
  assert.ok(clip.duration > 0 && clip.duration <= 120)
  for (const track of clip.tracks) assert.ok(track.times.length && track.values.every(Number.isFinite), `${filename}: invalid track`)
  if (!skeleton) {
    skeleton = input.scene
    skeleton.getObjectByName('pelvis') || assert.fail('Missing pelvis in source skeleton')
    const remove = []
    skeleton.traverse(node => { if (node.isMesh) remove.push(node) })
    remove.forEach(node => node.removeFromParent())
    skeleton.name = 'KinemIQ_CC0_Humanoid'
  }
  clip.name = entry.sourceClip
  animations.push(clip)
  metadata.push({ id: entry.id, name: entry.name, sourceFile: `GLB/${filename}`, clip: clip.name, duration: clip.duration })
}
const buffer = await exporter.parseAsync(skeleton, { binary: true, animations, onlyVisible: false })
assert.ok(buffer instanceof ArrayBuffer)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, Buffer.from(buffer))
fs.writeFileSync('src/characters/animation-source.ts', '// Generated from KinemIQ CC0 v1.0; see public/CREDITS.md.\nexport default ' + JSON.stringify(metadata, null, 2) + ' as const\n')
fs.writeFileSync(out.replace(/\.glb$/, '.meta.json'), JSON.stringify({ source: 'https://github.com/Kinemiq/free-game-animations/releases/tag/v1.0', version: '1.0', authors: ['Quaternius', 'KinemIQ'], license: 'CC0-1.0', licenseUrl: 'https://raw.githubusercontent.com/Kinemiq/free-game-animations/main/LICENSE', omitted: 'Mannequin mesh; only the shared transform hierarchy and animation tracks are bundled.', fps: 30, clips: metadata }, null, 2))
const check = await loader.parseAsync(buffer, '')
assert.equal(check.animations.length, 35)
console.log(`${path.relative(process.cwd(), out)}: ${Buffer.byteLength(Buffer.from(buffer))} bytes, 35 clips; official GLTFLoader round-trip passed`)
