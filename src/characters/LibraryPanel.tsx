import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CharacterController } from './controller.ts'
import { DEFAULT_LIBRARY_SETTINGS, LIBRARY_DEFINITIONS } from './motion-pack.ts'
import type { AnimationCategory, AuthoringSettings } from './motion-pack.ts'
import { activeClip, useCharacter } from './store.ts'
import { exportAnimationPackGLB, saveData } from './export.ts'
import { retimeFaceKeys, validClip, type CharacterClip } from './types.ts'

export interface LibraryPanelHandle { stop: () => void; seek: (time: number) => void; restart: () => void }
interface Props { controller: CharacterController; playing: boolean; onPreview: (clip?: CharacterClip) => void; onFinish: (finished: boolean) => void; onStatus: (message: string) => void }
type LibraryCategory = 'All' | 'CC0 clips' | AnimationCategory
const categories: LibraryCategory[] = ['All', 'Idle', 'Locomotion', 'Reactions', 'Creature', 'Survival', 'Interactions', 'Face', 'CC0 clips']

export const LibraryPanel = memo(forwardRef<LibraryPanelHandle, Props>(function LibraryPanel({ controller, playing, onPreview, onFinish, onStatus }, ref) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(activeClip().libraryId ?? activeClip().source?.id ?? 'idle-breathing')
  const [settings, setSettings] = useState<AuthoringSettings>(DEFAULT_LIBRARY_SETTINGS)
  const [loop, setLoop] = useState(true)
  const [preview, setPreview] = useState<CharacterClip>()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const request = useRef(0)
  const current = LIBRARY_DEFINITIONS.find(entry => entry.id === selectedId) ?? LIBRARY_DEFINITIONS[0]
  const face = current.category === 'Face'
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = LIBRARY_DEFINITIONS.filter(entry => {
    const matchesCategory = category === 'All' || entry.category === category || (category === 'CC0 clips' && entry.origin === 'CC0')
    return matchesCategory && words.every(word => `${entry.name} ${entry.summary} ${entry.tags.join(' ')}`.toLowerCase().includes(word))
  })
  const stop = () => {
    request.current++
    if (loading) onStatus('Preview cancelled. Your saved clip is shown.')
    const state = useCharacter.getState()
    controller.stopClip(state.time)
    useCharacter.setState({ time: Math.max(0, Math.min(state.time, activeClip().duration)) })
    setLoading(false); setPreview(undefined); onPreview(undefined); onFinish(false); setConfirm(false)
  }
  useEffect(() => { if (playing) onFinish(false) }, [playing, onFinish])
  useImperativeHandle(ref, () => ({
    stop,
    seek(time) {
      if (loading) {
        stop()
        useCharacter.getState().setTime(time)
        onStatus('Preview load cancelled. Your saved clip is shown.')
        return
      }
      const clip = preview
      if (!clip?.source) return
      const safe = Number.isFinite(time) ? Math.max(0, Math.min(time, (clip.source.id.startsWith('face-') ? activeClip() : clip).duration)) : 0
      if (clip.source.id.startsWith('face-')) { controller.seekFace(safe * clip.duration / activeClip().duration, safe); controller.seekClip(safe, safe) }
      else void controller.playClip(clip.source.id, { ...clip.source, time: safe, offset: safe, transition: 0, loop: clip.loop })
      useCharacter.setState({ time: safe, playing: false })
      onFinish(false)
    },
    restart() {
      if (!preview) { useCharacter.getState().setTime(0); return }
      this.seek(0)
    },
  }))
  useEffect(() => () => { request.current++; controller.stopClip(useCharacter.getState().time) }, [controller])
  useEffect(() => {
    const clip = activeClip()
    if (!preview && clip.source?.id && controller.animations.library.byId.has(clip.source.id)) setSelectedId(clip.source.id)
  }, [])

  async function load(id: string, offset = 0, options = settings, mode = loop) {
    const token = ++request.current
    setSelectedId(id)
    setLoading(true)
    onStatus('Loading animation…')
    const definition = controller.animations.library.byId.get(id)
    try {
      if (!definition) throw new Error('Animation not found')
      const time = useCharacter.getState().time
      let clip: CharacterClip
      if (definition.category === 'Face') {
        clip = await controller.animations.library.getClip(id, options)
        const phase = preview?.source?.id === id ? offset : 0
        if (token === request.current) await controller.setFace(id, time - phase, playing ? .18 : 0, clip.duration / activeClip().duration, clip.source)
      } else {
        clip = await controller.playClip(id, { ...options, time: offset, offset, loop: definition.loop ? mode : false, transition: offset ? 0 : playing ? .24 : 0 })
      }
      if (token !== request.current) return
      setPreview(clip)
      if (definition.category !== 'Face') useCharacter.setState({ time: Math.min(offset, clip.duration) })
      setSettings(options)
      setLoop(clip.loop ?? mode)
      onPreview(clip)
      onFinish(false)
      onStatus(`${clip.name} ready. Preview only — saved clips are unchanged.`)
    } catch (error) {
      if (token !== request.current) return
      stop()
      onStatus(`Could not load animation: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally { if (token === request.current) setLoading(false) }
  }

  function apply() {
    if (!preview?.source) return
    const time = useCharacter.getState().time
    controller.stopClip(time)
    request.current++
    const id = preview.source.id
    const edits: CharacterClip = JSON.parse(JSON.stringify(preview))
    let candidate: CharacterClip
    if (id.startsWith('face-')) {
      const lengthScale = activeClip().duration / edits.duration
      retimeFaceKeys(edits.face, lengthScale)
      candidate = { ...activeClip(), face: edits.face, faceHead: edits.faceHead }
    } else {
      edits.id = activeClip().id
      candidate = { ...edits, libraryId: id, face: edits.face }
    }
    if (!validClip(candidate)) { onStatus('Could not apply. Invalid animation data; your clip is unchanged.'); stop(); return }
    useCharacter.getState().begin()
    if (id.startsWith('face-')) {
      useCharacter.getState().change(next => { next.face = edits.face; next.faceHead = edits.faceHead })
      onStatus(`${edits.name} applied to the active clip. Body motion kept. Undo is available.`)
    } else {
      useCharacter.getState().change(next => Object.assign(next, candidate, { face: edits.face, faceHead: edits.faceHead }))
      onStatus(`${edits.name} applied to the active clip. Undo is available.`)
    }
    stop()
    setConfirm(false)
  }

  async function download() {
    if (!preview) return
    setLoading(true)
    try {
      const data = await exportAnimationPackGLB(controller.rig, [preview])
      saveData(data, `${preview.name}.glb`, 'model/gltf-binary')
      onStatus(`Exported reusable ${preview.name}.glb. Your clip is unchanged.`)
    } catch (error) { onStatus(`Animation export failed: ${error instanceof Error ? error.message : 'unknown error'}`) }
    finally { setLoading(false) }
  }

  function adjust(next: AuthoringSettings, nextLoop = loop) {
    setSettings(next)
    setLoop(nextLoop)
    if (preview && selectedId) void load(selectedId, Math.min(useCharacter.getState().time, preview.duration), next, nextLoop)
  }

  return <div className="char-library">
    <div className="char-section-heading"><h2>Animation library</h2><span>{LIBRARY_DEFINITIONS.length} ready to use</span></div>
    <label className="char-search"><span className="sr-only">Search animations</span><input type="search" aria-label="Search animations" value={query} onChange={event => setQuery(event.target.value)} placeholder="Walk, crawl, fear…" /></label>
    <label className="char-field char-library-category"><span>Category</span><select aria-label="Animation category" value={category} onChange={event => setCategory(event.target.value as typeof category)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
    <div className="char-library-count" aria-live="polite">{filtered.length} animations{query ? ` matching “${query}”` : ''}</div>
    {filtered.length ? <div className="char-library-grid">{filtered.map(entry => <button className={`char-library-item ${selectedId === entry.id ? 'is-selected' : ''}`} aria-pressed={selectedId === entry.id} key={entry.id} onClick={() => { setConfirm(false); void load(entry.id, 0) }}>
      <span className="char-library-thumb" aria-hidden="true">{entry.pose ? <svg viewBox="0 0 20 24"><circle cx="10" cy="4" r="2.4" /><path d="M10 7 L10 15 M10 9 L5 13 M10 9 L15 13 M10 15 L6 22 M10 15 L14 22" /></svg> : <span>{entry.category === 'Face' ? '◇' : '↝'}</span>}<i /></span><span className="char-library-item-copy"><strong>{entry.name}</strong><small>{entry.origin} · {entry.duration.toFixed(1)}s</small></span>
    </button>)}</div> : <p className="char-library-empty">No animations match. Try another category or a shorter search.</p>}
    <div className="char-library-detail">
      <div><span className={`char-provenance ${current.origin === 'CC0' ? 'cc0' : ''}`}>{current.origin === 'CC0' ? 'CC0 · retargeted' : 'Authored motion'}</span><h3>{current.name}</h3><p>{current.summary}</p></div>
      <button className="char-wide char-library-use" disabled={!preview || loading} onClick={() => !face && Object.keys(activeClip().tracks).length && !confirm ? setConfirm(true) : apply()}>{face ? 'Use expression' : confirm ? 'Replace this clip? Yes, use it' : 'Use animation'}</button>
      <label className="char-field" title={face ? 'Expression timing follows the saved clip. Change Clip duration to retime it.' : 'Playback speed'}><span>Speed</span><input aria-label="Animation speed" type="range" min="0.5" max="1.75" step="0.05" value={face ? 1 : settings.speed} disabled={face} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) adjust({ ...settings, speed: event.target.valueAsNumber }) }} /><output>{face ? '—' : `${settings.speed.toFixed(2)}×`}</output></label>
      <label className="char-field"><span>Strength</span><input aria-label="Animation strength" type="range" min="0" max="1.5" step="0.05" value={settings.strength} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) adjust({ ...settings, strength: event.target.valueAsNumber }) }} /><output>{Math.round(settings.strength * 100)}%</output></label>
      <div className="char-library-toggles"><label className="char-check"><input aria-label="Mirror animation" type="checkbox" checked={settings.mirror} onChange={event => adjust({ ...settings, mirror: event.target.checked })} /> Mirror left / right</label><label className="char-check"><input aria-label="Loop animation" type="checkbox" checked={face || loop} disabled={!current.loop || face} onChange={event => adjust(settings, event.target.checked)} /> Loop motion</label></div>
      <button className="char-wide" disabled={!preview} onClick={() => { stop(); onStatus('Preview closed. Your saved clip is unchanged.') }}>Return to saved clip</button>
      <button className="char-wide" disabled={!preview || loading} title="Export the current variation as a reusable skeletal GLB" onClick={() => void download()}>Export animation .glb</button>
      <p className="char-note">{face ? 'Face presets keep body motion, gaze and pose keys. Expression timing fits the saved clip; change Clip duration to retime it.' : 'Preview first. Your custom pose stays saved until you choose Use animation. Every result is editable and undoable.'}</p>
      {controller.animationState?.finished && !playing && <p className="char-library-finished">Finished. Use ← to scrub, or ▶ Play to preview again.</p>}
    </div>
  </div>
}))
