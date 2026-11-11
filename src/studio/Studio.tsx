import { useEffect, useMemo, useState, type PointerEvent as RPointerEvent } from 'react'
import { Howler } from 'howler'
import { Stage } from '../app/Stage'
import * as player from '../app/player'
import { clock } from '../cinematic/clock'
import { useStore } from '../state/store'
import { SCENES, SCENE_FILES } from '../scenes/registry'
import { paceLines } from '../cinematic/timeline'
import { expandTechniques } from '../cinematic/techniques'
import { audioReady } from '../app/Overlay'
import { useStudio } from './studioStore'
import { linesForScene } from './lines'
import type { Cue, Shot, ShotType, Vec3 } from '../cinematic/types'
import './studio.css'

// KAALI RAAT Studio — nudge shots, timing and the look by hand, then Save back to the scene JSON.
// Open with ?studio (dev server). Everything edits the same files the game plays.

const SHOT_TYPES: [ShotType, string][] = [
  ['static', 'Still (locked off)'], ['slow_push', 'Slow push in'], ['pull_back', 'Pull back'], ['track_lateral', 'Tracking move'],
  ['pan', 'Pan / turn'], ['focus', 'Focus move'], ['over_shoulder', 'Over the shoulder'], ['low_angle', 'Low angle'],
  ['high_angle', 'High angle'], ['first_person', 'Through his eyes'], ['pov_walk', 'Walking POV'], ['security', 'Security camera'],
]
const PX = 26 // timeline pixels per second
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
  const dirty = JSON.stringify(cfg) !== st.saved
  const cues = useMemo(() => [...cfg.cues.map((c, i) => ({ c, i, own: true })), ...expandTechniques(cfg.techniques).map((c) => ({ c, i: -1, own: false }))], [cfg])
  const paced = useMemo(() => paceLines(lines).timed, [lines])

  // Any edit or seek re-renders the preview at the playhead.
  useEffect(() => {
    audioReady.then(() => player.previewScene(cfg, useStudio.getState().t, lines))
    player.setPaused(!useStudio.getState().playing)
  }, [cfg, lines])

  // Playhead follows the clock while playing.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (useStudio.getState().playing) {
        if (clock.t >= cfg.duration) useStudio.getState().set({ playing: false, t: cfg.duration })
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
    const file = SCENE_FILES.get(st.sceneId)!
    const json = JSON.stringify(cfg, null, 2) + '\n'
    const r = await fetch(`/__scene?file=${file}`, { method: 'POST', body: json })
    setStatus(r.ok ? `Saved ${file}` : 'Save failed — is the dev server running?')
    if (r.ok) st.set({ saved: JSON.stringify(cfg) })
  }
  const record = async () => {
    // Plays the scene from the top and records the canvas (+ sound) to a downloadable clip.
    const canvas = document.querySelector('.st-viewport canvas') as HTMLCanvasElement
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
    st.set({ free: false })
    seek(0)
    rec.start()
    play(true)
    setTimeout(() => rec.stop(), cfg.duration * 1000 + 300)
  }

  // Keyboard: Space play/pause, ←/→ nudge playhead, ⌘Z / ⇧⌘Z undo/redo, ⌘S save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return
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
  const shotStarts = cfg.shots.reduce<number[]>((a, _, i) => (a.push(i ? a[i - 1] + cfg.shots[i - 1].duration : 0), a), [])
  const curShot = Math.max(0, shotStarts.reduce((k, s0, i) => (s0 <= t + 1e-6 ? i : k), 0))
  const shot = sel?.kind === 'shot' ? cfg.shots[sel.index] : null
  const cue = sel?.kind === 'cue' ? cfg.cues[sel.index] : null
  const editShot = (fn: (s: Shot) => void) => st.edit((c) => fn(c.shots[sel!.index]))
  const editCue = (fn: (c: Cue) => void) => st.edit((c) => fn(c.cues[sel!.index]))
  const fromView = (end: boolean) => {
    const { camera, target } = useStudio.getState()
    if (!camera || !target) return setStatus('Turn on Free camera first, frame the shot, then click this.')
    editShot((s) => {
      if (end) { s.to = vec(camera.position); s.lookAtTo = vec(target) }
      else { s.from = vec(camera.position); s.lookAt = vec(target) }
    })
    setStatus(`Shot ${end ? 'END' : 'START'} set from your view.`)
  }
  const dragOnTimeline = (e: RPointerEvent, onMove: (sec: number) => void) => {
    const box = (e.currentTarget.closest('.st-tracks') as HTMLElement).getBoundingClientRect()
    const move = (ev: PointerEvent) => onMove((ev.clientX - box.left) / PX)
    const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up))
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="studio">
      <header className="st-top">
        <b>KAALI RAAT · Studio</b>
        <select value={st.sceneId} onChange={(e) => st.load(e.target.value)} title="Which scene to edit">
          {[...SCENES.keys()].map((id) => <option key={id}>{id}</option>)}
        </select>
        <button onClick={() => play(!st.playing)} className="st-primary">{st.playing ? '❚❚ Pause' : '▶ Play'}</button>
        <button onClick={() => seek(0)} title="Back to the start">⏮</button>
        <button onClick={st.undo} disabled={!st.past.length} title="Undo (⌘Z)">↶ Undo</button>
        <button onClick={st.redo} disabled={!st.future.length} title="Redo (⇧⌘Z)">↷ Redo</button>
        <span className="st-seg">
          {(['9:16', '16:9'] as const).map((a) => <button key={a} className={st.aspect === a ? 'on' : ''} onClick={() => st.set({ aspect: a })}>{a === '9:16' ? '📱 9:16' : '🖥 16:9'}</button>)}
        </span>
        <button onClick={() => st.set({ free: !st.free })} className={st.free ? 'on' : ''} title="Drag to orbit, scroll to zoom, right-drag to slide. Then use 'Use my view' on a shot.">🎥 Free camera {st.free ? 'ON' : 'off'}</button>
        <button onClick={() => { const m = !useStore.getState().muted; Howler.mute(m); useStore.getState().set({ muted: m }) }}>{useStore.getState().muted ? '🔇' : '🔊'}</button>
        <span className="st-grow" />
        <button onClick={record} disabled={recording} title="Plays this scene from the start and downloads it as a video">{recording ? '● Recording…' : '⏺ Record clip'}</button>
        <button onClick={save} className={dirty ? 'st-save dirty' : 'st-save'} title="Write to the scene file (⌘S)">{dirty ? '💾 Save changes' : '✓ Saved'}</button>
      </header>

      <div className="st-main">
        <div className="st-stagewrap">
          <div className={`st-viewport ${st.aspect === '9:16' ? 'portrait' : 'landscape'}`}>
            <Stage />
            <Captions />
            {st.free && <div className="st-freehint">Free camera — drag to orbit · scroll to zoom · right-drag to slide</div>}
          </div>
          <p className="st-status">{status || `${st.sceneId} · shot ${curShot + 1}/${cfg.shots.length} “${cfg.shots[curShot]?.id}” · ${t.toFixed(1)}s / ${cfg.duration.toFixed(1)}s`}</p>
        </div>

        <aside className="st-panel">
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
              <Slider label="Length (s)" value={shot.duration} min={0.3} max={30} step={0.1} onChange={(v) => editShot((s) => void (s.duration = v))} />
              <Slider label="Lens (16:9)" hint="Vertical field of view in degrees: small = telephoto, big = wide" value={shot.fov} min={8} max={90} step={1} onChange={(v) => editShot((s) => void (s.fov = v))} />
              <Slider label="Lens (9:16)" hint="Same, for phones" value={shot.fovPortrait ?? shot.fov * 1.45} min={8} max={100} step={1} onChange={(v) => editShot((s) => void (s.fovPortrait = v))} />
              <Slider label="Brightness" hint="This shot only (×scene)" value={shot.exposure ?? 1} min={0.3} max={3} onChange={(v) => editShot((s) => void (s.exposure = v))} />
              <Slider label="Face light" hint="Soft light from the camera so close subjects read" value={shot.eyeLight ?? 0} min={0} max={5} onChange={(v) => editShot((s) => void (s.eyeLight = v))} />
              <Slider label="Tilt (Dutch)" value={shot.roll ?? 0} min={-0.2} max={0.2} onChange={(v) => editShot((s) => void (s.roll = v))} />
              <div className="st-row">
                <button onClick={() => fromView(false)} title="Free camera on → frame it → click">📷 Use my view as START</button>
                <button onClick={() => fromView(true)} title="Where the camera ends up (moving shots)">📷 … as END</button>
              </div>
              <div className="st-row">
                <button onClick={() => seek(shotStarts[sel!.index] + 0.01)}>⏵ Go to shot</button>
                <button onClick={() => editShot((s) => { delete s.to; delete s.lookAtTo })}>Make it still</button>
                <button onClick={() => st.edit((c) => void c.shots.splice(sel!.index + 1, 0, { ...JSON.parse(JSON.stringify(shot)), id: shot.id + '_b', duration: 3 }))}>＋ Duplicate</button>
                <button className="st-danger" disabled={cfg.shots.length < 2} onClick={() => { st.edit((c) => void c.shots.splice(sel!.index, 1)); st.set({ sel: null }) }}>Delete</button>
              </div>
              <details><summary>Exact numbers</summary>
                <VecField label="Start pos" value={shot.from} onChange={(v) => editShot((s) => void (s.from = v))} />
                <VecField label="Start looks at" value={shot.lookAt} onChange={(v) => editShot((s) => void (s.lookAt = v))} />
                <VecField label="End pos" value={shot.to} onChange={(v) => editShot((s) => void (s.to = v))} />
                <VecField label="End looks at" value={shot.lookAtTo} onChange={(v) => editShot((s) => void (s.lookAtTo = v))} />
              </details>
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
                <li>Pause, then turn on <b>🎥 Free camera</b>.</li>
                <li>Drag in the picture to frame it the way you want.</li>
                <li>Click <b>📷 Use my view as START</b> (and END if it moves).</li>
                <li><b>💾 Save</b> — the game uses it immediately.</li>
              </ol>
              <p>Drag shot edges to change length. Drag the ◆ cues to retime lights, sounds and movement. Space = play, ←/→ = step, ⌘Z = undo.</p>
            </section>
          )}
        </aside>
      </div>

      <footer className="st-timeline">
        <div className="st-tracks" style={{ width: cfg.duration * PX + 40 }} onPointerDown={(e) => { if ((e.target as HTMLElement).classList.contains('st-tracks') || (e.target as HTMLElement).classList.contains('st-ruler')) { seek((e.clientX - e.currentTarget.getBoundingClientRect().left) / PX); dragOnTimeline(e, seek) } }}>
          <div className="st-ruler">{Array.from({ length: Math.ceil(cfg.duration) + 1 }, (_, s) => <span key={s} style={{ left: s * PX }}>{s % 5 ? '' : `${s}s`}</span>)}</div>
          <div className="st-row-shots">
            {cfg.shots.map((s, i) => (
              <div key={i} className={`st-shot ${sel?.kind === 'shot' && sel.index === i ? 'sel' : ''}`} style={{ left: shotStarts[i] * PX, width: s.duration * PX - 2 }} onPointerDown={(e) => { e.stopPropagation(); st.set({ sel: { kind: 'shot', index: i } }) }} title={`${s.id} — ${s.duration.toFixed(1)}s`}>
                {s.id}
                <i className="st-edge" onPointerDown={(e) => { e.stopPropagation(); st.set({ sel: { kind: 'shot', index: i } }); dragOnTimeline(e, (sec) => editShotDuration(i, Math.max(0.3, r2(sec - shotStarts[i])))) }} />
              </div>
            ))}
          </div>
          <div className="st-row-cues">
            {cues.map(({ c, i, own }, k) => (
              <span key={k} className={`st-cue ${own ? '' : 'macro'} ${sel?.kind === 'cue' && sel.index === i ? 'sel' : ''}`} style={{ left: c.at * PX }} title={own ? cueLabel(c) : `${cueLabel(c)} (from a technique macro — edit in the JSON)`}
                onPointerDown={(e) => { e.stopPropagation(); if (!own) return; st.set({ sel: { kind: 'cue', index: i } }); dragOnTimeline(e, (sec) => st.edit((cc) => void (cc.cues[i].at = Math.max(0, Math.round(sec * 20) / 20)))) }}>◆</span>
            ))}
          </div>
          <div className="st-row-lines">
            {paced.filter((l) => !l.silent).map((l, k) => <span key={k} className="st-line" style={{ left: l.at * PX, width: l.hold * PX }} title={l.text}>{l.speaker === 'NARRATOR' ? '' : l.speaker + ': '}{l.text}</span>)}
          </div>
          <div className="st-playhead" style={{ left: t * PX }} />
        </div>
      </footer>
    </div>
  )

  function editShotDuration(i: number, d: number) {
    st.edit((c) => void (c.shots[i].duration = d))
  }
}

/** Captions over the preview (same text the player sees). */
function Captions() {
  const caption = useStore((s) => s.caption)
  return caption ? <p className="st-caption">{caption.speaker !== 'NARRATOR' && <b>{caption.speaker === 'AARAV' ? 'You' : caption.speaker} </b>}{caption.text}</p> : null
}
