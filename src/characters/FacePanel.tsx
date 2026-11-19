import { memo, useEffect, useRef, useState } from 'react'
import { useCharacter } from './store.ts'
import { EXPRESSION_PRESETS, NEUTRAL_FACE, PRESET_GROUPS, type FacePose, type FaceSettings, type PresetName } from './facial.ts'
import { fromRhubarbJSON, validTimeline, type LipSyncTimeline, type TalkingMode } from './lipsync.ts'
import { saveData } from './export.ts'
import type { CharacterController } from './controller.ts'

const LABELS: Partial<Record<PresetName, string>> = {
  crying: 'Dramatic crying', terrified: 'Terrified', psychotic: 'Psychotic grin', uncanny: 'Uncanny smile', dead: 'Dead stare', twitch: 'Eye twitch', 'jaw-drop': 'Jaw drop', frozen: 'Frozen in fear', panic: 'Extreme panic',
  realising: 'Slowly realising danger', 'look-behind': 'Looking behind', shock: 'Sudden shock', 'holding-tears': 'Trying not to cry', 'forced-smile': 'Forced smile', 'becoming-possessed': 'Slowly becoming possessed', 'frozen-reaction': 'Frozen reaction',
}
const label = (name: string) => LABELS[name as PresetName] ?? name.replaceAll('-', ' ').replace(/^./, letter => letter.toUpperCase())
const ADVANCED: [keyof FacePose, string, number, number][] = [
  ['eyeOpen', 'Eye opening', 0, 1.65], ['eyeWide', 'Eye width', .65, 1.35], ['eyeAsymmetry', 'Eye asymmetry', -.8, .8],
  ['pupilX', 'Pupil horizontal', -1, 1], ['pupilY', 'Pupil vertical', -1, 1], ['pupilAsymmetry', 'Cross / diverge', -1, 1], ['pupilDilate', 'Pupil dilation', .25, 1.65],
  ['browRaise', 'Eyebrow height', -1.5, 1.5], ['browAngle', 'Eyebrow angle', -1.5, 1.5], ['browAsymmetry', 'Brow asymmetry', -1.5, 1.5],
  ['mouthOpen', 'Jaw opening', 0, 1], ['mouthWidth', 'Mouth width', -1, 1.5], ['smile', 'Smile', 0, 1.35], ['frown', 'Frown', 0, 1.2], ['smileAsymmetry', 'Smile asymmetry', -1, 1],
  ['teeth', 'Teeth visibility', 0, 1], ['tongue', 'Tongue visibility', 0, 1], ['cheeks', 'Cheek puff', 0, 1], ['nose', 'Nose scrunch', 0, 1],
  ['headTilt', 'Head tilt', -1, 1], ['squash', 'Squash and stretch', 0, 1], ['distort', 'Facial distortion', 0, 1], ['tremble', 'Trembling', 0, 1],
]

interface Props { controller: CharacterController; onStatus: (message: string) => void; onFocus: () => void }

