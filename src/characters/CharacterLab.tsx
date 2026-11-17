import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as THREE from 'three'
import { CharacterViewport } from './CharacterViewport.tsx'
import { createCharacter } from './index.ts'
import { activeClip, flipPlayback, keyIK, keyPosition, keyRotation, removeKeys, useCharacter } from './store.ts'
import { exportCharacterGLB, saveData } from './export.ts'
import { LibraryPanel, type LibraryPanelHandle } from './LibraryPanel.tsx'
import { boneLabel, sampleIKTarget } from './pose.ts'
import { BONE_NAMES, retimeClip } from './types.ts'
import type { CharacterClip, CharacterMotion, IKTarget, Vec3 } from './types.ts'
import './character.css'

const boneNames = BONE_NAMES
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return <label className="char-field"><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}
function Numbers({ values, onChange, step = 1 }: { values: number[]; onChange: (values: number[]) => void; step?: number }) {
  return <div className="char-numbers">{values.map((value, index) => <input key={index} aria-label={['X','Y','Z'][index]} type="number" step={step} value={Number(value.toFixed(3))} onChange={(event) => {
    const next = [...values]
    const number = event.target.valueAsNumber
    if (Number.isFinite(number)) { next[index] = number; onChange(next) }
  }} />)}</div>
}

