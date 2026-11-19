import assert from 'node:assert/strict'
import fs from 'node:fs'
import { assertLibrary, compileCues, makeClip, recommendClip, sampleClip, validateCceTrack } from '../src/cce/engine.ts'
import { CCE_CATEGORIES, CCE_TEMPLATES } from '../src/cce/templates.ts'
import { validateScene } from '../src/cinematic/validate.ts'

assert.equal(assertLibrary().join('\n'), '', 'every CCE template must be valid')
assert(CCE_TEMPLATES.length >= 42, 'the initial library should be broad enough to combine')
assert(CCE_CATEGORIES.length === 8, 'all eight choreography categories are present')
assert.equal(new Set(CCE_TEMPLATES.map((template) => template.id)).size, CCE_TEMPLATES.length, 'template ids are unique')

const finiteFrame = (frame) => Object.values(frame).filter((value) => typeof value === 'number').every(Number.isFinite)
for (const template of CCE_TEMPLATES) {
  for (const fraction of [0, .17, .4, .73, 1]) {
    const clip = makeClip(template.id, 2, 0, { text: 'CHECK', entity: 'chudail', light: 'light' })
    const frame = sampleClip(clip, fraction)
    assert(finiteFrame(frame), `${template.id} sampled finite values`)
    assert(Math.abs(frame.dolly) <= 2.001 && Math.abs(frame.roll) <= .1801 && Math.abs(frame.chromatic) <= .0025001, `${template.id} remains bounded`)
  }
}

const sceneFile = fs.readdirSync('src/scenes', { recursive: true }).find((name) => name.endsWith('/p1_turn.json'))
const cfg = JSON.parse(fs.readFileSync(`src/scenes/${sceneFile}`, 'utf8'))
const clip = makeClip('shadow-first', 3.1, 0, { entity: 'chudail', position: [1, 0, -2], intensity: .8, variation: .2 })
const track = { version: 1, clips: [clip, makeClip('impact-close', 5, 1, { intensity: 1.1 })] }
assert.equal(validateCceTrack(track, cfg.duration).join('\n'), '', 'valid track passes validation')
assert.equal(validateCceTrack({ version: 1, clips: [clip, { ...clip }] }, cfg.duration).length > 0, true, 'duplicate clip ids are rejected')
assert.equal(validateCceTrack({ version: 1, clips: [{ ...clip, template: 'not-real' }] }, cfg.duration).length > 0, true, 'unknown templates are rejected')
assert.equal(validateCceTrack({ version: 1, clips: [{ ...clip, at: cfg.duration }] }, cfg.duration).length > 0, true, 'clips must remain within the scene')

assert.equal(validateCceTrack({ version: 1, clips: [{ ...makeClip('impact-word', 0, 0), text: 42 }] }, 5).length > 0, true, 'malformed editorial text is rejected without throwing')

const cues = compileCues(cfg, track)
assert(cues.length >= 4, 'scene-owned cues are compiled for entity/audio layers')
assert.equal(cues.filter((cue) => cue.action === 'entity').length, 4, 'entity cues include their state restoration')
const sceneWithCce = { ...structuredClone(cfg), props: { ...cfg.props, cce: track } }
assert.equal(validateScene(sceneWithCce).join('\n'), '', 'a scene with a CCE track stays valid')
assert(validateScene({ ...sceneWithCce, cues: null }).length > 0, 'malformed scene cues fail validation without crashing')
assert(validateScene({ ...sceneWithCce, shots: [] }).length > 0, 'malformed camera coverage fails validation without crashing')

const a = sampleClip(clip, .62), b = sampleClip(clip, .62)
assert.deepEqual(a, b, 'clip sampling is deterministic')
const jitter = makeClip('tracking-sprint', 0, 0, { variation: 0 })
assert.notDeepEqual(sampleClip(jitter, .4), sampleClip({ ...jitter, seed: jitter.seed + 1 }, .4), 'seed changes motion variation')
assert.equal(recommendClip({ event: 'discovery', intensity: .7, seed: 3, subjectDistance: 4, recent: CCE_TEMPLATES.map((t) => ({ id: t.id, ago: 0 })) }), undefined, 'cooldowns suppress repeats')
assert(recommendClip({ event: 'discovery', intensity: .7, seed: 3, subjectDistance: 4 }), 'events recommend a matching template')

console.log(`CCE checks passed · ${CCE_TEMPLATES.length} templates · ${cues.length} compiled cues · deterministic samples bounded`)
