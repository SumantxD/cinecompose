import { useEffect, useRef, useState } from 'react'
import { ChoreographyStudio } from './ChoreographyStudio'
import { SCENES, SCENE_FILES } from '../scenes/registry'
import { validateScene } from '../cinematic/validate.ts'
import { CHOREOGRAPHY_PRESETS, DEFAULT_OUTLINE, choreographScene, inkOutline, parseOutline, type ChoreographyPlan } from '../cinematic/choreography.ts'
import { useStudio } from './studioStore'
import { exportReel, type ReelResult, type ReelSize } from './exportReel.ts'
import { linesForScene } from './lines'

export function ChoreographyPanel({ onStatus }: { onStatus: (text: string) => void }) {
  const [mode, setMode] = useState<'studio' | 'reels'>('studio')
  const st = useStudio()
  const [sceneId, setSceneId] = useState('pressure_control_room')
  const [preset, setPreset] = useState('control-room-pressure')
  const [outline, setOutline] = useState(DEFAULT_OUTLINE)
  const [mirror, setMirror] = useState(false)
  const [lens, setLens] = useState(0)
  const [cut, setCut] = useState<ChoreographyPlan['cut']>('hard')
  const [endCard, setEndCard] = useState(true)
  const [size, setSize] = useState<ReelSize>('720')
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(Math.min(15, st.cfg.duration))
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<ReelResult | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => { if (st.cceSelection !== null) setMode('studio') }, [st.cceSelection])

  useEffect(() => {
    const plan = st.cfg.props?.choreography
    setOutline(plan?.outline ?? DEFAULT_OUTLINE); setPreset(plan?.preset ?? 'control-room-pressure')
    setMirror(plan?.mirror ?? false); setLens(plan?.lens ?? 0); setCut(plan?.cut ?? 'hard'); setEndCard(plan?.endCard ?? true)
    setInPoint(0); setOutPoint(Math.min(15, st.cfg.duration)); setResult(null); setProgress('')
  }, [st.sceneId])

  const options = { preset, mirror, lens, cut, endCard }
  let preview: ReturnType<typeof parseOutline> = []
  let outlineError = ''
  try { preview = parseOutline(outline, preset) } catch (error) { outlineError = error instanceof Error ? error.message : 'Invalid outline.' }
  const isControlRoom = st.cfg.environment === 'control-room'

  async function generate() {
    const id = sceneId.trim()
    if (!/^[a-z][\w-]{2,63}$/.test(id)) return onStatus('Scene id must start with a lowercase letter; 3–64 letters, numbers, _ or - only.')
    if (SCENES.has(id)) return onStatus(`Scene "${id}" already exists. Choose a new id; nothing was overwritten.`)
    if (outlineError) return onStatus(outlineError)
    const next = choreographScene(id, outline, options, st.cfg)
    const errors = validateScene(next)
    if (errors.length) return onStatus(errors.join(' · '))
    try {
      const file = `control-room/${id}.json`
      const response = await fetch(`/__scene?file=${file}`, { method: 'POST', body: JSON.stringify(next, null, 2) + '\n' })
      if (!response.ok) return onStatus(`Create failed · ${await response.text()}`)
      SCENES.set(id, next); SCENE_FILES.set(id, file); st.load(id); st.set({ aspect: '9:16' })
      onStatus(`Created ${file}. Preview it, adjust shots, save, or export below.`)
    } catch { onStatus('Create failed — is the local dev server running?') }
  }

  function apply() {
    if (outlineError) return onStatus(outlineError)
    if (!isControlRoom || st.cfg.props?.referenceStudy) return onStatus('This preset creates procedural scenes only. Imported reference shots and other environments are untouched; generate a new scene instead.')
    st.replace(choreographScene(st.sceneId, outline, options, st.cfg))
    st.set({ t: 0, sel: null }); onStatus('Re-cut this procedural draft. Undo restores the previous cameras. Save when you are happy.')
  }

  function downloadInk() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([inkOutline(st.cfg)], { type: 'text/plain' }))
    a.download = `${st.sceneId}.direction.ink`; a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    onStatus('Downloaded an Ink direction draft. It is not imported into the episode; story choices remain yours.')
  }

  async function runExport() {
    const st = useStudio.getState(), controller = new AbortController()
    const aspect = size.includes('landscape') ? '16:9' : '9:16'
    setExporting(true); setResult(null); setProgress('Preparing the film renderer…')
    abort.current = controller
    st.set({ exporting: true, playing: false, aspect })
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const result = await exportReel(st.cfg, linesForScene(st.sceneId), { start: inPoint, end: outPoint, size, signal: controller.signal, onProgress: (done, total) => setProgress(`Capturing frame ${done}/${total} · keep this tab visible`) })
      setResult(result); setProgress(`${result.frames} frames at 30 fps · ${result.duration.toFixed(2)} s · silent MP4`)
      onStatus(`Reel ready: ${result.file}. No source video or private images were uploaded.`)
    } catch (error) {
      const message = controller.signal.aborted ? 'Export cancelled. Partial local frames were removed.' : error instanceof Error ? error.message : 'Export failed.'
      setProgress(message); onStatus(message)
    } finally {
      useStudio.getState().set({ exporting: false })
      setExporting(false); abort.current = null
    }
  }

  return <>
    <div className="cce-workspace-switch"><button aria-pressed={mode === 'studio'} className={mode === 'studio' ? 'on' : ''} onClick={() => setMode('studio')}>Technique Studio</button><button aria-pressed={mode === 'reels'} className={mode === 'reels' ? 'on' : ''} onClick={() => setMode('reels')}>Beat plan &amp; MP4</button></div>
    {mode === 'studio' ? <ChoreographyStudio onStatus={onStatus} onExport={() => setMode('reels')} /> : <div className="st-choreography">
    <section>
      <h3>Control-room choreography</h3>
      <p className="st-help">A repeatable film grammar, not an animated-video wrapper: a visual beat outline becomes editable shot directions, cameras and timing.</p>
      <ol className="st-help"><li>Write visible actions, one per sentence or line.</li><li>Generate a <b>new</b> procedural scene.</li><li>Preview and tune its ordinary shots; save it.</li><li>Export a stepped, composed MP4.</li></ol>
    </section>
    <section>
      <h3>1 · Story beat outline</h3>
      <label className="st-field"><span>Preset</span><select aria-label="Choreography preset" value={preset} onChange={(e) => setPreset(e.target.value)}>{CHOREOGRAPHY_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <p className="st-hint">{CHOREOGRAPHY_PRESETS.find((p) => p.id === preset)?.description}</p>
      <textarea aria-label="Story beat outline" maxLength={4000} rows={7} value={outline} onChange={(e) => setOutline(e.target.value)} />
      <p className="st-hint">Offline grammar suggestions only, not an AI-written story. “Clock stops”, “figure on the monitor” and “signal lost” also change matching procedural details. Preview the result and edit anything you disagree with.</p>
      {outlineError ? <p className="st-json-error">{outlineError}</p> : <div className="st-beat-list">{preview.map((beat) => <div key={beat.id}><b>{beat.role}</b><span>{beat.duration.toFixed(1)}s · {beat.note}</span></div>)}</div>}
    </section>
    <section>
      <h3>2 · Format mappings</h3>
      <label className="st-slider"><span>Cut rhythm</span><select aria-label="Cut rhythm" value={cut} onChange={(e) => setCut(e.target.value as ChoreographyPlan['cut'])}><option value="hard">Hard cuts</option><option value="dip">Short dip between cuts</option></select></label>
      <label className="st-slider"><span>Lens offset</span><input aria-label="Lens offset" type="number" min={-12} max={12} step={1} value={lens} onChange={(e) => setLens(Math.max(-12, Math.min(12, +e.target.value)))} /><span>degrees</span></label>
      <label className="st-check"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Reverse horizontal camera placement</label>
      <label className="st-check"><input type="checkbox" checked={endCard} onChange={(e) => setEndCard(e.target.checked)} /> End on “What would you do?”</label>
      <p className="st-hint">The end card is an editorial reel prompt, not an Ink choice. Camera types, placement, lens and duration remain separately editable per shot.</p>
      <label className="st-field"><span>New scene id</span><input aria-label="New choreography scene id" value={sceneId} onChange={(e) => setSceneId(e.target.value)} /></label>
      <button className="st-primary" disabled={st.exporting || !!outlineError} onClick={generate}>＋ Generate &amp; save new scene</button>
      <button className="st-secondary" disabled={st.exporting || !!outlineError || st.cfg.environment !== 'control-room' || !!st.cfg.props?.referenceStudy} title="For generated procedural control-room scenes only" onClick={apply}>Re-cut current procedural scene (undoable)</button>
      {!st.cfg.props?.choreography && <p className="st-hint">This scene has no saved choreography plan. Generating keeps it untouched and creates a separate file.</p>}
      {st.cfg.props?.choreography && <div className="st-row"><button onClick={downloadInk}>Export Ink direction draft</button><button onClick={() => st.set({ panelTab: 'scene' })}>Tune shots &amp; cameras</button></div>}
    </section>
    <section>
      <h3>3 · Director reel export</h3>
      <label className="st-field"><span>Output size</span><select aria-label="Reel output size" value={size} onChange={(e) => setSize(e.target.value as ReelSize)}><option value="720">Draft portrait · 720×1280</option><option value="1080">Reel portrait · 1080×1920</option><option value="720-landscape">Draft landscape · 1280×720</option><option value="1080-landscape">Landscape · 1920×1080</option></select></label>
      <label className="st-field"><span>In (seconds)</span><input aria-label="Reel in point" type="number" min={0} max={st.cfg.duration} step={.1} value={inPoint} onChange={(e) => setInPoint(+e.target.value)} /></label>
      <label className="st-field"><span>Out (seconds)</span><input aria-label="Reel out point" type="number" min={.1} max={st.cfg.duration} step={.1} value={outPoint} onChange={(e) => setOutPoint(+e.target.value)} /></label>
      <button className="st-primary" disabled={exporting} onClick={runExport}>{exporting ? 'Exporting director frames…' : 'Export stepped MP4'}</button>
      {exporting && <button onClick={() => abort.current?.abort()}>Cancel export</button>}
      <p className="st-hint">Deterministic 30 fps scene-clock stepping, actual postprocessed film frames, burned-in captions/title and fades. No editor chrome or choice buttons. <b>Silent in this first version</b>; Record clip is the separate real-time option with audio. Local FFmpeg required. Duration: {st.cfg.duration.toFixed(2)}s.</p>
      {progress && <p className="st-export-status" role="status" aria-live="polite">{progress}</p>}
      {result && <p><a className="st-download" href={result.url} download>Download MP4 · {result.file}</a></p>}
      {st.cfg.props?.referenceStudy && <p className="st-warning">Reference frames are rights-unverified and marked in the export as unreleased. This is a local 2.5D study, not approved reconstruction or release footage.</p>}
    </section>
  </div>}
  </>
}
