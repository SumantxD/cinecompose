import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { Compiler } from 'inkjs/full'
import { mkdirSync, writeFileSync } from 'node:fs'

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

// Dev only: POST /__scene?file=railway-crossing/p1_road.json (body = JSON) — the Studio's Save.
function sceneSave(): Plugin {
  return {
    name: 'scene-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__scene', (req, res) => {
        const file = new URL(req.url!, 'http://x').searchParams.get('file')!
        if (!/^[\w-]+\/[\w-]+\.json$/.test(file)) return void (res.statusCode = 400, res.end('bad file'))
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          JSON.parse(body) // refuse to write broken JSON
          writeFileSync(`src/scenes/${file}`, body)
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), ink(), capture(), sceneSave()],
})
