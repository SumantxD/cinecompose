import { useState } from 'react'
import { clock } from '../cinematic/clock'
import { validateScene } from '../cinematic/validate.ts'
import { getCameraPoint, moveCameraAim, moveCameraPoint, shotPointCount } from '../cinematic/curve.ts'
import type { Cue, LightMode, SceneConfig, Vec3 } from '../cinematic/types'
import { ENVIRONMENTS } from '../scenes/registry'
import { useStudio } from './studioStore'

const r2 = (n: number) => Math.round(n * 100) / 100
export function EffectCreator({ onClose }: { onClose: () => void }) {
  const st = useStudio()
  const [action, setAction] = useState<Cue['action']>('entity')
  const [target, setTarget] = useState('chudail')
  const [at, setAt] = useState(r2(st.playing ? clock.t : st.t))
  const [volume, setVolume] = useState(0.3)
  const [mode, setMode] = useState<LightMode>('on')
  const [visible, setVisible] = useState(true)
  const [fadeTo, setFadeTo] = useState(1)
  const target3d = st.target
  const [position, setPosition] = useState<Vec3>(target3d ? [r2(target3d.x), 0, r2(target3d.z)] : [0, 0, 0])
  const defaults: Partial<Record<Cue['action'], string>> = { entity: 'chudail', light: 'sodium_far', sfx: 'signal', ambience: 'rain' }
  const targets = [...new Set(st.cfg.cues.flatMap((c) => 'target' in c ? [c.target] : 'sound' in c ? [c.sound] : []))]

  const add = () => {
    if (!target.trim() && action !== 'title' && action !== 'fade') return
    const name = target.trim()
    const time = Number.isFinite(at) ? Math.max(0, Math.min(st.cfg.duration, at)) : 0
    let cue: Cue
    switch (action) {
      case 'entity': cue = { at: time, action, target: name, visible, position }; break
      case 'light': cue = { at: time, action, target: name, mode }; break
      case 'sfx': cue = { at: time, action, sound: name, volume, position }; break
      case 'ambience': cue = { at: time, action, sound: name, volume }; break
      case 'title': cue = { at: time, action, visible }; break
      case 'fade': cue = { at: time, action, to: fadeTo, duration: 1 }; break
    }
    const index = st.cfg.cues.length
    st.edit((c) => void c.cues.push(cue))
    st.set({ sel: { kind: 'cue', index }, t: time, playing: false })
    onClose()
  }

  return (
    <section className="st-effect-creator">
      <h3>✦ Add effect <button onClick={onClose} title="Close">×</button></h3>
      <label className="st-slider"><span>Effect</span><select value={action} onChange={(e) => {
        const next = e.target.value as Cue['action']
        setAction(next)
        setTarget(defaults[next] ?? '')
      }}>
        <option value="entity">Entity / actor</option><option value="light">Light cue</option>
        <option value="sfx">3D sound</option><option value="ambience">Ambience</option>
        <option value="title">Title</option><option value="fade">Fade</option>
      </select></label>
      {action !== 'title' && action !== 'fade' && <>
        <label className="st-slider"><span>{action === 'sfx' || action === 'ambience' ? 'Sound id' : 'Target id'}</span><input list="st-effect-targets" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        <datalist id="st-effect-targets">{targets.map((id) => <option key={id}>{id}</option>)}</datalist>
      </>}
      <label className="st-slider"><span>At (s)</span><input type="number" min={0} max={st.cfg.duration} step={0.05} value={at} onChange={(e) => setAt(r2(+e.target.value))} /></label>
      {action === 'light' && <label className="st-slider"><span>Light does</span><select value={mode} onChange={(e) => setMode(e.target.value as LightMode)}>{['on', 'off', 'flicker', 'dying'].map((m) => <option key={m}>{m}</option>)}</select></label>}
      {(action === 'sfx' || action === 'ambience') && <label className="st-slider"><span>Volume</span><input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(+e.target.value)} /><input type="number" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(+e.target.value)} /></label>}
      {(action === 'entity' || action === 'title') && <label className="st-check"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visible / appear</label>}
      {action === 'fade' && <label className="st-slider"><span>Fade</span><select value={fadeTo} onChange={(e) => setFadeTo(+e.target.value)}><option value={1}>To black</option><option value={0}>From black</option></select></label>}
      {(action === 'entity' || action === 'sfx') && <>
        <div className="st-vec"><span>Position</span>{position.map((n, i) => <input key={i} type="number" step={0.1} value={n} onChange={(e) => setPosition(position.map((x, k) => k === i ? +e.target.value : x) as Vec3)} />)}</div>
        <button disabled={!target3d} onClick={() => target3d && setPosition([r2(target3d.x), action === 'sfx' ? r2(target3d.y) : 0, r2(target3d.z)])}>📍 Use 3D camera target</button>
      </>}
      <div className="st-row"><button className="st-primary" onClick={add}>Add at playhead</button><span className="st-hint">Drag its ◆ to retime · drag its world marker to move</span></div>
    </section>
  )
}

