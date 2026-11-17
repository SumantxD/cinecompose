import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { SURFACES } from '../src/assets/manifest.ts'
import { VOICES } from '../src/audio/voices.ts'

for (const [kind, asset] of Object.entries(SURFACES)) {
  assert.equal(asset.license, 'CC0-1.0', `${kind}: verified license required`)
  assert.equal(asset.optimized, true)
  assert.equal(asset.linearMean.length, 3)
  assert(asset.linearMean.every(mean => Number.isFinite(mean) && mean > 0 && mean < 0.55))
  assert.equal(asset.resolution, '1K')
  for (const channel of Object.values(asset.maps)) {
    const file = `public/textures/${asset.id}/${channel}.webp`
    const bytes = fs.readFileSync(file)
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${file}: unexpected format`)
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${file}: unexpected format`)
    assert(bytes.length > 1000, `${file}: empty or truncated`)
  }
}
const credits = fs.readFileSync('public/CREDITS.md', 'utf8')
assert(credits.includes('Poly Haven') && credits.includes('KinemIQ'))
for (const file of ['public/textures/POLY-HAVEN-LICENSE.txt', 'public/textures/provenance.json', 'public/animations/KinemIQ-CC0-LICENSE.txt']) {
  assert(fs.statSync(file).size > 0, `Missing license/provenance: ${file}`)
}
const fonts = JSON.parse(fs.readFileSync('public/fonts/provenance.json', 'utf8'))
assert.equal(fonts.fonts.length, 4)
for (const font of fonts.fonts) {
  const data = fs.readFileSync(`public/fonts/${font.file}`)
  assert.equal(data.length, font.bytes, `${font.file}: size mismatch`)
  assert.equal(createHash('sha256').update(data).digest('hex'), font.sha256, `${font.file}: source hash mismatch`)
  assert([0x00010000, 0x4f54544f].includes(data.readUInt32BE(0)), `${font.file}: unexpected font format`)
  assert.equal(font.license, 'OFL-1.1')
  assert(fs.statSync(`public/fonts/${font.licenseFile}`).size > 1000)
}
assert(credits.includes('Cormorant') && credits.includes('Tiro Devanagari Hindi') && credits.includes('OFL'))
assert(!fs.readFileSync('index.html', 'utf8').includes('fonts.googleapis.com'))

const voiceSource = JSON.parse(fs.readFileSync('public/audio/vo/provenance.json', 'utf8'))
assert.equal(voiceSource.synthetic, true)
assert.equal(voiceSource.model.sourceLicense, 'apache-2.0')
assert.equal(voiceSource.clips.length, Object.keys(VOICES).length)
for (const clip of voiceSource.clips) {
  assert.match(clip.id, /^[a-z0-9_-]{1,64}$/)
  assert.equal(clip.file, `${clip.id}.wav`)
  assert.equal(VOICES[clip.id]?.src, `/audio/vo/${clip.file}`)
  assert.equal(VOICES[clip.id].duration, clip.durationSeconds)
  assert((VOICES[clip.id].volume ?? 0.75) <= 0.8)
  const data = fs.readFileSync(`public/audio/vo/${clip.file}`)
  assert.equal(data.length, clip.bytes, `${clip.id}: file size`)
  assert.equal(createHash('sha256').update(data).digest('hex'), clip.sha256, `${clip.id}: file hash`)
  assert.equal(data.subarray(0, 4).toString('ascii'), 'RIFF', `${clip.id}: WAV required`)
  assert.equal(data.subarray(8, 12).toString('ascii'), 'WAVE', `${clip.id}: WAV required`)
}
const voiceLicense = fs.readFileSync('public/audio/vo/KOKORO-APACHE-2.0.txt', 'utf8')
assert(voiceLicense.includes('Apache License') && voiceLicense.includes('Version 2.0, January 2004'))
assert(credits.includes('Kokoro-82M'))
assert(credits.includes('hm_omega'))

console.log('✓ appearance assets: local 1K maps, verified fonts, verified-license records and source provenance')
