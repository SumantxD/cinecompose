import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { composeReferenceScene } from '../src/reference/compose.ts'
import { dominantFlow, summarizeMotion } from '../src/reference/motion.ts'
import { validateScene } from '../src/cinematic/validate.ts'

const input = process.argv[2]
if (!input || input === '--help') {
  console.log('Usage: node scripts/analyze-reference.mjs <video> [--out reference-imports/id] [--start 0] [--duration 30] [--template control-room] [--full-frame] [--write-scene]')
  process.exit(input ? 0 : 2)
}
const option = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const run = (command, args, buffer = false) => {
  const result = spawnSync(command, args, { encoding: buffer ? 'buffer' : 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 45000 })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr?.toString().slice(-1200) || result.error?.message || result.status}`)
  return result.stdout
}
const inputFile = path.resolve(input)
assert(fs.existsSync(inputFile) && fs.statSync(inputFile).isFile(), 'A local video file is required.')
assert(fs.statSync(inputFile).size <= 256 * 1024 * 1024, 'Choose a reference clip under 256 MiB for this bounded analysis.')
const duration = Number(option('--duration', '30')), start = Number(option('--start', '0'))
assert(Number.isFinite(start) && start >= 0 && Number.isFinite(duration) && duration > 0 && duration <= 120, 'Start must be non-negative and duration must be 0–120 seconds.')
const template = option('--template', 'control-room')
assert(['control-room', 'diorama'].includes(template), 'Choose a supported environment template.')
const platformCrop = !process.argv.includes('--full-frame')
const sourceHash = createHash('sha256').update(fs.readFileSync(inputFile)).digest('hex')
const id = option('--out', '') ? path.basename(path.resolve(option('--out', ''))) : `ref-${createHash('sha256').update(`${sourceHash}:${start}:${duration}:${platformCrop}`).digest('hex').slice(0, 12)}`
assert(/^[a-z][\w-]{2,63}$/.test(id), 'Study id must be a short lowercase identifier.')
const output = path.resolve(option('--out', `reference-imports/${id}`))
let created = false
try {
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', inputFile]))
  const video = probe.streams.find((stream) => stream.codec_type === 'video')
  assert(video?.width > 0 && video.height > 0, 'The file does not contain a readable video stream.')
  const fullDuration = Number(video.duration ?? probe.format.duration)
  const fpsParts = (video.avg_frame_rate || '30/1').split('/').map(Number)
  const fps = fpsParts[1] ? fpsParts[0] / fpsParts[1] : fpsParts[0]
  assert(fullDuration > 0 && fullDuration <= 600 && fps > 0 && fps <= 240, 'Duration or frame rate is outside the supported analysis bounds.')
  assert(start < fullDuration, 'The selected start is after the end of the video.')
  const cropHeight = Math.max(16, Math.round(video.height * (platformCrop ? .64 : 1) / 2) * 2)
  const aspect = platformCrop && video.width < video.height ? 9 / 16 : video.width / video.height
  const crop = {
    x: Math.round((platformCrop ? video.width * .015 : 0) / 2) * 2,
    y: Math.round((platformCrop ? video.height * .11 : 0) / 2) * 2,
    width: Math.max(16, Math.min(video.width, Math.round(cropHeight * aspect / 2) * 2)),
    height: cropHeight,
  }
  assert(crop.x + crop.width <= video.width && crop.y + crop.height <= video.height, 'Crop dimensions are invalid for this source.')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.mkdirSync(output)
  created = true
  fs.mkdirSync(path.join(output, 'shots'))
  const cutFile = path.join(output, 'cuts.txt')
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-i', inputFile, '-vf', `select='gt(scene,0.18)',metadata=print:file=${cutFile}`, '-an', '-f', 'null', '-'])
  const cutText = fs.readFileSync(cutFile, 'utf8')
  const cuts = [...cutText.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]))
  const scores = [...cutText.matchAll(/lavfi.scene_score=([\d.]+)/g)].map((m) => Number(m[1]))
  const ranges = []
  let previous = start
  for (const at of cuts) if (at > start && at <= start + duration) {
    if (at - previous >= .05) ranges.push({ start: previous, end: at, score: scores[cuts.indexOf(at)] ?? .3 })
    previous = at
  }
  const end = Math.min(fullDuration, previous)
  if (end - previous >= .05) ranges.push({ start: previous, end, score: 0 })
  assert(ranges.length > 0 && ranges.length <= 96, `No usable shots, or too many shots (${ranges.length}).`)

  const motionWidth = 96, motionHeight = Math.max(16, Math.round(crop.height / crop.width * 48) * 2), motionFps = 6
  const flowFilter = `fps=${motionFps},crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${motionWidth}:${motionHeight},format=gray`
  const raw = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-t', String(Math.min(fullDuration, start + duration)), '-i', inputFile, '-vf', flowFilter, '-an', '-f', 'rawvideo', 'pipe:1'], true)
  const frameSize = motionWidth * motionHeight
  const shots = ranges.map((range, i) => {
    const { start: at, end: to, score } = range
    const time = (at + to) / 2
    const file = `shots/shot-${String(i + 1).padStart(2, '0')}.jpg`
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', time.toFixed(6), '-i', inputFile, '-frames:v', '1', '-q:v', '3', '-vf', `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`, '-update', '1', path.join(output, file)])
    const imageSize = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', path.join(output, file)]).toString().trim().split('x').map(Number)
    const pairs = []
    let previousFrame
    for (let offset = 0; offset + frameSize <= raw.length; offset += frameSize) {
      const sampleTime = offset / frameSize / motionFps
      if (sampleTime < at + .1 || sampleTime > to - .08) { previousFrame = undefined; continue }
      const current = raw.subarray(offset, offset + frameSize)
      if (previousFrame) pairs.push(dominantFlow(previousFrame, current, motionWidth, motionHeight))
      previousFrame = current
    }
    return { ...range, time, file, width: imageSize[0], height: imageSize[1], motion: summarizeMotion(pairs, motionFps, motionWidth, motionHeight) }
  })
  const analysis = {
    version: 1, id, source: { filename: path.basename(inputFile), sha256: sourceHash, rights: 'reference-only' },
    video: { width: video.width, height: video.height, fps, duration: fullDuration },
    range: [start, end], template, crop: { platformUI: platformCrop, ...crop }, shots,
  }
  const config = composeReferenceScene(analysis)
  const errors = validateScene(config)
  assert.deepEqual(errors, [], errors.join('\n'))
  fs.writeFileSync(path.join(output, 'analysis.json'), JSON.stringify(analysis, null, 2))
  fs.writeFileSync(path.join(output, 'scene.json'), JSON.stringify(config, null, 2) + '\n')
  fs.writeFileSync(path.join(output, 'README.md'), '# Reference-only study\n\nSource frames are private placeholder projections, not cleared licences or recovered 3D geometry. Camera motion is inferred from coarse 2D image matching, then exposed for editing. Replace these frames before public release. Original audio is not imported.\n')
  if (process.argv.includes('--write-scene')) {
    const dir = path.resolve('src/scenes/reference-study')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${config.sceneId}.json`), JSON.stringify(config, null, 2) + '\n')
  }
  console.log(JSON.stringify({ id, output, scene: config, shots: shots.map(({ time, duration: _, ...s }) => s) }, null, 2))
} catch (error) {
  if (created) fs.rmSync(output, { recursive: true, force: true })
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
