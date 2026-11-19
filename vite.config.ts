import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { Compiler } from 'inkjs/full'
import { mkdirSync, writeFileSync, createReadStream, existsSync, statSync, rmSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { validateScene } from './src/cinematic/validate.ts'

// Compiles .ink scripts to Ink JSON at build time; script errors fail the build / show in the dev overlay.
function ink(): Plugin {
  return {
    name: 'ink',
    transform(src, id) {
      if (!id.endsWith('.ink')) return
      const compiler = new Compiler(src)
      const story = compiler.Compile()
      if (compiler.errors.length) this.error(`${id}\n${compiler.errors.join('\n')}`)
      compiler.warnings.forEach((w) => this.warn(w))
      return { code: `export default ${JSON.stringify(story.ToJson())}`, map: null }
    },
  }
}

// Dev only: private reference frames extracted by scripts/analyze-reference.mjs. Never ships in dist/.
function referenceFrames(): Plugin {
  return {
    name: 'reference-frames',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__reference', (req, res) => {
        const match = /^\/([\w-]+)\/shots\/(shot-\d{2}\.jpg)$/.exec(req.url ?? '')
        const file = match ? resolve('reference-imports', match[1], 'shots', basename(match[2])) : ''
        if (!file || !existsSync(file) || !statSync(file).isFile()) return void (res.statusCode = 404, res.end('Reference frame not available.'))
        res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'no-store'); createReadStream(file).pipe(res)
      })
    },
  }
}

// Dev only: authored private depth-study photos. JPEG/metadata only; no traversal or implicit upload.
function depthPhotos(): Plugin {
  return {
    name: 'depth-study-photos', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__depth', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          if (req.method === 'GET') {
            const match = /^\/([a-z][\w-]{2,63})\/(photo\.jpg|provenance\.json)$/.exec(url.pathname)
            const file = match ? resolve('depth-imports', match[1], basename(match[2])) : ''
            if (!file || !existsSync(file) || !statSync(file).isFile()) return text(res, 404, 'Private depth study not found.')
            res.setHeader('Content-Type', match![2] === 'photo.jpg' ? 'image/jpeg' : 'application/json')
            res.setHeader('Cache-Control', 'no-store'); createReadStream(file).pipe(res); return
          }
          if (req.method !== 'POST') return text(res, 405, 'POST only')
          const id = url.searchParams.get('study') ?? ''
          if (!/^[a-z][\w-]{2,63}$/.test(id)) return text(res, 400, 'Invalid private study id.')
          const input = JSON.parse((await postBody(req, 2_800_000)).toString()) as Record<string, unknown>
          if (input.rights !== 'private-reference-study' || typeof input.image !== 'string' || !input.image.startsWith('data:image/jpeg;base64,')) return text(res, 400, 'Expected a JPEG reference marked as a private study.')
          const image = Buffer.from(input.image.slice('data:image/jpeg;base64,'.length), 'base64')
          if (image.length < 128 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) return text(res, 400, 'Invalid JPEG reference.')
          const file = resolve('depth-imports', id)
          mkdirSync(file, { recursive: true })
          const sourceName = String(input.sourceName ?? 'reference.jpg').replace(/[^\w.-]/g, '_').slice(0, 180)
          writeFileSync(resolve(file, 'photo.jpg'), image, { flag: 'wx' })
          writeFileSync(resolve(file, 'provenance.json'), JSON.stringify({ version: 1, sourceName, sha256: createHash('sha256').update(image).digest('hex'), model: input.model ?? 'Depth-Anything-V2-Small', rights: input.rights, releaseCleared: false, note: 'Local private reference, not inferred ownership or complete 3D recovery.' }, null, 2) + '\n', { flag: 'wx' })
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ photoUrl: `/__depth/${id}/photo.jpg` }))
        } catch (error) { text(res, 409, error instanceof Error ? error.message : 'Private study already exists.') }
      })
    },
  }
}

// Dev only: POST /__capture?name=x.jpg (body = data URL) writes captures/x.jpg — frame grabs for
// scripts/analyze-video.sh / scripts/luma.sh and, later, the Reels exporter.
function capture(): Plugin {
  return {
    name: 'capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res) => {
        const name = new URL(req.url!, 'http://x').searchParams.get('name')!.replace(/[^\w.-]/g, '_')
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          mkdirSync('captures/frames', { recursive: true })
          writeFileSync(`captures/frames/${name}`, Buffer.from(body.split(',')[1], 'base64'))
          res.end('ok')
        })
      })
    },
  }
}

function postBody(req: IncomingMessage, limit = 4_194_304) {
  return new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = []; let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) { reject(new Error('Upload too large.')); req.destroy(); return }
      chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
    req.on('aborted', () => reject(new Error('Upload aborted.')))
  })
}
function text(res: ServerResponse, status: number, body: string) { res.statusCode = status; res.end(body) }
function run(command: string, args: string[]) {
  return new Promise<{ out: string; error: string }>((resolveRun, reject) => {
    const child = spawn(command, args, { shell: false }); let out = '', error = ''
    child.stdout.on('data', (chunk) => { if (out.length < 16384) out += chunk })
    child.stderr.on('data', (chunk) => { if (error.length < 16384) error += chunk })
    child.once('error', reject)
    child.once('close', (code) => code === 0 ? resolveRun({ out, error }) : reject(new Error(error.trim() || `${command} failed.`)))
  })
}

