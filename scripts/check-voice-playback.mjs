import assert from 'node:assert/strict'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { connect } from './browser-audit.mjs'
import { VOICES } from '../src/audio/voices.ts'
if (!VOICES.part1_opening_hi) throw new Error('The provisional Hindi narration asset is not assigned.')
const requestedOut = process.argv[2]
const out = requestedOut ? resolve(requestedOut) : fs.mkdtempSync(join(tmpdir(), 'kaali-voice-story-proof-'))
if (requestedOut && fs.existsSync(out)) throw new Error('Keep previous voice evidence')
fs.mkdirSync(out, { recursive: true })
const base = process.env.KR_DEV_URL ?? 'http://localhost:5173/?start=part1'
const c = await connect('kaali-voice-check', base, true)
const errors = []
const report = {}
c.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text))
try {
  await c.call('Runtime.enable')
  await c.call('Page.enable')
  await c.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await c.until('document.querySelector(".gate") && !document.querySelector(".gate").disabled', 'Episode ready')
  await c.click('.gate')
  await c.until('!document.querySelector(".gate")', 'Episode starts')
  await c.until('kr.getVoiceState().playing', 'Baked narrator starts through the real entry gesture')
  const audio = async () => c.evaluate(`(()=>{const h=Howler._howls.find(x=>x._src.includes('/audio/vo/part1_opening_hi.wav'));return {state:kr.getVoiceState(),duration:h?.duration(),loaded:h?.state(),seek:h?.seek(),src:h?._src,caption:document.querySelector('.caption')?.textContent}})()`)
  report.started = await audio()
  assert.equal(report.started.state.id, 'p1_car/3/part1_opening_hi')
  assert.equal(report.started.loaded, 'loaded')
  assert.equal(report.started.state.ducked, true)
  assert(Math.abs(report.started.duration - VOICES.part1_opening_hi.duration) <= 0.035)
  assert(Math.abs(report.started.state.offset - report.started.seek) < 0.08)
  assert(report.started.caption.includes('रात के ठीक दो बजकर सत्रह मिनट हो रहे हैं।'))
  await c.screenshot(`${out}/narrator-playing.png`)

  await c.evaluate('kr.setPaused(true)')
  report.paused = await audio()
  await c.wait(600)
  const afterPause = await audio()
  assert.equal(report.paused.state.playing, false)
  assert.equal(afterPause.state.playing, false)
  assert(Math.abs(report.paused.state.offset - afterPause.state.offset) < 1e-9)
  report.pauseOffset = afterPause.state.offset
  await c.evaluate('kr.setPaused(false)')
  await c.until('kr.getVoiceState().playing', 'Voice resumes')
  report.resumed = await audio()
  assert(Math.abs(report.resumed.state.offset - report.pauseOffset) < 0.2)
  assert(Math.abs(report.resumed.state.offset - report.resumed.seek) < 0.08)

  report.seek = await c.evaluate(`(()=>{kr.start('part1');kr.skip(3.7);const h=Howler._howls.find(x=>x._src.includes('/audio/vo/part1_opening_hi.wav'));return {state:kr.getVoiceState(),duration:h?.duration(),loaded:h?.state(),seek:h?.seek(),src:h?._src,caption:document.querySelector('.caption')?.textContent}})()`)
  assert(Math.abs(report.seek.state.offset - 0.7) < 0.025)
  assert(Math.abs(report.seek.state.offset - report.seek.seek) < 0.08)

  await c.evaluate('kr.setPaused(true)')
  await c.evaluate(`(async()=>{const episode=(await import('/src/story/episode-001.ink')).default;const {StoryEngine}=await import('/src/story/StoryEngine.ts');const e=new StoryEngine(episode);e.start('part1');const beat=e.next();window.__voiceFilmBefore=JSON.stringify(kr.scene);kr.previewScene(kr.scene,4.4,beat.lines)})()`)
  await c.wait(700)
  report.scrub = await audio()
  assert.equal(report.scrub.state.playing, false)
  assert.equal(report.scrub.state.id, undefined)
  assert.equal(report.scrub.caption.includes('रात के ठीक दो बजकर सत्रह मिनट हो रहे हैं।'), true)
  assert.equal(await c.evaluate('JSON.stringify(kr.scene) === window.__voiceFilmBefore'), true)
  await c.evaluate('kr.setPaused(false)')
  await c.until('kr.getVoiceState().playing', 'Seek resumes at the correct offset')
  report.scrubResume = await audio()
  assert(Math.abs(report.scrubResume.state.offset - 1.4) < 0.3)
  assert(Math.abs(report.scrubResume.state.offset - report.scrubResume.seek) < 0.08)

  await c.call('Page.navigate', { url: base })
  await c.wait(1200)
  let held = false
  c.on('Fetch.requestPaused', event => { held = event.requestId })
  await c.call('Fetch.enable', { patterns: [{ urlPattern: '*part1_opening_hi.wav', requestStage: 'Request' }] })
  await c.until('document.querySelector(".gate") && !document.querySelector(".gate").disabled', 'Fresh episode ready')
  await c.click('.gate')
  await c.until('kr.getVoiceState().id === "p1_car/3/part1_opening_hi"', 'Uncached voice request begins')
  await c.wait(150)
  assert(held, 'Voice request is deliberately held')
  report.pending = await audio()
  report.pending.requestHeld = true
  assert.equal(report.pending.state.playing, false)
  await c.evaluate(`(async()=>{kr.setPaused(true);const cfg=await fetch('/src/scenes/railway-crossing/p1_road.json').then(r=>r.json());kr.previewScene(cfg,0,[])})()`)
  await c.call('Fetch.continueRequest', { requestId: held })
  await c.call('Fetch.disable')
  await c.wait(1200)
  report.cancelled = await audio()
  assert.equal(report.cancelled.state.playing, false)
  assert.equal(report.cancelled.state.ducked, false)
  assert.equal(report.cancelled.state.id, undefined)
  assert.equal(errors.length, 0, errors.join('\n'))
  report.errors = errors
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`Voice evidence: ${out}`)
} finally {
  fs.writeFileSync(`${out}/runtime-errors.json`, JSON.stringify(errors, null, 2))
  await c.call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {})
  await c.call('Emulation.clearDeviceMetricsOverride').catch(() => {})
  c.close()
}
