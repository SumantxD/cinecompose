import type { SceneConfig } from '../cinematic/types'
import type { Line } from '../story/StoryEngine'
import type { RootState } from '@react-three/fiber'
import * as player from '../app/player'
import { useStore } from '../state/store'
import { clock } from '../cinematic/clock'
import { cceFrame } from '../cce/runtime'

export type ReelSize = '720' | '1080' | '720-landscape' | '1080-landscape'
export interface ReelOptions { start: number; end: number; size: ReelSize; onProgress?: (done: number, total: number) => void; signal?: AbortSignal }
export interface ReelResult { url: string; file: string; frames: number; duration: number; silent: boolean }

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
function dimensions(size: ReelSize) {
  return size === '1080' ? [1080, 1920] : size === '720' ? [720, 1280] : size === '1080-landscape' ? [1920, 1080] : [1280, 720]
}
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, width: number) {
  let size = max
  while (ctx.measureText(text).width > width && size > 18) { size -= 2; ctx.font = `600 ${size}px system-ui` }
}
function overlay(ctx: CanvasRenderingContext2D, w: number, h: number, marker: string | null, t: number, duration: number, endCard: boolean) {
  const caption = useStore.getState().caption
  ctx.fillStyle = `rgba(0,0,0,${Math.max(useStore.getState().blackout, cceFrame.blackout)})`
  ctx.fillRect(0, 0, w, h)
  if (cceFrame.text) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#eee7d8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 12
    ctx.font = `600 ${Math.round(w / 10)}px "Cormorant Garamond", Georgia, serif`
    fit(ctx, cceFrame.text, Math.round(w / 9), w * .82)
    ctx.fillText(cceFrame.text, w / 2, h * .43, w * .82); ctx.shadowBlur = 0
  }
  if (cceFrame.flash) { ctx.fillStyle = `rgba(238,231,216,${cceFrame.flash})`; ctx.fillRect(0, 0, w, h) }
  if (marker) {
    ctx.font = `600 ${Math.round(w / 35)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#e6c490'
    ctx.fillText(marker, w / 2, w / 12)
  }
  const decision = endCard && t >= duration - 1.2
  const text = decision ? 'What would you do?' : caption?.text
  if (text) {
    const prefix = caption?.speaker && caption.speaker !== 'NARRATOR' ? `${caption.speaker}: ` : ''
    ctx.textAlign = 'center'; ctx.fillStyle = '#eee7d8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10
    ctx.font = `${decision ? 600 : 500} ${Math.round(w / (decision ? 14 : 22))}px "Cormorant Garamond", Georgia, serif`
    fit(ctx, prefix + text, Math.round(w / 18), w * .82)
    ctx.fillText(decision ? text : prefix + text, w / 2, h * (decision ? .73 : .8), w * .82)
    ctx.shadowBlur = 0
  }
  if (useStore.getState().showTitle) {
    ctx.fillStyle = '#ddd3be'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(w / 22)}px "Cormorant Garamond", Georgia, serif`
    ctx.fillText('KAALI RAAT', w / 2, h * .42)
  }
}
function blob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Image capture failed.')), 'image/jpeg', .93))
}

/** Uses the composed film canvas; never the reference video or the director canvas. */
export async function exportReel(cfg: SceneConfig, lines: Line[], options: ReelOptions): Promise<ReelResult> {
  if (!Number.isFinite(options.start) || !Number.isFinite(options.end) || options.start < 0 || options.end <= options.start || options.end > cfg.duration + .001 || options.end - options.start > 60) throw new Error('Choose a clip within the scene, up to 60 seconds.')
  const state = (window as unknown as { filmR3f?: RootState }).filmR3f
  const canvas = document.querySelector('.st-preview canvas') as HTMLCanvasElement | null
  if (!state || !canvas || state.gl.domElement !== canvas) throw new Error('The film renderer is not ready. Try again in a moment.')
  const [width, height] = dimensions(options.size)
  const total = Math.round((options.end - options.start) * 30)
  if (total < 1 || total > 1800) throw new Error('Clip must contain 1–1800 frames at 30 fps.')
  const originalDpr = state.viewport.dpr
  const [preview] = [width / height]
  if (Math.abs(state.size.width / state.size.height - preview) > .02) throw new Error(`Set the preview to ${width > height ? '16:9' : '9:16'} so its aspect matches the export.`)
  const job = `reel-${crypto.randomUUID()}`
  const target = document.createElement('canvas'); target.width = width; target.height = height
  const ctx = target.getContext('2d', { alpha: false })!
  const endCard = cfg.props?.choreography?.endCard ?? false
  const originalTime = clock.t
  await document.fonts.ready
  player.setPaused(true)
  state.setDpr(width / state.size.width)
  await nextFrame(); await nextFrame()
  try {
    for (let i = 0; i < total; i++) {
      if (options.signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError')
      const t = options.start + i / 30
      if (i === 0) player.previewScene(cfg, t, lines)
      else player.step(t - clock.t)
      await nextFrame(); await nextFrame()
      ctx.drawImage(canvas, 0, 0, width, height)
      const marker = cfg.props?.referenceStudy?.showPlaceholders ? 'REFERENCE STUDY · UNRELEASED FRAMES' : cfg.props?.world?.image?.observation?.projection?.photoUrl ? 'DEPTH STUDY · RELATIVE 2.5D · PRIVATE' : null
      overlay(ctx, width, height, marker, t, cfg.duration, endCard)
      const response = await fetch(`/__reel/frame?job=${job}&index=${i}`, { method: 'POST', body: await blob(target) })
      if (!response.ok) throw new Error(await response.text())
      options.onProgress?.(i + 1, total)
      await nextFrame()
    }
    const response = await fetch(`/__reel/encode?job=${job}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job, sceneId: cfg.sceneId, frames: total, width, height, fps: 30, reference: !!cfg.props?.referenceStudy || !!cfg.props?.world?.image?.observation?.projection?.photoUrl }) })
    if (!response.ok) throw new Error(await response.text())
    return (await response.json()) as ReelResult
  } catch (error) {
    await fetch(`/__reel/cancel?job=${encodeURIComponent(job)}`, { method: 'POST' }).catch(() => undefined)
    throw error
  } finally {
    state.setDpr(originalDpr)
    player.previewScene(cfg, originalTime, lines)
    player.setPaused(true)
  }
}
