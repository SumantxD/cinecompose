import { useEffect, useState } from 'react'
import { hashText, planEnvironment, TERRAIN_PRESETS, worldScene } from '../world/EnvironmentPlanner.ts'
import { storyToScene } from '../world/StoryToScene.ts'
import { imageToScene, type PixelImage } from '../world/ImageToScene.ts'
import type { SceneConfig } from '../cinematic/types'
import type { SceneSpecification } from '../world/types.ts'
import { SCENES, SCENE_FILES } from '../scenes/registry'
import { useStudio } from './studioStore'

async function pixels(file: File): Promise<PixelImage> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width; canvas.height = bitmap.height
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0)
  if (bitmap.width * bitmap.height > 16_000_000) throw new Error('Image is too large. Use at most 16 megapixels for a world reference or depth map.')
  const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data
  bitmap.close()
  return { width: canvas.width, height: canvas.height, data }
}

/** Creates ordinary scene JSON in a new folder; existing scenes are never overwritten. */
async function createWorld(spec: SceneSpecification): Promise<string> {
  let id = `world_${hashText(spec.biome + spec.seed).toString(36).slice(0, 7)}`
  for (let i = 2; SCENES.has(id); i++) id = `world_${hashText(spec.biome + spec.seed + i).toString(36).slice(0, 7)}`
  const file = `procedural-world/${id}.json`, cfg = worldScene(id, spec)
  const response = await fetch(`/__scene?file=${file}`, { method: 'POST', body: JSON.stringify(cfg, null, 2) + '\n' })
  if (!response.ok) throw new Error(await response.text())
  SCENES.set(id, cfg as SceneConfig); SCENE_FILES.set(id, file)
  useStudio.getState().load(id)
  return file
}

export function WorldBuilder({ onStatus }: { onStatus: (message: string) => void }) {
  const [story, setStory] = useState('An abandoned Indian village with an old temple at the end of the road and a well beside it')
  const [seed, setSeed] = useState(2009)
  const [preset, setPreset] = useState<string>('rolling')
  const [image, setImage] = useState<File | null>(null)
  const [depth, setDepth] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  useEffect(() => onStatus(status), [status, onStatus])

  const generate = async (kind: 'random' | 'story' | 'image') => {
    setBusy(true); setStatus('')
    try {
      const spec = kind === 'random'
        ? planEnvironment(seed, preset, { kind, description: `Random ${preset}`, reconstructed: false, notes: ['Seeded procedural layout.'] })
        : kind === 'story' ? storyToScene(story, seed)
          : imageToScene(await pixels(image!), depth ? { model: 'Depth-Anything-V2-Small', depth: await pixels(depth) } : undefined, seed)
      setStatus(`Created ${await createWorld(spec)} · ${spec.source.notes.join(' ')}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return <section className="st-world-builder">
    <h3>World Builder</h3>
    <p className="st-hint">One shared specification → terrain, routes, assets, light and a normal editable scene JSON. Existing scenes are never replaced.</p>
    <label className="st-slider"><span>Seed</span><input type="number" value={seed} onChange={(e) => setSeed(Math.max(0, Math.floor(+e.target.value)))} /></label>
    <label className="st-slider"><span>Terrain profile</span>
      <select value={preset} onChange={(e) => setPreset(e.target.value)}>
        {TERRAIN_PRESETS.map((id) => <option key={id}>{id}</option>)}
      </select>
    </label>
    <div className="st-row"><button disabled={busy} onClick={() => generate('random')} title="Deterministic seeded terrain, routes, vegetation and structures">🎲 Random world</button></div>
    <label className="st-slider"><span>Story description</span>
      <textarea value={story} rows={4} onChange={(e) => setStory(e.target.value)} />
    </label>
    <div className="st-row"><button disabled={busy || story.trim().length < 8} onClick={() => generate('story')} title="Natural-language scene description → structured specification → world">📖 Story → world</button></div>
    <label className="st-slider"><span>Reference image</span><input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} /></label>
    <label className="st-slider"><span>Depth map (optional; model not embedded)</span><input type="file" accept="image/*" onChange={(e) => setDepth(e.target.files?.[0] ?? null)} /></label>
    <div className="st-row"><button disabled={busy || !image} onClick={() => generate('image')} title="Pixel analysis first; optional depth is labelled a relative 2.5D observation">🖼 Image → world</button></div>
    {status && <p className="st-hint">{status}</p>}
  </section>
}