export function NudgeCamera({ index }: { index: number }) {
  const st = useStudio()
  const [step, setStep] = useState(0.1)
  const shot = st.cfg.shots[index]
  const last = shotPointCount(shot) - 1
  const node = Math.min(st.sel?.node ?? (st.cameraEnd ? last : 0), last)
  const end = node === last
  const nudge = (axis: number, direction: number) => st.edit((c) => {
    const shot = c.shots[index], current = getCameraPoint(shot, node)
    const position = [...current.position] as Vec3, aim = [...current.aim] as Vec3
    position[axis] = r2(position[axis] + step * direction)
    aim[axis] = r2(aim[axis] + step * direction)
    moveCameraPoint(shot, node, position)
    moveCameraAim(shot, node, aim)
  })
  return (
    <div className="st-nudge">
      <div className="st-row">
        <button className={!end ? 'on' : ''} onClick={() => st.set({ sel: { kind: 'shot', index, node: 0 }, cameraEnd: false })}>START</button>
        <button className={end ? 'on' : ''} onClick={() => st.set({ sel: { kind: 'shot', index, node: last }, cameraEnd: true })}>END</button>
        <b>Point {node + 1}</b>
        <select value={step} onChange={(e) => setStep(+e.target.value)} title="Nudge distance in metres">{[0.05, 0.1, 0.25, 0.5, 1].map((n) => <option key={n} value={n}>{n} m</option>)}</select>
      </div>
      <div className="st-row">{['X', 'Y', 'Z'].flatMap((axis, i) => [-1, 1].map((d) => <button key={`${axis}${d}`} onClick={() => nudge(i, d)}>{axis}{d < 0 ? '−' : '+'}</button>))}</div>
      <span className="st-hint">Camera and aim move together. Yellow handles translate; smaller grey handles bend the path.</span>
    </div>
  )
}

export function JsonEditor({ onClose }: { onClose: () => void }) {
  const st = useStudio()
  const [text, setText] = useState(() => JSON.stringify(st.cfg, null, 2))
  const [error, setError] = useState('')
  const apply = () => {
    try {
      const next = JSON.parse(text) as SceneConfig
      if (next.sceneId !== st.sceneId) return setError('Use ＋ Scene or ⧉ Duplicate to change a scene id.')
      if (!ENVIRONMENTS[next.environment]) return setError(`Unknown environment "${next.environment}".`)
      if (Array.isArray(next.shots)) next.duration = +next.shots.reduce((a, s) => a + (Number(s.duration) || 0), 0).toFixed(3)
      const errors = validateScene(next)
      if (errors.length) return setError(errors.join('\n'))
      st.replace(next)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div className="st-modal" onClick={onClose}>
      <section onClick={(e) => e.stopPropagation()}>
        <header><b>Scene JSON · {st.sceneId}</b><button onClick={onClose}>×</button></header>
        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Scene JSON" />
        {error && <pre className="st-json-error">{error}</pre>}
        <footer><span>Includes technique macros and every cue. Applying is one undo step.</span><button className="st-primary" onClick={apply}>Apply to preview</button></footer>
      </section>
    </div>
  )
}
