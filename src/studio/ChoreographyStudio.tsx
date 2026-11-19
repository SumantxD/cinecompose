import { useEffect, useMemo, useRef, useState } from 'react'
import { useStudio } from './studioStore'
import { linesForScene } from './lines'
import { CCE_CATEGORIES, CCE_TEMPLATES } from '../cce/templates'
import { BY_ID, makeClip, recommendClip, sampleClip, validateCceTrack } from '../cce/engine'
import { cceFrame, trackFor } from '../cce/runtime'
import { type CceAction, type CceCategory, type CceClip, type CceEvent, type CceTrack } from '../cce/types'
import { validateScene } from '../cinematic/validate'
import * as player from '../app/player'
import { clock } from '../cinematic/clock'
import type { SceneConfig, Vec3 } from '../cinematic/types'
import './choreography.css'

const clone = <T,>(value: T): T => structuredClone(value)
const r2 = (n: number) => Math.round(n * 100) / 100
const freeId = (template: string, clips: CceClip[]) => {
  let id = `${template}-${clips.length + 1}`, suffix = clips.length + 1
  while (clips.some((clip) => clip.id === id)) id = `${template}-${++suffix}`
  return id
}
const EVENTS: [CceEvent, string][] = [
  ['sound-behind', 'Hears something'], ['discovery', 'Discovers evidence'], ['entity-appears', 'Entity appears'],
  ['entity-vanishes', 'Entity disappears'], ['chase', 'Runs / chase'], ['jumpscare', 'Impact / jumpscare'],
  ['unease', 'Suspicion / watched'], ['realisation', 'Realisation'], ['environment-reacts', 'Environment reacts'],
]
const categories = new Map(CCE_CATEGORIES)
const trackOf = (action: CceAction) => action.kind === 'camera' || action.kind === 'shake' ? 'camera' : ['chromatic', 'flash', 'blackout', 'text'].includes(action.kind) ? 'visual' : 'scene / audio'
const spanOf = (action: CceAction) => 'duration' in action ? action.duration : 'hold' in action ? action.hold : .012

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return <label className="cce-slider"><span>{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} /><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={r2(value)} onChange={(e) => onChange(+e.target.value)} /></label>
}

