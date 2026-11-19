import assert from 'node:assert/strict'
import fs from 'node:fs'
import { choreographScene, parseOutline, validateChoreography, DEFAULT_OUTLINE, inkOutline } from '../src/cinematic/choreography.ts'
import { validateScene } from '../src/cinematic/validate.ts'
import { reconcileReferenceFrames } from '../src/reference/compose.ts'

const outline = 'Generator room. The clock stops. A silhouette appears on one monitor. Stop the tape.'
const cfg = choreographScene('choreography_runnable_test', outline, {}, undefined)
assert.deepEqual(parseOutline(outline).map((b) => b.role), ['hook', 'detail', 'reveal', 'decision'])
assert.deepEqual(cfg.props.choreography.beats.map((b) => b.visual), ['normal', 'clock-stop', 'monitor-figure', 'normal'])
assert.equal(cfg.environment, 'control-room')
assert.equal(validateScene(cfg).join('\n'), '')
for (const shot of cfg.shots) {
  assert.ok(Math.abs(shot.from[0]) < 3.53, `${shot.id} camera must not start inside a side wall`)
  assert.ok(shot.fovPortrait)
}
assert.ok(choreographScene('mirror_test', DEFAULT_OUTLINE, { mirror: true }).shots.every((s, i) => s.from[0] !== cfg.shots[i]?.from[0] || i === 1), 'Mirroring must change meaningful camera placement')
const mirror = choreographScene('mirror_test', outline, { mirror: true })
assert.notDeepEqual(mirror.shots[0].from, cfg.shots[0].from)
assert.equal(validateChoreography({ ...cfg.props.choreography, lens: 40 }).length, 1)
assert.doesNotThrow(() => validateChoreography({ ...cfg.props.choreography, beats: [null] }))
const side = choreographScene('side_signal_test', 'Room. Clock stops. A figure appears on the left monitor. Stop the tape.')
assert.deepEqual(side.props.choreography.beats.map((b) => b.screen), [undefined, undefined, 'left', undefined])
assert.equal(side.shots[2].lookAtTo[0], -3.3, 'A named left monitor must become that shot’s camera target')
assert.ok(Math.abs(side.shots[2].from[0]) < 3.53)
assert.equal(validateChoreography({ ...side.props.choreography, beats: side.props.choreography.beats.map((b, i) => i === 2 ? { ...b, screen: 'ceiling' } : b) }).join('\n'), 'choreography: Beat 3 has an unsupported monitor side.')
const reference = JSON.parse(fs.readFileSync('src/scenes/reference-study/reference_control-room-v1.json', 'utf8'))
assert.equal(validateScene(reference).join('\n'), '')
reference.shots.splice(1, 0, structuredClone(reference.shots[0]))
reconcileReferenceFrames(reference)
reference.duration = reference.shots.reduce((sum, s) => sum + s.duration, 0)
assert.equal(reference.props.referenceStudy.frames.length, reference.shots.length)
assert.equal(validateScene(reference).join('\n'), '')
reference.shots.splice(0, 1)
reconcileReferenceFrames(reference)
reference.duration = reference.shots.reduce((sum, s) => sum + s.duration, 0)
assert.equal(reference.props.referenceStudy.frames.length, reference.shots.length)
assert.equal(validateScene(reference).join('\n'), '')
assert.equal((inkOutline(cfg).match(/# scene:/g) ?? []).length, 1, 'A direction draft must play its multi-beat scene once')
console.log('Choreography: deterministic beats, valid procedural cameras, schema and reference edit reconciliation passed.')
