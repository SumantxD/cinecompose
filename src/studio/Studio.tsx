import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Howler } from 'howler'
import { Stage } from '../app/Stage'
import * as player from '../app/player'
import { clock } from '../cinematic/clock'
import { useStore } from '../state/store'
import { SCENES, SCENE_FILES } from '../scenes/registry'
import { paceLines } from '../cinematic/timeline'
import { moveCameraAim, moveCameraPoint, movePathHandle, pathFromShot, setNodeMode, setShotDuration, shotPointCount } from '../cinematic/curve.ts'
import { expandTechniques } from '../cinematic/techniques'
import { audioReady } from '../app/Overlay'
import { useStudio } from './studioStore'
import { EffectCreator, JsonEditor, NudgeCamera } from './AuthoringTools'
import { validateScene } from '../cinematic/validate.ts'
import { linesForScene } from './lines'
import type { Cue, SceneConfig, Shot, ShotType, Vec3 } from '../cinematic/types'
import './studio.css'

// KAALI RAAT Studio — nudge shots, timing and the look by hand, then Save back to the scene JSON.
// Open with ?studio (dev server). Everything edits the same files the game plays.

const SHOT_TYPES: [ShotType, string][] = [
  ['static', 'Still (locked off)'], ['slow_push', 'Slow push in'], ['pull_back', 'Pull back'], ['track_lateral', 'Tracking move'],
  ['pan', 'Pan / turn'], ['focus', 'Focus move'], ['over_shoulder', 'Over the shoulder'], ['low_angle', 'Low angle'],
  ['high_angle', 'High angle'], ['first_person', 'Through his eyes'], ['pov_walk', 'Walking POV'], ['security', 'Security camera'],
]
const SNAP_GRID = 0.05 // seconds
const TIME_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60] // ruler tick spacing choices
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}.${String(Math.floor((sec % 1) * 100)).padStart(2, '0')}`
const r2 = (n: number) => Math.round(n * 100) / 100
const vec = (v: { x: number; y: number; z: number }): Vec3 => [r2(v.x), r2(v.y), r2(v.z)]

function cueLabel(c: Cue) {
  switch (c.action) {
    case 'light': return `💡 ${c.target} ${c.mode}`
    case 'entity': return `${c.target === 'chudail' ? '👣' : '🧍'} ${c.target}${c.visible ? '' : ' hide'}`
    case 'sfx': return `🔊 ${c.sound}`
    case 'ambience': return `🌧 ${c.sound}`
    case 'title': return '🅣 title'
    case 'fade': return c.to > 0.5 ? '⬛ fade out' : '⬜ fade in'
  }
}

function Slider({ label, hint, value, min, max, step = 0.01, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="st-slider" title={hint}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <input type="number" min={min} max={max} step={step} value={r2(value)} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

function VecField({ label, value, onChange }: { label: string; value?: Vec3; onChange: (v: Vec3) => void }) {
  const v = value ?? [0, 0, 0]
  return (
    <div className="st-vec">
      <span>{label}</span>
      {v.map((n, i) => (
        <input key={i} type="number" step={0.1} value={r2(n)} onChange={(e) => onChange(v.map((x, k) => (k === i ? +e.target.value : x)) as Vec3)} />
      ))}
    </div>
  )
}

export function Studio() {
  const st = useStudio()
  const { cfg, sel } = st
  const lines = useMemo(() => linesForScene(st.sceneId), [st.sceneId])
  const [, setTick] = useState(0)
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('')
  const [adding, setAdding] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const dirty = JSON.stringify(cfg) !== st.saved
  const cues = useMemo(() => [...cfg.cues.map((c, i) => ({ c, i, own: true })), ...expandTechniques(cfg.techniques).map((c) => ({ c, i: -1, own: false }))], [cfg])
  const paced = useMemo(() => paceLines(lines).timed, [lines])

  // Any edit or seek re-renders the preview at the playhead.
  useEffect(() => {
    audioReady.then(() => player.previewScene(cfg, useStudio.getState().t, lines))
    player.setPaused(!useStudio.getState().playing)
  }, [cfg, lines, st.sel])

  // Playhead follows the clock while playing.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (useStudio.getState().playing) {
        if (clock.t >= cfg.duration) {
          useStudio.getState().set({ playing: false, t: cfg.duration })
          player.setPaused(true)
        }
        setTick((n) => n + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [cfg.duration])

  const seek = (t: number) => {
    const tt = Math.max(0, Math.min(cfg.duration, t))
    st.set({ t: tt })
    player.previewScene(cfg, tt, lines)
    player.setPaused(!useStudio.getState().playing)
  }
  const play = (on: boolean) => {
    if (on && clock.t >= cfg.duration - 0.05) seek(0)
    st.set({ playing: on, t: clock.t })
    player.setPaused(!on)
  }
  const save = async () => {
    const errors = validateScene(cfg)
    if (errors.length) return setStatus(errors.join(' · '))
    const file = SCENE_FILES.get(st.sceneId)!
    const json = JSON.stringify(cfg, null, 2) + '\n'
    try {
      const r = await fetch(`/__scene?file=${file}`, { method: 'POST', body: json })
      setStatus(r.ok ? `Saved ${file}` : `Save failed · ${await r.text()}`)
      if (r.ok) {
        SCENES.set(st.sceneId, cfg)
        st.set({ saved: JSON.stringify(cfg) })
      }
    } catch {
      setStatus('Save failed — is the dev server running?')
    }
  }
  const createScene = async (duplicate: boolean) => {
    const sceneId = window.prompt(duplicate ? 'Name for the duplicated scene:' : 'New scene id (lowercase, numbers, _ or -):', `${st.sceneId}${duplicate ? '_copy' : '_new'}`)?.trim()
    if (!sceneId) return
    if (!/^[a-z][\w-]*$/.test(sceneId)) return setStatus('Scene id must start with a lowercase letter; use letters, numbers, _ or -.')
    if (SCENES.has(sceneId)) return setStatus(`Scene "${sceneId}" already exists.`)
    const folder = SCENE_FILES.get(st.sceneId)!.split('/')[0]
    const file = `${folder}/${sceneId}.json`
    const next: SceneConfig = duplicate ? JSON.parse(JSON.stringify(cfg)) as SceneConfig : {
      ...JSON.parse(JSON.stringify(cfg)) as typeof cfg,
      sceneId,
      shots: [{ ...JSON.parse(JSON.stringify(cfg.shots[0])) as Shot, id: 'opening', type: 'static' as const, duration: 6, to: undefined, lookAtTo: undefined }],
      cues: cfg.cues.filter((c) => c.at === 0 && c.action === 'light').map((c) => ({ ...c })),
      techniques: [],
    }
    next.sceneId = sceneId
    next.duration = next.shots.reduce((sum, s) => sum + s.duration, 0)
    const errors = validateScene(next)
    if (errors.length) return setStatus(errors.join(' · '))
    try {
      const r = await fetch(`/__scene?file=${file}`, { method: 'POST', body: JSON.stringify(next, null, 2) + '\n' })
      if (!r.ok) return setStatus(`Create failed · ${await r.text()}`)
      SCENES.set(sceneId, next)
      SCENE_FILES.set(sceneId, file)
      st.load(sceneId)
      setStatus(`Created ${file}`)
    } catch {
      setStatus('Create failed — is the dev server running?')
    }
  }
  const record = async () => {
    // Plays the scene from the top and records the canvas (+ sound) to a downloadable clip.
    const canvas = document.querySelector('.st-preview canvas') as HTMLCanvasElement
    const stream = canvas.captureStream(30)
    const dest = Howler.ctx.createMediaStreamDestination()
    Howler.masterGain.connect(dest)
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr))
    const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm', videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.onstop = () => {
      Howler.masterGain.disconnect(dest)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }))
      a.download = `${st.sceneId}-${st.aspect.replace(':', 'x')}.${rec.mimeType.includes('mp4') ? 'mp4' : 'webm'}`
      a.click()
      setRecording(false)
    }
    setRecording(true)
    seek(0)
    rec.start()
    play(true)
    setTimeout(() => rec.stop(), cfg.duration * 1000 + 300)
  }

  // Keyboard: Space play/pause, ←/→ nudge playhead, ⌘Z / ⇧⌘Z undo/redo, ⌘S save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      const meta = e.metaKey || e.ctrlKey
      if (e.code === 'Space') { e.preventDefault(); play(!useStudio.getState().playing) }
      else if (e.key === 'ArrowLeft') seek(useStudio.getState().t - (e.shiftKey ? 1 : 0.1))
      else if (e.key === 'ArrowRight') seek(useStudio.getState().t + (e.shiftKey ? 1 : 0.1))
      else if (meta && e.key === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo() }
      else if (meta && e.key === 's') { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const t = st.playing ? clock.t : st.t
  const px = st.timelineZoom
  const scrollRef = useRef<HTMLDivElement>(null)
  const shotStarts = cfg.shots.reduce<number[]>((a, _, i) => (a.push(i ? a[i - 1] + cfg.shots[i - 1].duration : 0), a), [])
  const curShot = Math.max(0, shotStarts.reduce((k, s0, i) => (s0 <= t + 1e-6 ? i : k), 0))
  const shot = sel?.kind === 'shot' ? cfg.shots[sel.index] : null
  const cue = sel?.kind === 'cue' ? cfg.cues[sel.index] : null
  const editShot = (fn: (s: Shot) => void) => st.edit((c) => fn(c.shots[sel!.index]))
  const editCue = (fn: (c: Cue) => void) => st.edit((c) => fn(c.cues[sel!.index]))
  const fromView = (end: boolean) => {
    const { camera, target } = useStudio.getState()
    if (!camera || !target) return setStatus('The director view is still loading.')
    editShot((s) => {
      const count = shotPointCount(s), node = end ? count - 1 : 0
      moveCameraPoint(s, node, vec(camera.position))
      moveCameraAim(s, node, vec(target))
    })
    setStatus(`Shot ${end ? 'END' : 'START'} set from your view.`)
  }
  const dragOnTimeline = (e: RPointerEvent, onMove: (sec: number) => void) => {
    const box = (e.currentTarget.closest('.st-tracks') as HTMLElement).getBoundingClientRect()
    const move = (ev: PointerEvent) => onMove((ev.clientX - box.left) / useStudio.getState().timelineZoom)
    const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up))
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Snap to shot/cue boundaries within a few pixels, otherwise the fine time grid.
  const snapTargets = useMemo(() => {
    const list = [0, cfg.duration, ...shotStarts, ...shotStarts.map((s0, i) => s0 + cfg.shots[i].duration), ...cues.map(({ c }) => c.at)]
    return list.sort((a, b) => a - b)
  }, [cfg.duration, shotStarts.join(','), cues.map(({ c }) => c.at).join(',')])
  const snapTime = (sec: number) => {
    const clamped = Math.max(0, Math.min(cfg.duration, sec))
    if (!useStudio.getState().snap) return r2(clamped)
    const threshold = 7 / px
    let best = clamped, bestDist = threshold
    for (const target of snapTargets) { const d = Math.abs(target - clamped); if (d < bestDist) { best = target; bestDist = d } }
    return r2(bestDist < threshold ? best : Math.round(clamped / SNAP_GRID) * SNAP_GRID)
  }
  const zoomBy = (factor: number, anchor?: number) => {
    const next = Math.min(240, Math.max(6, px * factor))
    st.set({ timelineZoom: next })
    const el = scrollRef.current
    if (el && anchor !== undefined) { const x = anchor - el.getBoundingClientRect().left; const at = (x + el.scrollLeft) / px; requestAnimationFrame(() => { el.scrollLeft = at * next - x }) }
  }
  const fitTimeline = () => { const el = scrollRef.current; if (el) st.set({ timelineZoom: Math.max(6, Math.min(240, (el.clientWidth - 16) / Math.max(0.1, cfg.duration))) }); el?.scrollTo({ left: 0, behavior: 'smooth' }) }
  const step = TIME_STEPS.find((s) => s * px >= 44) ?? 60
  const minor = step / 5
  const ticks = useMemo(() => { const out: number[] = []; for (let s = 0; s <= cfg.duration + 1e-6; s += minor) out.push(Math.round(s * 1000) / 1000); return out }, [cfg.duration, minor])

  // Ctrl/Cmd + wheel zooms at the cursor. Native listener because React's onWheel is passive.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      zoomBy(e.deltaY > 0 ? 0.88 : 1.14, e.clientX)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [px, cfg.duration])
  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !st.playing) return
    const x = t * px
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 48) el.scrollLeft = x - el.clientWidth / 3
  }, [t, px, st.playing])

  return (
    <div className="studio">
      <header className="st-top">
        <b>KAALI RAAT · Studio</b>
        <select value={st.sceneId} onChange={(e) => st.load(e.target.value)} title="Which scene to edit">
          {[...SCENES.keys()].map((id) => <option key={id}>{id}</option>)}
        </select>
        <button onClick={() => createScene(false)} title="Create a blank scene in this environment">＋</button>
        <button onClick={() => createScene(true)} title="Duplicate this scene, including unsaved edits">⧉</button>
        <button onClick={() => setJsonOpen(true)} title="Edit full scene JSON, including technique macros">{ }</button>
        <button onClick={() => play(!st.playing)} className="st-primary">{st.playing ? '❚❚ Pause' : '▶ Play'}</button>
        <button onClick={() => seek(0)} title="Back to the start">⏮</button>
        <button onClick={st.undo} disabled={!st.past.length} title="Undo (⌘Z)">↶</button>
        <button onClick={st.redo} disabled={!st.future.length} title="Redo (⇧⌘Z)">↷</button>
        <span className="st-seg">
          {(['9:16', '16:9'] as const).map((a) => <button key={a} className={st.aspect === a ? 'on' : ''} onClick={() => st.set({ aspect: a })}>{a === '9:16' ? '📱 9:16' : '🖥 16:9'}</button>)}
        </span>
        <button onClick={() => { play(false); setAdding(true) }} className={adding ? 'on' : ''} title="Add a light, entity, sound, title or fade at the playhead">✦ Effect</button>
        <select className="st-nav-speed" value={st.navSpeed} onChange={(e) => st.set({ navSpeed: +e.target.value })} title="Director navigation and pan speed">{[0.5, 1, 2, 4].map((n) => <option key={n} value={n}>Nav {n}×</option>)}</select>
        <button onClick={() => st.set({ guides: !st.guides })} className={st.guides ? 'on' : ''} title="Numbered camera points, clickable pipes, effect handles and live camera">◈</button>
        <button onClick={() => { const m = !useStore.getState().muted; useStore.getState().set({ muted: m }); Howler.mute(!st.playing || m) }} title="Audio follows this setting during Play. Pause and scrubbing are always silent.">{useStore.getState().muted ? '🔇' : '🔊'}</button>
        <a className="st-character-link" href="/?characters" title="Rig, procedural character motion, IK and keyframes">Character</a>
        <span className="st-grow" />
        <button onClick={record} disabled={recording} title="Plays this scene from the start and downloads it as a video">{recording ? '● Recording…' : '⏺ Record clip'}</button>
        <button onClick={save} className={dirty ? 'st-save dirty' : 'st-save'} title="Write to the scene file (⌘S)">{dirty ? '💾 Save changes' : '✓ Saved'}</button>
      </header>

      <div className="st-main">
        <div className="st-stagewrap">
          <div className="st-viewport">
            <Stage mode="director" />
            <div className="st-director-label">DIRECTOR · {st.view === 'orbit' ? 'FREE' : `${st.view.toUpperCase()} ORTHO`}</div>
            <div className="st-view-switch" aria-label="Director view">
              <button className={st.view === 'orbit' ? 'on' : ''} title="Free perspective" onClick={() => st.set({ view: 'orbit' })}>FREE</button>
              {(['top', 'bottom', 'left', 'right'] as const).map((v) => <button key={v} className={st.view === v ? 'on' : ''} title={`${v} view (${v[0].toUpperCase()})`} onClick={() => st.set({ view: v })}>{v[0].toUpperCase()}</button>)}
            </div>
            <div className="st-freehint">{st.view === 'orbit' ? 'LMB orbit · RMB/MMB pan · scroll fly-through · WASD/QE fly · Shift fast · F focus · Home overview · T/B/L/R ortho' : `${st.view.toUpperCase()} ORTHO · ${st.view === 'top' || st.view === 'bottom' ? 'X ↔ / Z ↕' : 'Z ↔ / Y ↕'} · RMB/MMB pan · scroll zoom · F focus · Home free`}</div>
            <div className={`st-preview ${st.aspect === '9:16' ? 'portrait' : 'landscape'}`}>
              <div className="st-preview-label">● FILM CAMERA · LIVE</div>
              <div className="st-preview-frame">
                <Stage mode="preview" />
                <PreviewOverlay />
              </div>
            </div>
          </div>
          <p className="st-status">{status || `${st.sceneId} · shot ${curShot + 1}/${cfg.shots.length} “${cfg.shots[curShot]?.id}” · ${t.toFixed(1)}s / ${cfg.duration.toFixed(1)}s`}</p>
        </div>

        <aside className="st-panel">
          {adding && <EffectCreator onClose={() => setAdding(false)} />}
          <section>
            <h3>Look of this scene</h3>
            <Slider label="Brightness" hint="Exposure for the whole scene" value={cfg.lighting.exposure ?? 1} min={0.3} max={3} onChange={(v) => st.edit((c) => void (c.lighting.exposure = v))} />
            <Slider label="Night glow" hint="Soft light from the cloudy sky, all directions (fake global illumination)" value={cfg.lighting.gi ?? 0.6} min={0} max={3} onChange={(v) => st.edit((c) => void (c.lighting.gi = v))} />
            <Slider label="Moonlight" hint="Cool light from behind the crossing — rims silhouettes" value={cfg.lighting.moon ?? 0.5} min={0} max={3} onChange={(v) => st.edit((c) => void (c.lighting.moon = v))} />
            <Slider label="Ambient" hint="Flat fill from sky and ground" value={cfg.lighting.ambientIntensity} min={0} max={3} onChange={(v) => st.edit((c) => void (c.lighting.ambientIntensity = v))} />
            <Slider label="Fog" hint="How quickly distance disappears into haze" value={cfg.lighting.fogDensity} min={0} max={0.08} step={0.001} onChange={(v) => st.edit((c) => void (c.lighting.fogDensity = v))} />
            <label className="st-slider"><span>Fog colour</span><input type="color" value={cfg.lighting.fogColor ?? '#232d39'} onChange={(e) => st.edit((c) => void (c.lighting.fogColor = e.target.value))} /></label>
          </section>

          {shot && (
            <section>
              <h3>Shot {sel!.index + 1}: <input className="st-name" value={shot.id} onChange={(e) => editShot((s) => void (s.id = e.target.value))} /></h3>
              <label className="st-slider"><span>Camera move</span>
                <select value={shot.type} onChange={(e) => editShot((s) => void (s.type = e.target.value as ShotType))}>
                  {SHOT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <Slider label="Length (s)" value={shot.duration} min={0.3} max={30} step={0.1} onChange={(v) => st.edit((c) => { setShotDuration(c.shots[sel!.index], v); c.duration = c.shots.reduce((sum, s) => sum + s.duration, 0) })} />
              <Slider label="Lens (16:9)" hint="Vertical field of view in degrees: small = telephoto, big = wide" value={shot.fov} min={8} max={90} step={1} onChange={(v) => editShot((s) => void (s.fov = v))} />
              <Slider label="Lens (9:16)" hint="Same, for phones" value={shot.fovPortrait ?? shot.fov * 1.45} min={8} max={100} step={1} onChange={(v) => editShot((s) => void (s.fovPortrait = v))} />
              <Slider label="Brightness" hint="This shot only (×scene)" value={shot.exposure ?? 1} min={0.3} max={3} onChange={(v) => editShot((s) => void (s.exposure = v))} />
              <Slider label="Face light" hint="Soft light from the camera so close subjects read" value={shot.eyeLight ?? 0} min={0} max={160} onChange={(v) => editShot((s) => void (s.eyeLight = v))} />
              <Slider label="Tilt (Dutch)" value={shot.roll ?? 0} min={-0.2} max={0.2} onChange={(v) => editShot((s) => void (s.roll = v))} />
              <div className="st-row">
                <button onClick={() => fromView(false)} title="Free camera on → frame it → click">📷 Use my view as START</button>
                <button onClick={() => fromView(true)} title="Where the camera ends up (moving shots)">📷 … as END</button>
              </div>
              <NudgeCamera index={sel!.index} />
              <CameraPathEditor shotIndex={sel!.index} />
              <div className="st-row">
                <button onClick={() => seek(shotStarts[sel!.index] + 0.01)}>⏵ Go to shot</button>
                <button onClick={() => editShot((s) => { s.type = 'static'; delete s.to; delete s.lookAtTo })}>Make it still</button>
                <button onClick={() => st.edit((c) => void c.shots.splice(sel!.index + 1, 0, { ...JSON.parse(JSON.stringify(shot)), id: shot.id + '_b', duration: 3 }))}>＋ Duplicate</button>
                <button className="st-danger" disabled={cfg.shots.length < 2} onClick={() => { st.edit((c) => void c.shots.splice(sel!.index, 1)); st.set({ sel: null }) }}>Delete</button>
              </div>
              {!shot.path && <details><summary>Exact numbers</summary>
                <VecField label="Start pos" value={shot.from} onChange={(v) => editShot((s) => void (s.from = v))} />
                <VecField label="Start looks at" value={shot.lookAt} onChange={(v) => editShot((s) => void (s.lookAt = v))} />
                <VecField label="End pos" value={shot.to} onChange={(v) => editShot((s) => void (s.to = v))} />
                <VecField label="End looks at" value={shot.lookAtTo} onChange={(v) => editShot((s) => void (s.lookAtTo = v))} />
              </details>}
            </section>
          )}

          {cue && (
            <section>
              <h3>{cueLabel(cue)}</h3>
              <Slider label="At (s)" value={cue.at} min={0} max={cfg.duration} step={0.05} onChange={(v) => editCue((c) => void (c.at = v))} />
              {cue.action === 'light' && (
                <label className="st-slider"><span>Light does</span>
                  <select value={cue.mode} onChange={(e) => editCue((c) => void ((c as typeof cue).mode = e.target.value as never))}>
                    {['on', 'off', 'flicker', 'dying'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
              )}
              {cue.action === 'entity' && (
                <>
                  <label className="st-check"><input type="checkbox" checked={cue.visible} onChange={(e) => editCue((c) => void ((c as typeof cue).visible = e.target.checked))} /> Visible</label>
                  <VecField label="Goes to" value={cue.position} onChange={(v) => editCue((c) => void ((c as typeof cue).position = v))} />
                  <button onClick={() => { const tg = useStudio.getState().target; if (tg) editCue((c) => void ((c as typeof cue).position = [r2(tg.x), 0, r2(tg.z)])) }} title="Free camera: the point you're orbiting around">📍 Put where the camera looks</button>
                  <Slider label="Speed m/s" hint="0 = appears there instantly" value={cue.speed ?? 0} min={0} max={8} step={0.05} onChange={(v) => editCue((c) => void ((c as typeof cue).speed = v))} />
                </>
              )}
              {(cue.action === 'sfx' || cue.action === 'ambience') && (
                <Slider label="Volume" value={cue.volume ?? 1} min={0} max={1} onChange={(v) => editCue((c) => void ((c as typeof cue).volume = v))} />
              )}
              <div className="st-row"><button onClick={() => seek(cue.at)}>⏵ Go to cue</button><button className="st-danger" onClick={() => { st.edit((c) => void c.cues.splice(sel!.index, 1)); st.set({ sel: null }) }}>Delete</button></div>
            </section>
          )}

          {!sel && (
            <section className="st-help">
              <h3>How to nudge a shot</h3>
              <ol>
                <li>Click a shot (top row of the timeline).</li>
                <li>Navigate freely in the large director view. Play never takes over that camera.</li>
                <li>Frame a new shot there; the film render stays visible in the small preview.</li>
                <li>Click <b>📷 Use my view as START</b> (and END if it moves).</li>
                <li><b>💾 Save</b> — the game uses it immediately.</li>
              </ol>
              <p>LMB orbit · RMB pan · scroll fly-through · WASD/QE fly · Shift fast · F focus · Home overview. Space = play, ←/→ = step, ⌘Z = undo. Audio plays only during Play.</p>
            </section>
          )}
        </aside>
      </div>

      <footer className="st-timeline">
        <div className="st-tl-bar">
          <button onClick={() => seek(0)} title="Back to the start">⏮</button>
          <span className="st-tl-time" title="Current time / total duration">{fmtTime(t)} <span className="st-tl-total">/ {fmtTime(cfg.duration)}</span></span>
          <span className="st-tl-spacer" />
          <button className={st.snap ? 'on' : ''} onClick={() => st.set({ snap: !st.snap })} title="Snap to shot boundaries, cue times and a 0.05s grid">🧲 Snap</button>
          <button onClick={() => zoomBy(0.8)} title="Zoom out (⌘/Ctrl + scroll)">−</button>
          <input className="st-tl-zoom" type="range" min={6} max={240} step={1} value={px} aria-label="Timeline zoom" title="Timeline pixels per second" onChange={(e) => zoomBy(Number(e.target.value) / px)} />
          <span className="st-tl-zoomvalue">{Math.round(px)}px/s</span>
          <button onClick={() => zoomBy(1.25)} title="Zoom in (⌘/Ctrl + scroll)">+</button>
          <button onClick={fitTimeline} title="Fit the whole scene to the timeline width">Fit</button>
        </div>
        <div className="st-tl-body">
          <div className="st-lane-labels">
            <div className="st-ruler-spacer" />
            <div>Shots</div>
            <div>Cues</div>
            <div>Dialogue</div>
          </div>
          <div className="st-tl-scroll" ref={scrollRef}>
            <div className="st-tracks" style={{ width: cfg.duration * px + 40 }} onPointerDown={(e) => { if ((e.target as HTMLElement).classList.contains('st-tracks') || (e.target as HTMLElement).classList.contains('st-ruler')) { seek(snapTime((e.clientX - e.currentTarget.getBoundingClientRect().left) / px)); dragOnTimeline(e, (sec) => seek(snapTime(sec))) } }}>
              <div className="st-ruler">
                {ticks.map((s) => { const major = Math.abs(s / step - Math.round(s / step)) < 1e-6; return <span key={s} className={major ? 'st-tick major' : 'st-tick minor'} style={{ left: s * px }}>{major ? fmtTime(s) : ''}</span> })}
              </div>
              <div className="st-row-shots">
                {cfg.shots.map((s, i) => (
                  <div key={i} className={`st-shot ${sel?.kind === 'shot' && sel.index === i ? 'sel' : ''}`} style={{ left: shotStarts[i] * px, width: s.duration * px - 2 }} onPointerDown={(e) => { e.stopPropagation(); st.set({ sel: { kind: 'shot', index: i } }) }} title={`${s.id} — ${s.duration.toFixed(1)}s`}>
                    <span className="st-shot-name">{s.id}</span>
                    <span className="st-shot-dur">{s.duration.toFixed(1)}s</span>
                    <i className="st-edge" title="Drag to change duration (snaps)" onPointerDown={(e) => { e.stopPropagation(); st.set({ sel: { kind: 'shot', index: i } }); dragOnTimeline(e, (sec) => editShotDuration(i, Math.max(0.3, r2(snapTime(sec) - shotStarts[i])))) }} />
                  </div>
                ))}
              </div>
              <div className="st-row-cues">
                {cues.map(({ c, i, own }, k) => (
                  <span key={k} className={`st-cue ${own ? '' : 'macro'} ${sel?.kind === 'cue' && sel.index === i ? 'sel' : ''}`} style={{ left: c.at * px }} title={own ? cueLabel(c) : `${cueLabel(c)} (from a technique macro — edit in the JSON)`}
                    onPointerDown={(e) => { e.stopPropagation(); if (!own) return; st.set({ sel: { kind: 'cue', index: i } }); dragOnTimeline(e, (sec) => st.edit((cc) => void (cc.cues[i].at = snapTime(sec)))) }}>◆</span>
                ))}
              </div>
              <div className="st-row-lines">
                {paced.filter((l) => !l.silent).map((l, k) => <span key={k} className="st-line" style={{ left: l.at * px, width: l.hold * px }} title={l.text}>{l.speaker === 'NARRATOR' ? '' : l.speaker + ': '}{l.text}</span>)}
              </div>
              <div className="st-playhead" style={{ left: t * px }} title="Drag to scrub">
                <span className="st-playhead-grab" onPointerDown={(e) => { e.stopPropagation(); dragOnTimeline(e, (sec) => seek(snapTime(sec))) }} />
              </div>
            </div>
          </div>
        </div>
      </footer>
      {jsonOpen && <JsonEditor onClose={() => setJsonOpen(false)} />}
    </div>
  )

  function editShotDuration(i: number, d: number) {
    st.edit((c) => { setShotDuration(c.shots[i], d); c.duration = c.shots.reduce((sum, s) => sum + s.duration, 0) })
  }
}

function CameraPathEditor({ shotIndex }: { shotIndex: number }) {
  const st = useStudio(), shot = st.cfg.shots[shotIndex]
  const nodeCount = shotPointCount(shot)
  const nodeIndex = Math.min(st.sel?.node ?? (st.cameraEnd ? nodeCount - 1 : 0), nodeCount - 1)
  if (!shot.path) return <button onClick={() => st.edit((c) => { c.shots[shotIndex].path = pathFromShot(c.shots[shotIndex]) })}>Enable Bézier handles</button>
  const path = shot.path, node = path.nodes[nodeIndex]
  const selectNode = (value: number) => st.set({ sel: { kind: 'shot', index: shotIndex, node: value }, cameraEnd: value === nodeCount - 1 })
  const handle = (field: 'in' | 'out' | 'aimIn' | 'aimOut', value: Vec3) => st.edit((c) => movePathHandle(c.shots[shotIndex].path!, nodeIndex, field, value))
  return <div className="st-path-editor">
    <div className="st-row"><button className={st.editAim ? 'on' : ''} onClick={() => st.set({ editAim: !st.editAim })}>{st.editAim ? 'Editing AIM · switch to position' : 'Editing position · switch to AIM'}</button></div>
    <div className="st-row">
      <select value={nodeIndex} onChange={(e) => selectNode(+e.target.value)}>
        {path.nodes.map((p, i) => <option key={p.id} value={i}>Point {p.id}{i === 0 || i === nodeCount - 1 ? ' · endpoint' : ''}</option>)}
      </select>
      <select value={node.mode} title="Linked handle behaviour" onChange={(e) => st.edit((c) => setNodeMode(c.shots[shotIndex].path!, nodeIndex, e.target.value as typeof node.mode))}>
        <option value="locked">Locked handles</option><option value="direction">Direction locked</option><option value="free">Free handles</option>
      </select>
    </div>
    <span className="st-hint">Blue on a pipe = slower · orange = faster. Points change speed, not cuts.</span>
    <div className="st-path-segments">{path.segments.map((s, i) => <div className="st-row" key={s.id}>
      <span>{s.id}</span><input type="number" min={0.05} max={30} step={0.05} value={r2(s.duration)} onChange={(e) => st.edit((c) => {
        const shot = c.shots[shotIndex], segment = shot.path!.segments[i]
        segment.duration = Math.max(0.05, Number(e.target.value) || 0.05)
        shot.duration = shot.path!.segments.reduce((sum, s) => sum + s.duration, 0)
        c.duration = c.shots.reduce((sum, s) => sum + s.duration, 0)
      })} /><span>s</span>
      <select value={s.easing} onChange={(e) => st.edit((c) => { c.shots[shotIndex].path!.segments[i].easing = e.target.value })}>
        {['none', 'sine.out', 'sine.inOut', 'power1.in', 'power1.out', 'power1.inOut', 'power2.inOut'].map((ease) => <option key={ease}>{ease}</option>)}
      </select>
    </div>)}</div>
    <details open={nodeIndex > 0 && nodeIndex < nodeCount - 1}><summary>Point position, aim and curve handles</summary>
      <VecField label="Position" value={node.position} onChange={(v) => st.edit((c) => moveCameraPoint(c.shots[shotIndex], nodeIndex, v))} />
      <VecField label="Incoming handle" value={node.in} onChange={(v) => handle('in', v)} />
      <VecField label="Outgoing handle" value={node.out} onChange={(v) => handle('out', v)} />
      <VecField label="Aim target" value={node.aim} onChange={(v) => st.edit((c) => moveCameraAim(c.shots[shotIndex], nodeIndex, v))} />
      <VecField label="Aim incoming" value={node.aimIn} onChange={(v) => handle('aimIn', v)} />
      <VecField label="Aim outgoing" value={node.aimOut} onChange={(v) => handle('aimOut', v)} />
    </details>
  </div>
}

function PreviewOverlay() {
  const blackout = useStore((s) => s.blackout)
  const showTitle = useStore((s) => s.showTitle)
  return <><div className="st-preview-blackout" style={{ opacity: blackout }} />{showTitle && <div className="st-preview-title">KAALI RAAT</div>}<Captions /></>
}

/** Captions over the preview (same text the player sees). */
function Captions() {
  const caption = useStore((s) => s.caption)
  return caption ? <p className="st-caption">{caption.speaker !== 'NARRATOR' && <b>{caption.speaker === 'AARAV' ? 'You' : caption.speaker} </b>}{caption.text}</p> : null
}