export function ChoreographyStudio({ onStatus, onExport }: { onStatus: (text: string) => void; onExport: () => void }) {
  const st = useStudio()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | CceCategory>('all')
  const [event, setEvent] = useState<CceEvent>('discovery')
  const [selectedId, setSelectedId] = useState('patient-push')
  const [clips, setClips] = useState<CceClip[]>(() => clone(st.cfg.props?.cce?.clips ?? []))
  const [active, setActive] = useState(0)
  const [live, setLive] = useState(false)
  const [insertAt, setInsertAt] = useState(st.t)
  const [run, setRun] = useState<{ start: number; end: number } | null>(null)
  const baseline = useRef<SceneConfig | null>(null)
  const selected = BY_ID.get(selectedId) ?? CCE_TEMPLATES[0]
  const clip = clips[active]
  const track = trackFor(clips)
  const errors = validateCceTrack(track, st.cfg.duration)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CCE_TEMPLATES.filter((template) => (category === 'all' || template.category === category) && (!q || `${template.name} ${template.description} ${template.events.join(' ')}`.toLowerCase().includes(q)))
  }, [query, category])
  const latest = clips.reduce((end, item) => Math.max(end, item.at + item.duration), 0)
  const targets = useMemo(() => ({
    lights: [...new Set(st.cfg.cues.filter((cue) => cue.action === 'light').map((cue) => cue.target))],
    entities: [...new Set([...st.cfg.cues.filter((cue) => cue.action === 'entity').map((cue) => cue.target), 'chudail'])],
  }), [st.cfg.sceneId])

  useEffect(() => {
    baseline.current = null; setLive(false); setRun(null)
    setClips(clone(st.cfg.props?.cce?.clips ?? [])); setActive(0); setInsertAt(st.t)
  }, [st.sceneId])

  useEffect(() => {
    if (st.cceSelection === null && live) return
    const saved = st.cfg.props?.cce?.clips ?? []
    setClips(clone(saved)); setActive(Math.min(st.cceSelection ?? 0, Math.max(0, saved.length - 1)))
  }, [st.cceSelection])

  useEffect(() => {
    if (live) document.querySelector('.cce-inspector')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active, live])

  useEffect(() => {
    if (!run) return
    let raf = 0
    const check = () => {
      if (clock.t >= run.end || !useStudio.getState().playing) {
        player.setPaused(true); useStudio.getState().set({ playing: false }); setRun(null); return
      }
      raf = requestAnimationFrame(check)
    }
    raf = requestAnimationFrame(check)
    return () => cancelAnimationFrame(raf)
  }, [run])

  function ensureBaseline() {
    if (!baseline.current) baseline.current = clone(st.cfg)
  }

  function apply(sequence: CceClip[], play = false, time?: number) {
    const nextTrack = trackFor(sequence), problems = validateCceTrack(nextTrack, st.cfg.duration)
    if (problems.length) { onStatus(problems[0]); return false }
    ensureBaseline()
    const next = clone(baseline.current!)
    next.props = { ...next.props, cce: nextTrack }
    if (!sequence.length) delete next.props.cce
    const sceneErrors = validateScene(next)
    if (sceneErrors.length) { onStatus(sceneErrors[0]); return false }
    const start = Math.max(0, Math.min(next.duration, time ?? (sequence[0]?.at ?? 0)))
    st.replace(next); setLive(true); st.set({ playing: play, t: start })
    player.previewScene(next, start, linesForScene(st.sceneId)); player.setPaused(!play)
    if (play && sequence.length) setRun({ start, end: Math.max(...sequence.map((item) => item.at + item.duration)) })
    else setRun(null)
    return true
  }

  function add(id: string, play = false, at?: number) {
    const template = BY_ID.get(id)!
    const start = at ?? Math.max(insertAt, latest)
    const shot = st.cfg.shots[Math.min(st.sel?.kind === 'shot' ? st.sel.index : 0, st.cfg.shots.length - 1)]
    const next = [...clips, makeClip(id, start, clips.length, { id: freeId(id, clips), light: targets.lights[0], position: [shot.lookAt[0], 0, shot.lookAt[2]], seed: 47 + clips.length * 73, text: template.requires?.includes('text') ? 'EDIT ME' : undefined })]
    if (apply(next, play, start)) { setClips(next); setActive(next.length - 1); setSelectedId(id); onStatus(play ? `Previewing ${template.name} on the film camera.` : `${template.name} added to the live working sequence. Nothing written to disk.`) }
  }

  function update(patch: Partial<CceClip>) {
    if (!clip) return
    const next = clips.map((item, i) => i === active ? { ...item, ...patch } : item)
    if (apply(next, false, st.playing ? clock.t : st.t)) { setClips(next); setRun(null) }
  }

  function discard() {
    if (!baseline.current) return
    const original = clone(baseline.current)
    st.replace(original); st.set({ playing: false })
    player.previewScene(original, st.t, linesForScene(st.sceneId)); player.setPaused(true)
    baseline.current = null; setLive(false); setRun(null)
    setClips(clone(original.props?.cce?.clips ?? [])); setActive(0)
    onStatus('Experiment discarded; the scene is back to its state before this CCE session.')
  }

  function sequence() {
    let at = insertAt
    const next = clips.map((item) => { const timed = { ...item, at: r2(at) }; at += item.duration; return timed })
    apply(next, false, insertAt) && setClips(next)
  }

  function loadScene() {
    setClips(clone(st.cfg.props?.cce?.clips ?? [])); setActive(st.cceSelection ?? 0)
    onStatus('Loaded all choreography clips from this scene.')
  }

  function exportJson() {
    if (errors.length) return onStatus(errors[0])
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(track, null, 2) + '\n'], { type: 'application/json' }))
    a.download = `${st.sceneId}.choreography.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    onStatus('Downloaded a reusable, versioned choreography track. It does not contain story or footage.')
  }

  async function importJson(file?: File) {
    if (!file) return
    try {
      if (file.size > 65536) throw new Error('Choreography imports are limited to 64 KB.')
      const value = JSON.parse(await file.text()) as CceTrack
      const problems = validateCceTrack(value, st.cfg.duration)
      if (problems.length) throw new Error(problems.join('\n'))
      const next = clone(value.clips)
      if (apply(next, false, next[0]?.at ?? 0)) { setClips(next); setActive(0); onStatus('Imported choreography into the working draft. Save explicitly when ready.') }
    } catch (error) { onStatus(`Import failed. Clips kept. ${error instanceof Error ? error.message : 'Invalid JSON.'}`) }
  }

  return <div className="cce-studio">
    <section className="cce-intro">
      <div className="cce-title-row"><h3>Cinematic Choreography Engine</h3><span className={`cce-live-dot ${live ? 'on' : ''}`}>{live ? 'LIVE DRAFT' : 'READY'}</span></div>
      <p className="st-help"><b>{CCE_TEMPLATES.length} editable techniques · 8 categories.</b> Layer camera, edit rhythm, reactions, horror, sound, environment and editorial beats over the current film shot.</p>
      <p className="st-hint">Add → preview → tune → combine. Changes are immediate and undoable; nothing is saved until you use Save changes. Ink, dialogue and choices are never changed.</p>
      <div className="cce-event-row"><select aria-label="Story event" value={event} onChange={(e) => setEvent(e.target.value as CceEvent)}>{EVENTS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><button onClick={() => {
        const suggestion = recommendClip({ event, intensity: .65, seed: 47 + clips.length, subjectDistance: 4, recent: clips.map((item) => ({ id: item.template, ago: Math.max(0, latest - item.at) })) })
        suggestion ? add(suggestion.id) : onStatus('Every matching technique is inside its cooldown. Adjust the sequence or choose directly.')
      }}>✦ Suggest &amp; add</button></div>
    </section>

    <section>
      <div className="cce-search"><input aria-label="Search choreography" placeholder="Search zoom, reveal, silence…" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Choreography category" value={category} onChange={(e) => setCategory(e.target.value as 'all' | CceCategory)}><option value="all">All categories</option>{CCE_CATEGORIES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
      <div className="cce-library" role="list" aria-label="Choreography templates">
        {list.map((template) => <article key={template.id} className={`cce-card ${selectedId === template.id ? 'selected' : ''}`} onClick={() => setSelectedId(template.id)}>
          <button className="cce-card-main" onClick={() => setSelectedId(template.id)}><b>{template.name}</b><span>{template.description}</span><small>{categories.get(template.category)} · {template.duration.toFixed(1)}s · {template.cost}</small></button>
          <div className="cce-card-actions"><button aria-label={`Add ${template.name}`} title="Add to the sequence" onClick={(e) => { e.stopPropagation(); add(template.id) }}>＋</button><button aria-label={`Preview ${template.name}`} title="Add and play on the current composition" onClick={(e) => { e.stopPropagation(); add(template.id, true) }}>▶</button></div>
        </article>)}
        {!list.length && <p className="st-hint">No matching technique. Try another category or a broader search.</p>}
      </div>
      <div className="cce-template-detail"><b>{selected.name}</b><span>Triggers: {selected.events.join(' · ')}</span>{selected.requires && <span>Needs: {selected.requires.join(', ')} target</span>}{selected.combines && <span>Combines: {selected.combines.join(', ')}</span>}</div>
    </section>

    <section>
      <div className="cce-title-row"><h3>Sequence · {clips.length} clips</h3><label className="cce-insert">at <input aria-label="Insert at" type="number" min={0} max={st.cfg.duration} step={.1} value={r2(insertAt)} onChange={(e) => setInsertAt(Math.max(0, Math.min(st.cfg.duration, +e.target.value)))} />s</label></div>
      <div className="cce-actions"><button className="st-primary" disabled={!clips.length || !!errors.length} onClick={() => apply(clips, true, clips[0]?.at ?? 0)}>▶ Preview sequence</button><button onClick={() => { st.set({ t: insertAt }); add(selected.id, false, insertAt) }}>＋ Add selected here</button><button disabled={!clips.length} onClick={sequence}>Align sequential</button></div>
      <div className="cce-actions"><button disabled={!clips.length} onClick={loadScene}>Load scene clips</button><button disabled={!baseline.current} onClick={discard}>Discard experiment</button><button onClick={onExport}>Reels &amp; MP4 →</button></div>
      {errors.length > 0 && <p className="st-json-error" role="alert">{errors.join('\n')}</p>}
      <div className="cce-sequence" aria-label="Choreography sequence">
        {clips.map((item, index) => <div key={item.id} className={`cce-clip-row ${index === active ? 'selected' : ''}`}>
          <button className="cce-clip-select" onClick={() => setActive(index)}><span>{String(index + 1).padStart(2, '0')}</span><b>{BY_ID.get(item.template)?.name ?? item.template}</b><small>{item.at.toFixed(2)} → {(item.at + item.duration).toFixed(2)}s</small></button>
          <div><button aria-label={`Preview ${item.id}`} onClick={() => apply([item], true, item.at)}>▶</button><button aria-label={`Delete ${item.id}`} onClick={() => { const next = clips.filter((_, i) => i !== index); apply(next, false, st.t); setClips(next); setActive(Math.max(0, active - 1)) }}>×</button></div>
        </div>)}
        {!clips.length && <p className="st-hint">Your sequence is empty. Choose ＋ on any technique above, or ask for a story-event suggestion.</p>}
      </div>
    </section>

    {clip && <section className="cce-inspector">
      <div className="cce-title-row"><h3>{BY_ID.get(clip.template)?.name ?? clip.template}</h3><button disabled={!run} onClick={() => { setRun(null); st.set({ playing: false }); player.setPaused(true) }}>❚❚</button></div>
      <p className="st-hint">Live on the current film composition. Strong settings are opt-in; camera and effects remain bounded.</p>
      <Slider label="At (s)" value={clip.at} min={0} max={Math.max(0, st.cfg.duration - clip.duration)} step={.05} onChange={(at) => update({ at })} />
      <Slider label="Duration" value={clip.duration} min={.1} max={Math.min(30, st.cfg.duration - clip.at)} step={.05} onChange={(duration) => update({ duration })} />
      <Slider label="Intensity" value={clip.intensity} min={0} max={1.5} step={.01} onChange={(intensity) => update({ intensity })} />
      <Slider label="Variation" value={clip.variation} min={0} max={1} step={.01} onChange={(variation) => update({ variation })} />
      <div className="cce-actions"><button onClick={() => update({ intensity: .3, variation: 0 })}>Subtle</button><button onClick={() => update({ intensity: .85, variation: .15 })}>Aggressive</button><button onClick={() => update({ intensity: 1.15, variation: .35 })}>Chaotic</button><button onClick={() => update({ seed: (clip.seed * 1664525 + 1013904223) >>> 0 })}>↻ New seed</button></div>
      <label className="cce-number"><span>Seed</span><input aria-label="Choreography seed" type="number" min={0} step={1} value={clip.seed} onChange={(e) => update({ seed: Math.max(0, Math.floor(+e.target.value)) })} /><span>Deterministic · {Math.round(sampleClip(clip, .5).truck * 1000) / 1000}m sample</span></label>
      {BY_ID.get(clip.template)?.requires?.includes('entity') && <label className="cce-field"><span>Entity target</span><input aria-label="CCE entity target" list="cce-entities" value={clip.entity ?? ''} onChange={(e) => update({ entity: e.target.value })} /><datalist id="cce-entities">{targets.entities.map((id) => <option key={id} value={id} />)}</datalist></label>}
      {BY_ID.get(clip.template)?.requires?.includes('light') && <label className="cce-field"><span>Light target</span><input aria-label="CCE light target" list="cce-lights" value={clip.light ?? ''} onChange={(e) => update({ light: e.target.value })} /><datalist id="cce-lights">{targets.lights.map((id) => <option key={id} value={id} />)}</datalist></label>}
      {BY_ID.get(clip.template)?.requires?.includes('text') && <label className="cce-field"><span>Editorial text</span><input aria-label="Editorial text" maxLength={48} placeholder="A short editorial word or phrase" value={clip.text ?? ''} onChange={(e) => update({ text: e.target.value })} /></label>}
      {(clip.entity || clip.position) && <div className="cce-position"><span>Placement</span>{(clip.position ?? [0, 0, 0]).map((n, i) => <input key={i} aria-label={`CCE position ${['X', 'Y', 'Z'][i]}`} type="number" step={.1} value={r2(n)} onChange={(e) => update({ position: (clip.position ?? [0, 0, 0]).map((v, j) => i === j ? +e.target.value : v) as Vec3 })} />)}<button onClick={() => { const target = st.target; if (target) update({ position: [r2(target.x), 0, r2(target.z)] }) }}>Use director aim</button></div>}

      <div className="cce-tracks" aria-label="Clip tracks">
        {(['camera', 'visual', 'scene / audio'] as const).map((lane) => <div className="cce-track" key={lane}><span>{lane}</span><div>{BY_ID.get(clip.template)?.actions.filter((action) => trackOf(action) === lane).map((action, i) => <i key={i} className={`cce-action cce-${action.kind}`} style={{ left: `${action.at * 100}%`, width: `${Math.max(1, spanOf(action) * 100)}%` }} title={`${action.kind} · ${(action.at * clip.duration).toFixed(2)}s`} />)}</div></div>)}
        <div className="cce-track"><span>sample</span><div><i className="cce-sample-line" style={{ left: '50%' }} /></div></div>
      </div>
      <p className="st-hint">{clip.text && cceFrame.text ? `Live text: “${cceFrame.text}”` : 'Camera / visual / scene-audio tracks scale with duration. Seed changes motion only, never randomly.'}</p>
      <div className="cce-actions"><button onClick={() => { const next = [...clips, { ...clone(clip), id: freeId(clip.template, clips), at: clip.at + clip.duration }]; if (apply(next, false, clip.at + clip.duration)) { setClips(next); setActive(next.length - 1) } }}>⧉ Duplicate after</button><button disabled={!!errors.length} onClick={exportJson}>Download JSON</button><label className="cce-import">Import JSON<input type="file" accept="application/json,.json" onChange={(e) => { void importJson(e.target.files?.[0]); e.currentTarget.value = '' }} /></label></div>
    </section>}
  </div>
}
