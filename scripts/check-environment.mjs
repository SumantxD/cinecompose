import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validateScene } from '../src/cinematic/validate.ts'

const base = JSON.parse(fs.readFileSync('src/scenes/railway-crossing/p1_car.json', 'utf8'))
const effects = [
  { id: 'storm', type: 'lightning', at: 1, duration: 5, intensity: 1, seed: 4, position: [0, 0, -10] },
  { id: 'funnel', type: 'tornado', at: 0, duration: 9, intensity: 1, position: [3, 0, -15], radius: 2, height: 14, seed: 5 },
  { id: 'rumble', type: 'earthquake', at: 1, duration: 3, intensity: 0.8, frequency: 10 },
  { id: 'water', type: 'flood', at: 0, duration: 8, intensity: 1, level: 1.2, color: '#182c33' },
]

assert.deepEqual(validateScene(base), [], 'Existing story scenes must remain valid with no effects')
assert.deepEqual(validateScene({ ...base, effects }), [], 'Every editor-created effect must validate')
assert(validateScene({ ...base, effects: [effects[0], effects[0]] }).some((e) => e.includes('effect ids must be unique')))
assert(validateScene({ ...base, effects: [{ ...effects[0], type: 'meteor' }] }).some((e) => e.includes('unknown type')))
assert(validateScene({ ...base, effects: [{ ...effects[1], position: [0, 0] }] }).some((e) => e.includes('position')))
assert(validateScene({ ...base, effects: [{ ...effects[0], at: -1 }] }).some((e) => e.includes('non-negative at')))
assert(validateScene({ ...base, effects: [{ ...effects[3], level: 40 }] }).some((e) => e.includes('level')))
console.log('✓ environment effects: opt-in scenes, all effect types, validation and bounds')
