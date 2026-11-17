// Walks every branch of every episode and validates it against the scene configs.
// Run: npm run check. Fails (exit 1) on errors; lists unbuilt scenes as info.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { Compiler } from 'inkjs/full'
import { StoryEngine, SPEAKERS } from '../src/story/StoryEngine.ts'
import { expandTechniques } from '../src/cinematic/techniques.ts'
import { validateScene } from '../src/cinematic/validate.ts'
import { VOICES } from '../src/audio/voices.ts'

const errors = []
const scenes = new Map()
for (const dir of readdirSync('src/scenes', { withFileTypes: true })) {
  for (const f of existsSync(`src/scenes/${dir.name}`) && dir.isDirectory() ? readdirSync(`src/scenes/${dir.name}`) : []) {
    if (!f.endsWith('.json')) continue
    const cfg = JSON.parse(readFileSync(`src/scenes/${dir.name}/${f}`, 'utf8'))
    if (scenes.has(cfg.sceneId)) errors.push(`duplicate sceneId ${cfg.sceneId}`)
    scenes.set(cfg.sceneId, cfg)
    errors.push(...validateScene(cfg))
    try { cfg.cues = [...cfg.cues, ...expandTechniques(cfg.techniques)] } catch { /* validation already reports it */ }
  }
}

const sounds = readFileSync('src/audio/manifest.ts', 'utf8')
for (const cfg of scenes.values()) {
  const used = [...cfg.audio.ambience.map((a) => a.sound), ...cfg.cues.filter((c) => c.sound).map((c) => c.sound)]
  for (const s of used) if (!new RegExp(`^\\s*${s}:`, 'm').test(sounds)) errors.push(`${cfg.sceneId}: sound "${s}" not in manifest`)
}

for (const file of readdirSync('src/story').filter((f) => f.endsWith('.ink'))) {
  const compiler = new Compiler(readFileSync(`src/story/${file}`, 'utf8'))
  const json = compiler.Compile().ToJson()
  if (compiler.errors.length) { errors.push(...compiler.errors); continue }
  if (file === 'episode-001.ink') {
    try { new StoryEngine(json).start('part1') } catch { errors.push(`${file}: missing the documented part1 entry knot`) }
  }
  const used = new Set()
  const endings = new Map()
  let paths = 0
  const walk = (picks) => {
    const e = new StoryEngine(json)
    let beat
    let i = 0
    let captured = false
    for (;;) {
      beat = e.next()
      if (!beat.sceneId) errors.push(`${file}: lines before any # scene tag (path ${picks})`)
      used.add(beat.sceneId)
      if (beat.lines.some((l) => l.captured)) captured = true
      const cfg = scenes.get(beat.sceneId)
      for (const l of beat.lines) {
        if (!SPEAKERS.includes(l.speaker)) errors.push(`${beat.sceneId}: unknown speaker ${l.speaker}`)
        if (l.vo && !Object.hasOwn(VOICES, l.vo)) errors.push(`${beat.sceneId}: unknown voice clip ${l.vo}`)
        if (l.vo && l.hold !== undefined && Object.hasOwn(VOICES, l.vo) && l.hold < VOICES[l.vo].duration) errors.push(`${beat.sceneId}: ${l.vo} exceeds its caption slot`)
      }
      for (const l of beat.lines) if (cfg && l.at !== undefined && l.at > cfg.duration) errors.push(`${beat.sceneId}: line "${l.text.slice(0, 30)}" at ${l.at}s is past the end`)
      if (beat.choices.length) {
        if (i === picks.length) return beat.choices.forEach((_, c) => walk([...picks, c]))
        e.choose(picks[i++])
      } else if (beat.ended) break
    }
    paths++
    const end = (beat.epitaph ? 'DEAD' : e.flags.ending || '(none)') + (captured ? ' (captured)' : '')
    endings.set(end, (endings.get(end) ?? 0) + 1)
  }
  walk([])
  console.log(`${file}: ${paths} paths →`, Object.fromEntries(endings))
  const unbuilt = [...used].filter((s) => !scenes.has(s))
  console.log(`  built scenes: ${[...used].filter((s) => scenes.has(s)).join(', ') || 'none'}`)
  console.log(`  animatic (unbuilt): ${unbuilt.join(', ')}`)
}

if (errors.length) {
  console.error('\n✗ ' + errors.join('\n✗ '))
  process.exit(1)
}
console.log('✓ episode checks passed')
