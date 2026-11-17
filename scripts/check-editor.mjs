import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { connect } from './browser-audit.mjs'

const origin = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const out = process.argv[3] || `/tmp/cine-editor-audit-${Date.now()}`
assert(!fs.existsSync(out), `Refusing to overwrite ${out}`)
fs.mkdirSync(out); fs.mkdirSync(`${out}/downloads`)
const session = `cine-editor-${Date.now()}`
const watchdog = setTimeout(() => {
  try { execFileSync('agent-browser', ['--session', session, 'close'], { stdio: 'ignore', timeout: 6000 }) } catch { /* reported in the process audit afterwards */ }
  console.error(`Editor audit exceeded 150 seconds. Closed only ${session}.`)
  process.exit(2)
}, 150_000)
const canonical = new Map(fs.readdirSync('src/scenes', { recursive: true })
  .filter(file => file.endsWith('.json') && !file.startsWith('procedural-world/'))
  .map(file => [file, fs.readFileSync(`src/scenes/${file}`, 'utf8')]))
const checks = [], worlds = [], errors = [], smallTargets = []
const check = (name, value = true) => { assert(value, name); checks.push(name); console.log(`PASS ${name}`) }
let browser

async function viewport(width, height, mobile = false) {
  await browser.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  await browser.wait(300)
}
async function clickText(selector, text) {
  const target = await browser.evaluate(`(()=>{
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.includes(${JSON.stringify(text)}));
    if(!element)throw new Error('Missing '+${JSON.stringify(text)});
    if(element.disabled)throw new Error('Disabled '+${JSON.stringify(text)});
    element.scrollIntoView({block:'center',inline:'nearest'});
    const r=element.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
    if(!r.width||r.y<0||!hit|| (hit!==element&&!element.contains(hit)))throw new Error('Obscured/offscreen '+${JSON.stringify(text)}+' '+JSON.stringify({r:r.toJSON(),hit:hit?.outerHTML?.slice(0,150)}));
    return {x,y};
  })()`)
  await browser.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 })
  await browser.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 })
}
async function navigate(pathname, selector) {
  await browser.call('Page.navigate', { url: `${origin}/${pathname}` })
  await browser.until(`document.querySelector(${JSON.stringify(selector)})`, selector, 240)
  await browser.wait(600)
}
async function key(key) {
  await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key })
  await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key })
}
async function field(selector, value) {
  await browser.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing field');const proto=e instanceof HTMLTextAreaElement ? HTMLTextAreaElement : e instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
}
async function sceneId() { return browser.evaluate('kr?.scene?.sceneId') }
async function create(kind, expected, before) {
  await clickText('.st-world-builder button', `${kind} →`)
  await browser.until(`kr?.scene?.sceneId?.startsWith('world_') && kr.scene.sceneId !== ${JSON.stringify(before)}`, `Created ${kind}`, 240)
  const data = await browser.evaluate('({id:kr.scene.sceneId,source:kr.scene.props.world.source.kind,profile:kr.scene.props.world.terrain.profile,depth:kr.scene.props.world.image?.observation?.points.length ?? 0})')
  assert.equal(data.source, expected); worlds.push(data); check(`${kind} creates and loads a generated scene`)
  const json = JSON.parse(fs.readFileSync(`src/scenes/procedural-world/${data.id}.json`, 'utf8'))
  assert.equal(json.sceneId, data.id); assert.equal(json.props.world.source.kind, expected)
  check(`${kind} is saved valid scene JSON in its own folder`)
  await browser.until(`document.querySelector('.st-world-builder input[accept="image/*"]')?.getBoundingClientRect().height > 0`, 'Generated world editor is visible', 360)
  await browser.wait(800)
  return data.id
}
async function tinyControls(width) {
  return browser.evaluate(`[...document.querySelectorAll('button,a')].filter(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&r.height<56&&c.visibility!=='hidden'}).map(e=>({text:e.textContent.slice(0,45),class:e.className,height:e.classList.contains('st-point-number') ? parseFloat(getComputedStyle(e,'::before').height) : e.getBoundingClientRect().height}))`)
}
async function report(score) {
  for (const [file, value] of canonical) assert.equal(fs.readFileSync(`src/scenes/${file}`, 'utf8'), value, `Canonical scene modified: ${file}`)
  check('No canonical episode scene was rewritten')
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ origin, checks, worlds, errors, smallTargets, score }, null, 2))
}