export const FacePanel = memo(function FacePanel({ controller, onStatus, onFocus }: Props) {
  const doc = useCharacter(state => state.doc)
  const clip = doc.clips.find(item => item.id === doc.activeId)!, face = clip.faceAnimation
  const [busy, setBusy] = useState(false)
  const [audioVersion, setAudioVersion] = useState(0)
  const [transcript, setTranscript] = useState('')
  const audioInput = useRef<HTMLInputElement>(null), cueInput = useRef<HTMLInputElement>(null)
  const currentPreset = face?.preset ?? 'neutral', intensity = face?.intensity ?? .85
  const speech = face?.speech, mode = speech?.mode ?? 'viseme', talkingIntensity = speech?.intensity ?? 1
  const bodyPlaying = useCharacter(state => state.playing)
  const loaded = controller.dialogue.loaded && speech?.fileName === controller.dialogue.fileName && audioVersion >= 0

  useEffect(() => {
    const ended = () => { useCharacter.setState({ playing: false }); onStatus('Dialogue finished. Replay to hear it again.') }
    controller.dialogue.onEnded = ended
    return () => { if (controller.dialogue.onEnded === ended) controller.dialogue.onEnded = undefined }
  }, [controller, onStatus])

  function edit(fn: (settings: FaceSettings) => void) {
    useCharacter.getState().begin()
    useCharacter.getState().change(next => {
      const settings: FaceSettings = { ...next.faceAnimation }
      fn(settings)
      next.faceAnimation = settings
    })
  }
  const preset = (name: PresetName) => {
    edit(settings => { settings.preset = name; settings.intensity = intensity; delete settings.events; delete settings.controls })
    onStatus(`${label(name)} applied. Saved with the current clip.`)
  }
  const control = (name: keyof FacePose, value: number) => {
    if (!Number.isFinite(value)) return
    edit(settings => { settings.preset = currentPreset; delete settings.events; settings.controls = { ...settings.controls, [name]: value } })
  }
  const patchSpeech = (patch: Partial<NonNullable<FaceSettings['speech']>>) => edit(settings => { settings.speech = { mode: 'viseme', intensity: 1, ...settings.speech, ...patch } })

  async function selectAudio(file?: File) {
    if (!file || busy) return
    setBusy(true)
    try {
      await controller.dialogue.load(file, mode, transcript, speech?.timeline)
      patchSpeech({ fileName: file.name, timeline: controller.dialogue.timeline, mode })
      onStatus(mode === 'viseme' ? 'Dialogue analysed once. Cues saved with this clip.' : 'Audio ready for real-time analysis. Press Play to hear it.')
    } catch (error) { onStatus(error instanceof Error ? error.message : 'Dialogue failed to load.') }
    finally { setBusy(false); setAudioVersion(value => value + 1) }
  }

  async function play(replay = false) {
    setBusy(true)
    try {
      if (replay) await controller.dialogue.replay()
      else await controller.dialogue.play()
      useCharacter.setState({ playing: true, time: replay ? 0 : Math.min(useCharacter.getState().time, clip.duration) })
      onStatus('Dialogue playing. Emotion and blinks stay active.')
    } catch (error) {
      useCharacter.setState({ playing: false }); controller.dialogue.pause()
      onStatus(error instanceof Error ? error.message : 'Playback failed. Choose another file.')
    } finally { setBusy(false); setAudioVersion(value => value + 1) }
  }

  function pause() {
    controller.dialogue.pause()
    useCharacter.setState({ playing: false })
    onStatus('Dialogue paused. Its position is retained.')
  }

  async function selectCues(file?: File) {
    if (!file) return
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Lip-sync JSON must be under 2 MB.')
      const data: unknown = JSON.parse(await file.text())
      const timeline: LipSyncTimeline = validTimeline(data) ? data : fromRhubarbJSON(data)
      patchSpeech({ timeline, mode: 'viseme' })
      onStatus(`Imported ${timeline.cues.length} saved mouth cues. Select the matching audio to preview.`)
    } catch (error) { onStatus(error instanceof Error ? error.message : 'Invalid lip-sync JSON. Existing cues kept.') }
  }

  async function demo() {
    if (busy) return
    setBusy(true)
    try {
      const [audio, cueData] = await Promise.all([
        fetch('/audio/vo/part1_opening_hi.wav').then(response => response.ok ? response.blob() : Promise.reject(new Error('Demo audio was not found.'))),
        fetch('/face-demo/opening.json').then(response => response.ok ? response.json() : Promise.reject(new Error('Demo viseme data was not found.'))),
      ])
      const timeline = validTimeline(cueData) ? cueData : fromRhubarbJSON(cueData)
      await controller.dialogue.load(new File([audio], 'part1_opening_hi.wav', { type: 'audio/wav' }), 'viseme', '', timeline)
      patchSpeech({ fileName: 'part1_opening_hi.wav', timeline, mode: 'viseme' })
      onStatus('Opening WAV and offline Rhubarb cues are ready. Press Play in Talking.')
    } catch (error) { onStatus(error instanceof Error ? error.message : 'The speech demo could not load.') }
    finally { setBusy(false); setAudioVersion(value => value + 1) }
  }

  function addEvent() {
    const time = useCharacter.getState().time
    if (time >= clip.duration - .2) { onStatus('Move the playhead before the clip ends to add an expression.'); return }
    if ((face?.events?.length ?? 0) >= 16) { onStatus('A clip can contain up to 16 expression events.'); return }
    const duration = Math.min(1.6, clip.duration - time)
    edit(settings => {
      settings.preset = currentPreset
      settings.events = [...settings.events ?? [], { start: time, duration, preset: currentPreset, intensity, transition: Math.min(.25, duration * .25), exit: Math.min(.2, duration * .2) }].sort((a, b) => a.start - b.start)
    })
    onStatus('Expression event saved. Use Play or the frame controls to inspect it.')
  }

  async function disconnectMicrophone() {
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true })
      if (!stream) throw new Error('Microphone input is unavailable in this browser.')
      await controller.dialogue.connectStream(stream)
      controller.facial.idle = face?.idle !== false
      patchSpeech({ mode: 'reactive', fileName: 'Live microphone', timeline: undefined })
      onStatus('Live microphone connected. Nothing is recorded or saved.')
    } catch (error) { onStatus(error instanceof Error ? error.message : 'Microphone access was denied.') }
    finally { setAudioVersion(value => value + 1) }
  }

  return <div className="char-face-panel">
    <div className="char-section-heading"><h2>Cartoon face</h2><span>{controller.facial.adapter.kind}</span></div>
    <p className="char-note">Expressive, not overwhelming. Facial animation stays separate from body keys and older facial clips.</p>
    <div className="char-face-top"><button className="char-wide" onClick={onFocus}>Focus face</button><button className="char-wide" onClick={() => preset('neutral')}>Neutral</button></div>
    {PRESET_GROUPS.map(group => <section className="char-face-group" key={group.category}><h3>{group.category}</h3><div className="char-face-presets">{group.presets.map(name => <button key={name} aria-pressed={currentPreset === name} className={currentPreset === name ? 'is-on' : ''} onClick={() => preset(name)} title={`Apply ${label(name)}`}>{label(name)}</button>)}</div></section>)}
    <label className="char-field"><span>Intensity</span><input aria-label="Expression intensity" type="range" min="0" max="1" step="0.05" value={intensity} onChange={event => edit(settings => { settings.intensity = event.target.valueAsNumber })} /><output>{Math.round(intensity * 100)}%</output></label>
    <details className="char-face-advanced"><summary>Advanced facial controls</summary>{ADVANCED.map(([name, title, min, max]) => {
      const value = face?.controls?.[name] ?? EXPRESSION_PRESETS[currentPreset]?.[name] ?? NEUTRAL_FACE[name]
      return <label className="char-field" key={name}><span>{title}</span><input aria-label={title} type="range" min={min} max={max} step="0.01" value={value} onChange={event => control(name, event.target.valueAsNumber)} /><output>{Number(value).toFixed(2)}</output></label>
    })}</details>
    <details className="char-face-idle"><summary>Idle behaviour</summary>
      <label className="char-check"><input aria-label="Blink and saccades" type="checkbox" checked={face?.idle !== false} onChange={event => edit(settings => { settings.idle = event.target.checked })} /> Seeded blinks and saccades</label>
      <label className="char-check"><input aria-label="Track camera with pupils" type="checkbox" checked={!!face?.eyeTracking} onChange={event => edit(settings => { settings.eyeTracking = event.target.checked })} /> Track camera with pupils</label>
      <button className="char-wide" onClick={() => {
      const state = useCharacter.getState()
      if (!state.playing) { onStatus('Press Play to preview blinking on the scene clock.'); return }
      controller.facial.blink(state.time)
    }}>Blink once</button>
    </details>

    <div className="char-section-heading"><h2>Expression sequence</h2><span>{face?.events?.length ?? 0}/16</span></div>
    <button className="char-wide" onClick={addEvent}>＋ Add {label(currentPreset)} at playhead</button>
    <button className="char-wide" onClick={() => {
      const names: PresetName[] = ['goofy','confused','suspicious','terrified','possessed']
      edit(settings => { settings.events = names.map((name, index) => ({ start: clip.duration * index / names.length, duration: clip.duration / names.length, preset: name, intensity: .85, transition: .18, exit: .18 })) })
      onStatus('Five-expression sequence saved: funny to confused, suspicious, terrified and possessed.')
    }}>Load five-expression demo</button>
    {face?.events?.map((event, index) => <div className="char-face-event" key={`${event.start}-${index}`}>
      <button className="char-face-event-seek" onClick={() => useCharacter.getState().setTime(event.start)}>{label(event.preset)}<small>{event.start.toFixed(2)}s · {event.duration.toFixed(2)}s</small></button>
      <button aria-label={`Remove ${label(event.preset)}`} title="Remove event" onClick={() => edit(settings => { settings.events = settings.events?.filter((_, item) => item !== index) })}>×</button>
    </div>)}

    <div className="char-section-heading"><h2>Talking</h2><span>{loaded ? bodyPlaying && controller.dialogue.playing ? 'Talking' : 'Audio ready' : 'Preview'}</span></div>
    <label className="char-field"><span>Mode</span><select aria-label="Lip-sync mode" value={mode} onChange={event => patchSpeech({ mode: event.target.value as TalkingMode })}>
      <option value="viseme">Offline visemes (preferred)</option><option value="reactive">Audio-reactive (approximate)</option>
    </select></label>
    <button className="char-wide" disabled={busy} onClick={() => {
      if (controller.dialogue.isStream) { controller.dialogue.stopStream(); patchSpeech({ fileName: undefined }); onStatus('Microphone stopped and released.') }
      else void disconnectMicrophone()
    }}>{controller.dialogue.isStream ? 'Stop microphone' : 'Use live microphone (not saved)'}</button>
    <button className="char-wide" disabled={busy} onClick={() => audioInput.current?.click()}>{busy ? 'Analyzing audio…' : 'Choose dialogue audio…'}</button>
    <button className="char-wide" disabled={busy} onClick={() => void demo()}>Load opening WAV + offline cues</button>
    <input ref={audioInput} hidden type="file" accept="audio/*" aria-label="Dialogue audio file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void selectAudio(file) }} />
    {mode === 'viseme' && !speech?.timeline && <label className="char-face-transcript"><span>Transcript (optional, script-guided)</span><textarea value={transcript} onChange={event => setTranscript(event.target.value)} placeholder="Text of the dialogue for viseme alignment" /></label>}
    <div className="char-face-transport"><button disabled={!loaded || busy || mode === 'viseme' && !speech?.timeline} onClick={() => controller.dialogue.playing ? pause() : void play()}>{controller.dialogue.playing ? 'Pause' : 'Play'}</button><button disabled={!loaded || busy || mode === 'viseme' && !speech?.timeline} onClick={() => void play(true)}>Replay</button></div>
    <label className="char-field"><span>Speech intensity</span><input aria-label="Speech intensity" type="range" min="0" max="1" step="0.05" value={talkingIntensity} onChange={event => patchSpeech({ intensity: event.target.valueAsNumber })} /><output>{Math.round(talkingIntensity * 100)}%</output></label>
    <div className="char-face-transport"><button disabled={!speech?.timeline} onClick={() => saveData(JSON.stringify(speech?.timeline, null, 2), `${clip.id}-lip-sync.json`, 'application/json')}>Download cues</button><button disabled={busy} onClick={() => cueInput.current?.click()}>Import Rhubarb / JSON</button></div>
    <input ref={cueInput} hidden type="file" accept=".json,application/json" aria-label="Lip-sync JSON file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void selectCues(file) }} />
    <p className="char-note">{loaded ? `${controller.dialogue.fileName} · ${controller.dialogue.duration.toFixed(2)}s` : speech?.timeline ? 'Cues are saved. Select the matching audio file to preview them.' : speech?.fileName ? `Choose ${speech.fileName} again. Clip JSON saves settings, not audio.` : 'No dialogue selected. File playback starts only when you press Play.'}</p>
    {speech?.timeline && <button className="char-wide" onClick={() => { controller.dialogue.pause(); patchSpeech({ timeline: undefined }); onStatus('Saved cues removed. Your audio file and clip remain available.') }}>Remove saved cues</button>}
    <p className="char-note">Scripts guide Latin-script viseme estimation. The demo uses offline Rhubarb analysis of the existing provisional Hindi WAV. No dialogue is generated here.</p>
  </div>
})