// Dev-only, silent, deterministic frame export. Local ffmpeg is opt-in; no media leaves localhost.
function reels(): Plugin {
  let encodingJob = ''
  return {
    name: 'reel-export', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__reel', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost'), job = url.searchParams.get('job') ?? ''
          if (url.pathname === '/file' && req.method === 'GET') {
            const match = /^[a-z0-9][\w-]{3,80}\.mp4$/.test(job) ? resolve('exports', job) : ''
            if (!match || !existsSync(match) || !statSync(match).isFile()) return text(res, 404, 'Export not found.')
            res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Content-Disposition', `attachment; filename="${job}"`)
            createReadStream(match).pipe(res); return
          }
          if (req.method !== 'POST') return text(res, 405, 'POST only')
          if (!/^[a-z0-9][\w-]{3,80}$/.test(job)) return text(res, 400, 'Invalid export id.')
          const folder = resolve('exports', job)
          if (url.pathname === '/frame') {
            if (encodingJob) return text(res, 409, 'Another export is encoding.')
            const index = +(url.searchParams.get('index') ?? '-1')
            if (!Number.isInteger(index) || index < 0 || index > 1799) return text(res, 400, 'Invalid frame index.')
            const body = await postBody(req)
            if (body.length < 16 || body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) return text(res, 400, 'Expected a JPEG frame.')
            mkdirSync(folder, { recursive: true })
            writeFileSync(resolve(folder, `frame_${String(index).padStart(6, '0')}.jpg`), body, { flag: 'wx' })
            res.end(JSON.stringify({ frame: index + 1 })); return
          }
          if (url.pathname === '/encode') {
            if (encodingJob) return text(res, 409, 'Another export is encoding.')
            const input = JSON.parse((await postBody(req, 16384)).toString()) as Record<string, unknown>
            const formats = [[720, 1280], [1080, 1920], [1280, 720], [1920, 1080]]
            if (!formats.some(([w, h]) => input.width === w && input.height === h) || input.fps !== 30 || !Number.isInteger(input.frames) || Number(input.frames) < 1 || Number(input.frames) > 1800) return text(res, 400, 'Choose a supported size and 1–1800 frames at 30 fps.')
            if (typeof input.sceneId !== 'string' || !/^[a-z][\w-]{2,63}$/.test(input.sceneId)) return text(res, 400, 'Invalid scene id.')
            const count = Number(input.frames)
            for (let i = 0; i < count; i++) if (!existsSync(resolve(folder, `frame_${String(i).padStart(6, '0')}.jpg`))) return text(res, 400, `Missing frame ${i}. Nothing was encoded.`)
            const output = resolve('exports', `${job}.mp4`)
            if (existsSync(output)) return text(res, 409, 'Export already exists; it will not be overwritten.')
            encodingJob = job
            try {
              mkdirSync('exports', { recursive: true })
              await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-filter_threads', '1', '-framerate', '30', '-start_number', '0', '-i', resolve(folder, 'frame_%06d.jpg'), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', '-an', '-n', output])
              const probe = JSON.parse((await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', output])).out)
              const stream = probe.streams[0]
              if (stream.width !== input.width || stream.height !== input.height || Number(stream.nb_frames) !== count || stream.r_frame_rate !== '30/1') throw new Error('ffmpeg metadata did not match the requested export.')
              writeFileSync(resolve('exports', `${job}.json`), JSON.stringify({ ...input, probe, silent: true }, null, 2))
              rmSync(folder, { recursive: true, force: true })
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ url: `/__reel/file?job=${job}.mp4`, file: `exports/${job}.mp4`, frames: count, duration: count / 30, silent: true }))
            } finally { encodingJob = '' }
            return
          }
          if (url.pathname === '/cancel') {
            if (encodingJob) return text(res, 409, 'An export is encoding; queued cancellation is not supported.')
            if (!existsSync(folder) || !statSync(folder).isDirectory()) return res.end('No frames retained.')
            rmSync(folder, { recursive: true, force: true }); res.end('Cancelled; partial frames removed.')
            return
          }
          text(res, 404, 'Unknown export action.')
        } catch (error) {
          if (!res.writableEnded) text(res, 400, error instanceof Error ? error.message : 'Export failed.')
        }
      })
    },
  }
}

// Dev only: POST /__scene?file=railway-crossing/p1_road.json (body = JSON) — the Studio's Save.
function sceneSave(): Plugin {
  return {
    name: 'scene-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__scene', (req, res) => {
        if (req.method !== 'POST') return void (res.statusCode = 405, res.end('POST only'))
        const file = new URL(req.url!, 'http://x').searchParams.get('file') ?? ''
        if (!/^[\w-]+\/[\w-]+\.json$/.test(file)) return void (res.statusCode = 400, res.end('bad file'))
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const cfg: unknown = JSON.parse(body)
            const errors = validateScene(cfg)
            const id = (cfg as { sceneId?: string })?.sceneId
            if (id !== file.split('/')[1].replace('.json', '')) errors.unshift('sceneId must match the filename.')
            if (errors.length) return void (res.statusCode = 422, res.end(errors.join('\n')))
            mkdirSync(`src/scenes/${file.split('/')[0]}`, { recursive: true })
            writeFileSync(`src/scenes/${file}`, body)
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(e instanceof Error ? e.message : String(e))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), ink(), capture(), sceneSave(), referenceFrames(), depthPhotos(), reels()],
})