try {
  execFileSync('agent-browser', ['--session', session, 'open', origin], { stdio: 'ignore' })
  browser = await connect(session, `${origin}/`, true)
  await browser.call('Runtime.enable'); await browser.call('Page.enable')
  await browser.call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: `${out}/downloads`, eventsEnabled: true })
  browser.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text))
  browser.on('Runtime.consoleAPICalled', event => { if (event.type === 'error') errors.push(event.args.map(a => a.value ?? a.description).join(' ').slice(0, 600)) })
  await viewport(1280, 900)
  await navigate('?studio', '.st-panel-tabs')
  await clickText('.st-workflow-nav button', 'World Builder')
  check('World Builder tab has real visible content', await browser.evaluate('document.querySelector(".st-world-builder").getBoundingClientRect().height > 400'))
  check('World Builder is a sibling panel, not hidden under Scene', await browser.evaluate('document.getElementById("panel-world").parentElement === document.querySelector(".st-panel")'))
  await browser.evaluate('document.getElementById("tab-scene").focus()')
  await key('ArrowRight')
  check('Rendering tab supports keyboard navigation', await browser.evaluate('document.activeElement.id === "tab-render" && !document.getElementById("panel-render").hidden'))
  await key('ArrowRight')
  check('Panel tabs support keyboard navigation', await browser.evaluate('document.activeElement.id === "tab-world" && !document.getElementById("panel-world").hidden'))
  await browser.screenshot(`${out}/studio-world-desktop.png`)

  await clickText('.st-workflow-nav button', 'Rendering')
  check('Rendering workspace has quality profile controls', await browser.evaluate('document.querySelectorAll(".st-render-panel button").length >= 3'))
  await clickText('.st-render-panel button', 'High')
  check('Quality profile is persisted in scene config', await browser.evaluate('kr.scene.rendering.profile === "high" && kr.scene.rendering.ao.enabled && kr.scene.rendering.antialias === "smaa"'))
  await browser.wait(800)
  check('Film telemetry reports composed render passes per frame', await browser.evaluate(`(async()=>{ const {useStudio}=await import('/src/studio/studioStore.ts');const m=useStudio.getState().metrics; return Boolean(m && m.calls > 0 && m.calls < 2000 && m.textures > 0) })()`))
  await browser.screenshot(`${out}/studio-render-high.png`)
  await field('select[aria-label="Environment lighting"]', 'moonless_golf')
  await browser.until('kr.scene.rendering.environment?.hdri === "moonless_golf" && r3f.scene.environment', 'Local HDRI environment is loaded and PMREM-lit', 240)
  check('Local HDRI supplies actual scene environment lighting', await browser.evaluate('r3f.scene.environment !== null && performance.getEntriesByType("resource").some(e => e.name.endsWith("/environments/moonless_golf_1k.hdr"))'))
  await field('select[aria-label="Environment lighting"]', '')
  await clickText('.st-render-panel label span', 'Depth of field')
  check('Depth of field toggle updates the live scene settings', await browser.evaluate('kr.scene.rendering.dof.enabled'))
  await clickText('.st-render-panel label span', 'Depth of field')
  await clickText('.st-render-panel label span', 'God rays')
  check('God rays toggle updates the live scene settings', await browser.evaluate('kr.scene.rendering.godRays.enabled'))
  await clickText('.st-render-panel label span', 'God rays')
  await clickText('.st-render-panel button', 'Reset rendering')
  check('Rendering reset clears only rendering settings', await browser.evaluate('kr.scene.rendering === undefined'))
  await clickText('.st-render-panel button', 'High')
  await clickText('.st-render-panel button', 'Performance')
  check('Performance profile changes AO, AA and resolution settings', await browser.evaluate('kr.scene.rendering.profile === "performance" && kr.scene.rendering.renderScale === 1 && kr.scene.rendering.shadowMapSize === 512'))
  await browser.wait(500)
  await clickText('.st-top button[aria-label="Undo"]', '↶')
  check('Rendering undo restores the previous profile', await browser.evaluate('kr.scene.rendering?.profile === "high"'))
  await clickText('.st-top button[aria-label="Undo"]', '↶')
  await clickText('.st-workflow-nav button', 'World Builder')

  await field('.st-world-builder textarea', 'An abandoned Indian village with an old temple at the end of the road and a well beside it')
  await field('.st-world-builder input[type="number"]', 2087)
  await create('Story', 'story', await sceneId())

  await field('.st-world-builder select', 'terraced')
  await clickText('.st-world-builder button', 'Random world')
  await browser.until(`kr?.scene?.terrain?.profile === undefined && kr?.scene?.props?.world?.terrain?.profile === 'terraced'`, 'Terraced random world')
  worlds.push(await browser.evaluate('({id:kr.scene.sceneId,source:kr.scene.props.world.source.kind,profile:kr.scene.props.world.terrain.profile})'))
  check('Random generation accepts a terrain profile and seed')
  await browser.screenshot(`${out}/random-world.png`)

  const depthPNG = await browser.evaluate(`(()=>{const c=document.createElement('canvas');c.width=64;c.height=48;const ctx=c.getContext('2d');const img=ctx.createImageData(64,48);for(let y=0;y<48;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,v=Math.round(x/63*255);img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255}ctx.putImageData(img,0,0);return c.toDataURL('image/png').split(',')[1]})()`)
  fs.writeFileSync(`${out}/depth-fixture.png`, Buffer.from(depthPNG, 'base64'))
  await navigate('?studio', '.st-panel-tabs')
  await clickText('.st-workflow-nav button', 'World Builder')
  await browser.until(`document.querySelector('.st-world-builder input[accept="image/*"]')?.getBoundingClientRect().height > 0`, 'Image input is mounted and visible', 360)
  await browser.upload('.st-world-builder input[accept="image/*"]', path.resolve('docs/screenshots/studio-director.png'))
  await browser.upload('.st-world-builder > label:last-of-type input', `${out}/depth-fixture.png`)
  await browser.until(`[...document.querySelectorAll('.st-world-builder input[type=file]')].every(e=>e.files.length===1)`, 'Both image files selected')
  check('Reference image and depth files are actually selected in the browser')
  const worldId = await create('Image', 'image', await sceneId())
  check('Different-sized depth map produces finite relative samples', worlds.at(-1).depth === 96)
  await browser.screenshot(`${out}/image-world.png`)

  await clickText('.st-workflow-nav button', 'Environment FX')
  check('Environment FX panel is visible', await browser.evaluate('document.querySelector("#panel-fx").getBoundingClientRect().height > 100'))
  await clickText('#panel-fx button', 'Add effect')
  check('Effect authoring writes an optional scene effect', await browser.evaluate('Array.isArray(kr.scene.effects) && kr.scene.effects.length === 1'))
  await clickText('.st-top button[aria-label="Undo"]', '↶')
  check('Undo removes a newly authored effect', await browser.evaluate('(kr.scene.effects?.length ?? 0) === 0'))
  await clickText('.st-top button[aria-label="Redo"]', '↷')
  check('Redo restores the authored effect', await browser.evaluate('kr.scene.effects?.length === 1'))

  await clickText('.st-top button', 'Play'); await browser.wait(1100)
  check('Film playback advances the shared clock', await browser.evaluate('(async()=> (await import("/src/cinematic/clock.ts")).clock.t > 0.5)()'))
  await clickText('.st-top button[aria-label="Unmute"]', '🔇')
  check('Studio has an explicit, accessible unmute control', await browser.evaluate(`[...document.querySelectorAll('.st-top button')].some(e => e.getAttribute('aria-label') === 'Mute')`))
  await clickText('.st-top button', 'Pause')
  check('Pause has no live audio output', await browser.evaluate('(async()=> { const m = await import("/node_modules/.vite/deps/howler.js"); const audio = m.Howler ?? m.default?.Howler ?? m.default; return !audio.masterGain || Math.abs(audio.masterGain.gain.value) < 0.00001 })()'))
  await clickText('#tab-scene', 'Scene')
  await field('#panel-scene [aria-label="Ambient value"]', 0.9)
  await clickText('.st-top button', 'Save changes')
  await browser.until('document.querySelector(".st-status")?.textContent?.includes("Saved procedural-world")', 'Save status')
  const saved = JSON.parse(fs.readFileSync(`src/scenes/procedural-world/${worldId}.json`, 'utf8'))
  assert.equal(saved.lighting.ambientIntensity, 0.9)
  check('Explicit save updates the active generated scene file')

  await browser.call('Page.reload'); await browser.wait(1300)
  await browser.until('document.querySelector(".st-panel-tabs")')
  check('Saved scene and workspace survive reload', await browser.evaluate(`kr.scene.sceneId === ${JSON.stringify(worldId)} && !document.querySelector('.st-save.dirty')`))
  await clickText('.st-character-link', 'Character')
  await browser.until('document.querySelector(".char-lab canvas")')
  check('Studio → Character Lab opens the real rig workflow')
  check('Character Lab has episode and scene return links', await browser.evaluate('Boolean(document.querySelector(".char-episode-link[href*=start]") && document.querySelector(".char-back[href*=studio]"))'))
  await browser.until(`[...document.querySelectorAll('.char-top button')].some(e => e.textContent.includes('Download .glb') && !e.disabled)`, 'Character export is ready')
  await clickText('.char-top button', 'Download .glb')
  await browser.until(`[...document.querySelectorAll('.char-status')].some(e=>e.textContent.includes('Exported'))`, 'Character GLB export')
  const glbs = fs.readdirSync(`${out}/downloads`).filter(file => file.endsWith('.glb'))
  check('Character GLB is actually downloaded', glbs.length === 1 && fs.readFileSync(`${out}/downloads/${glbs[0]}`).subarray(0, 4).toString() === 'glTF')
  await viewport(390, 844, true); await browser.wait(400)
  smallTargets.push(...await tinyControls(390))
  check('Character Lab mobile action controls have 56px hit areas', smallTargets.every(t => t.height >= 56))
  await browser.screenshot(`${out}/character-mobile.png`)

  await clickText('.char-back', '←')
  await browser.until('document.querySelector(".st-panel-tabs")')
  await viewport(390, 844, true)
  await clickText('.st-workflow-nav button', 'World Builder')
  check('World Builder is directly visible at phone width', await browser.evaluate('document.querySelector(".st-world-builder").getBoundingClientRect().height > 400 && document.querySelector(".st-world-builder").getBoundingClientRect().top < innerHeight'))
  check('Studio mobile panels do not overlap the timeline', await browser.evaluate('(() => { const main = document.querySelector(".st-main").getBoundingClientRect(), timeline = document.querySelector(".st-timeline").getBoundingClientRect(); return main.bottom <= timeline.top + 1 })()'))
  const studioSmall = await tinyControls(390)
  check('Studio mobile buttons/links have 56px hit areas', studioSmall.every(t => t.height >= 56))
  if (studioSmall.length) smallTargets.push(...studioSmall)
  check('Studio phone layout has no horizontal page overflow', await browser.evaluate('document.documentElement.scrollWidth === document.documentElement.clientWidth'))
  await browser.screenshot(`${out}/studio-world-mobile.png`)

  await viewport(1280, 900)
  // Start recording only after every generated world has been inspected, so this is its actual film view.
  await clickText('.st-top button', 'Record clip')
  await browser.wait(await browser.evaluate('kr.scene.duration * 1000 + 1300'))
  await browser.wait(1800)
  const videos = fs.readdirSync(`${out}/downloads`).filter(file => /\.(webm|mp4)$/.test(file) && fs.statSync(`${out}/downloads/${file}`).size > 1000)
  check('Studio MediaRecorder produces a downloaded clip', videos.length >= 1)

  await navigate('?start=part1', '.gate')
  check('Episode gate is a labelled, operable button', await browser.evaluate('document.querySelector(".gate").getAttribute("aria-label") === "Enter KAALI RAAT episode 1"'))
  await clickText('.gate', 'Tap to begin'); await browser.wait(700)
  check('Episode entry starts through the actual gate', await browser.evaluate('!document.querySelector(".gate") && Boolean(document.querySelector(".app canvas"))'))
  check('No browser runtime errors during the workflows', errors.length === 0)
  await report('pass')
  console.log(`\nEditor workflow audit passed (${checks.length} checks). Evidence: ${out}`)
} catch (error) {
  errors.push(error instanceof Error ? error.stack : String(error))
  if (browser) await browser.screenshot(`${out}/failure.png`).catch(() => {})
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ checks, worlds, errors, smallTargets }, null, 2))
  throw error
} finally { browser?.close(); clearTimeout(watchdog); execFileSync('agent-browser', ['--session', session, 'close'], { stdio: 'ignore', timeout: 8000 }) }