export function CharacterLab() {
  const controller = useMemo(() => createCharacter(), [])
  const camera = useRef<THREE.Camera | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState('head')
  const [mode, setMode] = useState<'rotate'|'translate'>('rotate')
  const [poseValues, setPoseValues] = useState<{ key: string; values: number[] }>()
  const onPoseValues = useCallback((key: string, values: number[]) => setPoseValues({ key, values }), [])
  const [joints, setJoints] = useState(true)
  const [panel, setPanel] = useState<'pose'|'motion'|null>(null)
  const [libraryMode, setLibraryMode] = useState(true)
  const [preview, setPreview] = useState<CharacterClip>()
  const [previewFinished, setPreviewFinished] = useState(false)
  const library = useRef<LibraryPanelHandle>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(useCharacter.getState().recovery ? 'Draft unreadable. Download Recovery JSON.' : 'Saved in this browser.')
  const state = useCharacter()
  const clip = activeClip(), motion = clip.motion
  const liveValues = poseValues?.key === `${selected}-${mode}` ? poseValues.values : undefined
  const onCamera = useCallback((value: THREE.Camera) => { camera.current = value; setReady(true) }, [])
  const choose = (part: string) => { setSelected(part); setMode(part === 'root' || part.startsWith('ik:') ? 'translate' : 'rotate') }
  const validSelection = () => {
    if (selected.startsWith('ik:') && !activeClip().motion.reach?.[selected.slice(3) as IKTarget]) choose(`${selected.startsWith('ik:left') ? 'left' : 'right'}Elbow`)
  }
  const undo = () => { library.current?.stop(); state.undo(); validSelection() }
  const redo = () => { library.current?.stop(); state.redo(); validSelection() }
  const patch = <K extends keyof CharacterMotion>(key: K, value: CharacterMotion[K]) => { library.current?.stop(); state.setMotion({ ...motion, [key]: value }) }
  const record = (fn: () => void) => { library.current?.stop(); state.begin(); useCharacter.setState({ playing: false }); fn() }
  const facePreview = !!preview?.source?.id.startsWith('face-')
  const shownClip = facePreview ? clip : preview ?? clip
  const setTime = (time: number) => { if (preview) library.current?.seek(time); else useCharacter.getState().setTime(time) }
  const togglePlayback = useCallback(() => {
    if (!useCharacter.getState().playing && (previewFinished || state.time >= shownClip.duration)) library.current?.restart()
    flipPlayback()
  }, [preview, previewFinished, shownClip, state.time])
  const savedClip = (id: string) => { library.current?.stop(); state.selectClip(id); validSelection() }
  const bone = selected.startsWith('ik:') ? null : controller.rig.bones[selected]
  const target = selected.startsWith('ik:') ? controller.rig.group.getObjectByName(`target:${selected.slice(3)}`) : null
  const setIK = (side: IKTarget) => {
    const existing = motion.reach?.[side]
    if (existing) {
      const reach = { ...motion.reach }; delete reach[side]
      patch('reach', reach)
      if (selected === `ik:${side}`) choose(`${side === 'leftHand' ? 'left' : 'right'}Elbow`)
      return
    }
    controller.update(state.time, { clip, clipTime: state.time, cameraPosition: camera.current?.position })
    const there = sampleIKTarget(clip, side, state.time) ?? controller.rig.bones.root.worldToLocal(controller.rig.bones[`${side === 'leftHand' ? 'left' : 'right'}Wrist`].getWorldPosition(new THREE.Vector3()))
    patch('reach', { ...motion.reach, [side]: there.toArray() as Vec3 })
    choose(`ik:${side}`)
  }
  const scrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = event.currentTarget
    const seek = (next: PointerEvent) => setTime((next.clientX - track.getBoundingClientRect().left) / track.clientWidth * shownClip.duration)
    track.setPointerCapture(event.pointerId)
    seek(event.nativeEvent)
    const end = () => {
      window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end); track.removeEventListener('lostpointercapture', end)
    }
    window.addEventListener('pointermove', seek); window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end); track.addEventListener('lostpointercapture', end)
  }
  useEffect(() => () => controller.rig.dispose(), [controller])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() }
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { event.preventDefault(); setTime(state.time + (event.code === 'ArrowLeft' ? -1 : 1) / 30) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  const importFile = async (file: File | undefined) => {
    if (!file || busy) return
    if (file.size > 2 * 1024 * 1024) { setStatus('Clip JSON is too large (max 2 MB).'); return }
    setBusy(true)
    try {
      if (useCharacter.getState().load(await file.text())) { library.current?.stop(); validSelection(); setStatus(`Imported ${file.name}.`) }
      else setStatus('Invalid clip JSON. Clips kept.')
    } catch { setStatus('Clip read failed. Clips kept.') }
    finally { setBusy(false) }
  }
  const download = async () => {
    if (!camera.current || busy) return
    setBusy(true)
    setStatus('Baking the rig and animation…')
    try {
      const glb = await exportCharacterGLB(controller.rig, clip, { cameraPosition: camera.current.position.clone() })
      saveData(glb, `${clip.name || clip.id}.glb`, 'model/gltf-binary')
      setStatus(`Exported ${clip.name || clip.id}.glb · 18 bones, 30 fps.`)
    } catch (error) {
      console.error('Character export failed', error)
      setStatus(error instanceof Error ? error.message : 'Export failed. Your clip remains saved here.')
    } finally { setBusy(false) }
  }
  const tracks = [
    ...Object.entries(clip.tracks).flatMap(([name, track]) => [
      ...(track.rotation?.length ? [{ id: `${name}:rotation`, name: `${boneLabel(name)} · rotation`, keys: track.rotation, bone: name }] : []),
      ...(track.position?.length ? [{ id: `${name}:position`, name: `${boneLabel(name)} · position`, keys: track.position, bone: name }] : []),
    ]),
    ...(Object.entries(clip.targets) as [IKTarget, {t: number; v:[number,number,number]}[]][]).filter(([, keys]) => keys.length).map(([name, keys]) => ({ id: `ik:${name}`, name: boneLabel(`ik:${name}`), keys, bone: name })),
  ]
  return <main className={`char-lab ${panel === 'motion' ? 'show-motion' : ''} ${panel === 'pose' ? 'show-pose' : ''}`}>
    <header className="char-top">
      <a className="char-back" href="/?studio" aria-label="Back to scene Studio" title="Back to scene Studio">← Scene</a>
      <div className="char-brand"><b>KAALI RAAT</b><span>Character lab</span></div>
      <button className="char-primary" onClick={togglePlayback}>{state.playing ? 'Pause' : '▶ Play'}</button>
      <button title="Undo (⌘Z)" aria-label="Undo" disabled={!state.past.length} onClick={undo}>↶</button>
      <button title="Redo (⇧⌘Z)" aria-label="Redo" disabled={!state.future.length} onClick={redo}>↷</button>
      <span className="char-grow" />
      <button className="char-mobile-toggle" aria-expanded={panel === 'motion'} onClick={() => setPanel(panel === 'motion' ? null : 'motion')}>Motion</button>
      <button className="char-mobile-toggle" aria-expanded={panel === 'pose'} onClick={() => setPanel(panel === 'pose' ? null : 'pose')}>Pose</button>
      <span className="char-status" role="status">{!state.storageOK ? 'Local save unavailable. Download Clip JSON.' : status}</span>
      <button disabled={busy || !ready} onClick={download}>{busy ? 'Exporting…' : 'Download .glb'}</button>
      <button title="Download the editable clip document" onClick={() => saveData(JSON.stringify(state.doc, null, 2), `${clip.name || clip.id}.json`, 'application/json')}>Clip JSON</button>
      {state.recovery && <button title="Download the previous, unreadable draft" onClick={() => saveData(state.recovery!, 'character-recovery.json', 'application/json')}>Recovery JSON</button>}
      <a className="char-scene-link" href="/?studio">Scene</a>
    </header>
    <div className="char-main">
      <aside className="char-motion">
        <div className="char-library-tabs"><button className={libraryMode ? 'is-on' : ''} aria-pressed={libraryMode} onClick={() => setLibraryMode(true)}>Library</button><button className={!libraryMode ? 'is-on' : ''} aria-pressed={!libraryMode} onClick={() => { library.current?.stop(); setLibraryMode(false) }}>Actor controls</button></div>
        {libraryMode ? <LibraryPanel ref={library} controller={controller} playing={state.playing} onPreview={setPreview} onFinish={setPreviewFinished} onStatus={setStatus} /> : <>
        <div className="char-section-heading"><h2>Procedural base</h2><span>Adjustment layer</span></div>
        <p className="char-note">A base layer beneath your hand-authored poses.</p>
        <Choice label="Movement" value={motion.movement} options={['idle','walk','creep']} onChange={(value) => patch('movement', value)} />
        <label className="char-field"><span>Gait speed</span><input type="range" aria-label="Gait speed" min="0" max="1.4" step="0.05" value={motion.speed} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) patch('speed', event.target.valueAsNumber) }} /><output>{motion.speed.toFixed(2)}</output></label>
        <Choice label="Posture" value={motion.posture} options={['neutral','tense','disturbed']} onChange={(value) => patch('posture', value)} />
        <Choice label="Expression" value={motion.expression} options={['neutral','fear','angry','dazed']} onChange={(value) => patch('expression', value)} />
        <Choice label="Gaze" value={motion.gaze} options={['manual','forward','camera','target']} onChange={(value) => patch('gaze', value)} />
        <Choice label="Breathing" value={motion.breathing} options={['normal','heavy','still']} onChange={(value) => patch('breathing', value)} />
        <Choice label="Head motion" value={motion.headMovement} options={['steady','unpredictable']} onChange={(value) => patch('headMovement', value)} />
        <label className="char-check"><input type="checkbox" checked={motion.groundContact} onChange={(event) => patch('groundContact', event.target.checked)} /> Keep feet on the ground</label>
        <h3>Hand IK</h3>
        {(['leftHand','rightHand'] as const).map((side) => <button className={`char-wide ${motion.reach?.[side] ? 'is-on' : ''}`} key={side} onClick={() => setIK(side)}>{motion.reach?.[side] ? `Release ${boneLabel(`ik:${side}`).replace(' IK','')}` : `Enable ${boneLabel(`ik:${side}`).replace(' IK','')} IK`}</button>)}
        <p className="char-note">Move the target, not each arm bone. Existing target keys stay available if you turn IK off.</p>
        <div className="char-api"><small>Reusable API</small><code>character.play({'{'} movement: 'walk', speed: 0.4 {'}'})</code><code>await character.playClip('fear-startle')</code></div>
        </>}
      </aside>
      <section className="char-stage" aria-label="Interactive character viewport">
        <CharacterViewport controller={controller} selected={selected} mode={mode} joints={joints} onSelect={choose} onCamera={onCamera} preview={preview} onFinish={setPreviewFinished} onTogglePlayback={togglePlayback} onPoseValues={onPoseValues} />
        <div className="char-view-label">{preview ? 'LIBRARY PREVIEW' : 'RIG PREVIEW'} <span>{preview ? `${preview.name} · saved clip unchanged` : 'THREE.Skeleton · SkinnedMesh'}</span></div>
        <button className="char-home" aria-label="Overview" title="Home overview" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Home' }))}>Home</button>
        <button className="char-joints" aria-pressed={joints} onClick={() => setJoints(!joints)}>{joints ? 'Hide joints' : 'Show joints'}</button>
        <div className="char-nav-hint"><span className="char-mouse-hint">LMB orbit · RMB/MMB pan · WASD/QE fly · scroll zoom · F focus · Home overview</span><span className="char-touch-hint">Drag to orbit · Two fingers to pan/zoom</span></div>
      </section>
      <aside className="char-pose">
        <div className="char-section-heading"><h2>Pose & IK</h2><span>{boneLabel(selected)}</span></div>
        <label className="char-field"><span>Joint</span><select aria-label="Selected joint" value={selected.startsWith('ik:') || bone ? selected : 'head'} onChange={(event) => choose(event.target.value)}>
          {boneNames.map((name) => <option key={name} value={name}>{boneLabel(name)}</option>)}
          {(['leftHand','rightHand'] as const).filter((side) => !!motion.reach?.[side]).map((side) => <option key={side} value={`ik:${side}`}>{boneLabel(`ik:${side}`)}</option>)}
        </select></label>
        <div className="char-segment"><button className={mode === 'rotate' ? 'is-on' : ''} disabled={selected.startsWith('ik:')} onClick={() => { useCharacter.setState({ playing: false }); setMode('rotate') }}>Rotate</button><button className={mode === 'translate' ? 'is-on' : ''} onClick={() => { useCharacter.setState({ playing: false }); setMode('translate') }}>Move</button><button title="Focus the selection (F)" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))}>Focus</button></div>
        {bone && <div className="char-values">{boneLabel(selected)}<small>{mode === 'rotate' ? 'Local rotation · degrees' : 'Local position · metres'}</small><Numbers key={`${selected}-${mode}`} values={liveValues ?? (mode === 'rotate' ? bone.rotation.toArray().slice(0,3).map((value) => Number(value) * 180 / Math.PI) : bone.position.toArray())} step={mode === 'rotate' ? 1 : 0.01} onChange={(values) => record(() => {
          if (mode === 'translate') keyPosition(useCharacter.getState().time, selected, values as Vec3)
          else {
            const rotation = bone.rotation.clone()
            rotation.set(values[0] * Math.PI / 180, values[1] * Math.PI / 180, values[2] * Math.PI / 180)
            keyRotation(useCharacter.getState().time, selected, new THREE.Quaternion().setFromEuler(rotation).toArray())
          }
        })} /></div>}
        {target && <div className="char-values">{boneLabel(selected)}<small>Relative to body root · metres</small><Numbers key={selected} values={liveValues ?? sampleIKTarget(clip, selected.slice(3) as IKTarget, state.time)?.toArray() ?? [0,0,0]} step={0.01} onChange={(values) => record(() => keyIK(useCharacter.getState().time, selected.slice(3) as IKTarget, values as Vec3))} /></div>}
        <p className="char-note">{selected === 'head' && ['camera','target'].includes(motion.gaze) ? 'Head rotation is driven by Gaze. Use manual gaze to pose the head.' : selected.endsWith('Ankle') && motion.groundContact ? 'Ground contact drives the feet. Turn it off to pose ankles directly.' : 'Drag the gizmo or enter numbers. Your pose becomes a key at the playhead.'}</p>
        <div className="char-section-heading"><h2>Clip</h2><span>30 fps export</span></div>
        <label className="char-field"><span>Library</span><select aria-label="Clip library" value={state.doc.activeId} onChange={(event) => savedClip(event.target.value)}>{state.doc.clips.map((entry) => <option value={entry.id} key={entry.id}>{entry.name || entry.id}</option>)}</select></label>
        <button className="char-wide" disabled={busy} onClick={() => fileInput.current?.click()}>Import clip JSON</button>
        <input ref={fileInput} type="file" hidden aria-label="Import clip JSON file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importFile(file) }} />
        <label className="char-field"><span>Name</span><input aria-label="Clip name" maxLength={60} value={clip.name} onChange={(event) => { library.current?.stop(); state.begin(); state.change((next) => { next.name = event.target.value }) }} /></label>
        <label className="char-field"><span>Duration</span><input type="range" aria-label="Clip duration" min="0.1" max="120" step="0.1" value={clip.duration} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) { library.current?.stop(); state.begin(); state.change((next) => { retimeClip(next, event.target.valueAsNumber); useCharacter.getState().setTime(Math.min(state.time, next.duration)) }) } }} /><output>{clip.duration.toFixed(1)}s</output></label>
        <div className="char-actions"><button onClick={() => { library.current?.stop(); state.newClip(); validSelection() }}>＋ New clip</button><button disabled={state.doc.clips.length < 2} title="Delete this clip (undo is available)" onClick={() => { library.current?.stop(); state.deleteClip(); validSelection() }}>Delete clip</button></div>
        <button className="char-wide" disabled={!tracks.some((track) => track.bone === (selected.startsWith('ik:') ? selected.slice(3) : selected))} title="Remove this joint's keys (undo is available)" onClick={() => { library.current?.stop(); state.begin(); removeKeys(selected) }}>Remove joint keys</button>
        <button className="char-wide" disabled={!tracks.length && !Object.keys(clip.face ?? {}).length} title="Clear body, hand and facial keys (undo is available)" onClick={() => { library.current?.stop(); state.begin(); state.change((next) => { next.tracks = {}; next.targets = {}; delete next.motion.reach; delete next.face; delete next.faceHead; choose('head') }) }}>Clear all keys</button>
        <p className="char-note">The camera never changes your clip. Named clips autosave independently of the episode.</p>
      </aside>
    </div>
    <footer className="char-timeline">
      <div className="char-transport"><button onClick={() => setTime(0)} title="Beginning of clip">⏮</button><button title="Previous frame" aria-label="Previous frame" onClick={() => setTime(state.time - 1/30)}>←</button><button title="Next frame" aria-label="Next frame" onClick={() => setTime(state.time + 1/30)}>→</button><strong>{state.time.toFixed(2)}s</strong><span>/ {shownClip.duration.toFixed(1)}s</span><span className="char-grow" /><span>{preview ? `Preview · ${preview.name}` : tracks.length ? `${tracks.length} keyed tracks` : 'Drag a joint to add a key'}</span></div>
      <div className="char-scrubber" onPointerDown={scrub}>{[0,0.25,0.5,0.75,1].map((part) => <span key={part} style={{ left: `${part * 100}%` }}>{(shownClip.duration * part).toFixed(1)}s</span>)}</div>
      <div className="char-tracklist">{tracks.map((track) => <div className="char-track" key={track.id} title={track.name}><span>{track.name}</span><div className="char-key-lane">{track.keys.map((key) => <button key={key.t} className="char-key" style={{ left: `${key.t / clip.duration * 100}%` }} title={`Scrub to ${key.t.toFixed(2)}s`} aria-label={`${track.name} key at ${key.t.toFixed(2)} seconds`} onClick={() => { library.current?.stop(); state.setTime(key.t) }} />)}</div></div>)}</div>
      <i className="char-playhead" style={{ left: `calc(132px + (100% - 144px) * ${state.time / shownClip.duration})` }} />
    </footer>
  </main>
}
