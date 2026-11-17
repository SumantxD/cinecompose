import assert from 'node:assert/strict'
import fs from 'node:fs'
import { connect } from './browser-audit.mjs'

const [urlArg, outArg, answersArg = '0,1,0,1,0,1'] = process.argv.slice(2)
if (!urlArg || !outArg) throw new Error('Usage: node scripts/play-episode.mjs <url> <fresh-output> <answersCsv> [--retry-death]')
if (fs.existsSync(`${outArg}/report.json`)) throw new Error(`Refusing to overwrite evidence: ${outArg}`)
fs.mkdirSync(outArg, { recursive: true })
const url = `${urlArg}${urlArg.includes('?') ? '&' : '?'}start=part1`
const answers = answersArg.split(',').map(Number)
assert(answers.every(n => Number.isInteger(n) && n >= 0), 'Choices must be non-negative integer indices')
const retryDeath = process.argv.includes('--retry-death')
const client = await connect('kaali-story-playthrough', url)
const runtimeErrors = []
const consoleErrors = []
const choices = []
let outcome = 'unfinished'
let position = 0
let error
client.on('Runtime.exceptionThrown', e => runtimeErrors.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text))
client.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') consoleErrors.push(e.args.map(a => a.value || a.description).join(' ')) })
const options = () => client.evaluate(`Array.from(document.querySelectorAll('.choices button.choice')).map(button => ({ text: button.textContent, disabled: button.disabled, y: button.getBoundingClientRect().y, height: button.getBoundingClientRect().height }))`)
const phase = () => client.evaluate(`document.querySelector('.ended') ? 'ended' : document.querySelector('.dead') ? 'dead' : document.querySelector('.choices') ? 'choice' : 'playing'`)
const scene = () => client.evaluate(`typeof kr !== 'undefined' ? kr.scene?.sceneId ?? null : null`)
const waitNext = async () => {
  const deadline = Date.now() + 180000
  while (await phase() === 'playing') {
    if (Date.now() > deadline) throw new Error('No decision or ending after 180 seconds')
    await client.wait(200)
  }
}
try {
  await client.call('Runtime.enable')
  await client.call('Page.enable')
  const navigated = new Promise(resolve => client.on('Page.frameNavigated', e => { if (!e.frame.parentId) resolve(e) }))
  await client.call('Page.navigate', { url })
  await navigated
  await client.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await client.until(`document.querySelector('.gate-cta') && !document.querySelector('.gate-cta').textContent.includes('…')`, 'ready gate')
  await client.click('.gate-cta')
  await client.wait(250)
  const accelerated = await client.evaluate(`typeof kr !== 'undefined' && typeof kr.skip === 'function'`)
  assert(!process.argv.includes('--production') || !accelerated, 'Production verification must not expose development controls')
  if (accelerated) await client.evaluate(`kr.setPaused(false);kr.skip(120);kr.setPaused(true)`)
  await client.until(`document.querySelector('.choices .choice') || document.querySelector('.ended') || document.querySelector('.dead')`, 'first playable decision', 600)
  if (await client.evaluate(`!!document.querySelector('button[aria-label="Mute"]')`)) await client.click('button[aria-label="Mute"]')
  for (let turn = 0; turn < 16; turn++) {
    const state = await phase()
    if (state === 'ended' || state === 'dead') {
      outcome = state
      await client.screenshot(`${outArg}/${outcome}.png`)
      break
    }
    let available = await options()
    if (!available.length) {
      await client.until(`document.querySelectorAll('.choices .choice').length > 0`, 'rendered decision buttons', 600)
      available = await options()
    }
    console.log('OPTIONS', await scene(), available.map(option => option.text))
    const pick = answers[position++]
    if (pick === undefined) throw new Error(`Answers exhausted at: ${JSON.stringify(available)}`)
    const label = available[pick]?.text
    assert(label, `Choice ${pick} missing: ${available.map(option => option.text).join(' | ')}`)
    assert(available[pick].height >= 56, 'Touch choice must stay at least 56px high')
    choices.push({ scene: await scene(), options: available.map(option => option.text), pick, label })
    console.log('CHOICE', choices.at(-1).scene, pick, label)
    await client.screenshot(`${outArg}/decision-${choices.length}.png`)
    if (accelerated) await client.evaluate('kr.setPaused(true)')
    await client.click(`.choices button.choice:nth-child(${pick + 1})`)
    await client.wait(300)
    if (accelerated) await client.evaluate(`kr.setPaused(false);kr.skip(100);kr.setPaused(true)`)
    await waitNext()
  }
  if (outcome === 'dead' && retryDeath) {
    if (accelerated) await client.evaluate('kr.setPaused(true)')
    await client.click('.dead-options button.choice')
    await client.wait(300)
    if (accelerated) await client.evaluate(`kr.setPaused(false);kr.skip(100);kr.setPaused(true)`)
    await waitNext()
    for (const pick of answers.slice(position)) {
      const available = await options()
      assert(available[pick], `Retry choice missing: ${JSON.stringify({ available, pick, scene: await scene() })}`)
      choices.push({ scene: await scene(), pick, label: available[pick].text, retry: true })
      console.log('RETRY_CHOICE', choices.at(-1).scene, pick, available[pick].text)
      if (accelerated) await client.evaluate('kr.setPaused(true)')
      await client.click(`.choices button.choice:nth-child(${pick + 1})`)
      await client.wait(300)
      if (accelerated) await client.evaluate(`kr.setPaused(false);kr.skip(100);kr.setPaused(true)`)
      await waitNext()
    }
    outcome = await phase()
    await client.screenshot(`${outArg}/${outcome}.png`)
  }
  assert.equal(outcome, 'ended', `Story did not finish: ${outcome}; decisions: ${JSON.stringify(choices)}`)
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join('\n'))
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'))
  console.log('ENDED', await scene(), choices.map(choice => choice.label).join(' → '))
} catch (caught) {
  error = String(caught)
  process.exitCode = 1
  console.error(error)
} finally {
  fs.writeFileSync(`${outArg}/report.json`, JSON.stringify({ outcome, answers, choices, runtimeErrors, consoleErrors, error, lastScene: await scene().catch(() => null), accelerated: await client.evaluate('typeof kr !== "undefined" && typeof kr.skip === "function"').catch(() => false) }, null, 2))
  await client.call('Emulation.clearDeviceMetricsOverride').catch(() => {})
  client.close()
}
