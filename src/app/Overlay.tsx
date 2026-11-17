import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { AudioManager } from '../audio/AudioManager'
import * as player from './player'

const params = new URLSearchParams(location.search)
/** Optional knot to start from (?start=prototype). Default: the top of the story. */
const START = params.get('start') ?? undefined

AudioManager.mute(true) // Sound is opt-in; also silence a live page when this module reloads.
export const audioReady = params.has('characters') ? Promise.resolve() : AudioManager.init()

function Gate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const begin = async (fromBeginning: boolean) => {
    setLoading(true)
    setError(false)
    try {
      await audioReady
      player.start(fromBeginning ? undefined : START)
    } catch (error) {
      console.error('Chapter could not start', error)
      setLoading(false)
      setError(true)
    }
  }
  return (
    <button className="gate" onClick={() => begin(error)} disabled={loading} aria-label="Enter KAALI RAAT episode 1">
      <span className="gate-hint">Headphones. Lights off.</span>
      <span className="gate-hint hi">हेडफ़ोन लगाइए। बत्ती बुझाइए।</span>
      <span className="gate-cta">{loading ? '…' : error ? 'Start over' : 'Tap to begin'}</span>
      {error && <span className="gate-hint" role="alert">This chapter could not start.</span>}
    </button>
  )
}

const GLYPH: Record<string, string> = { ahead: '↑', behind: '↓', left: '←', right: '→' }

/** Choices sit where they point in the world when tagged `# dir:` — ahead high in frame, behind low. */
function Choices() {
  const choices = useStore((s) => s.choices)
  const spatial = choices.some((c) => c.dir)
  return (
    <div className={`choices ${spatial ? 'spatial' : ''}`} role="group" aria-label="What do you do?">
      {choices.map((c, i) => (
        <button key={c.index} className={`choice ${c.dir ? `dir-${c.dir}` : ''}`} style={{ animationDelay: `${0.4 + i * 0.5}s` }} onClick={() => player.choose(c.index)}>
          {c.dir && <span className="glyph" aria-hidden>{GLYPH[c.dir]}</span>}
          {c.text}
        </button>
      ))}
    </div>
  )
}

/** YOU DIED: black, the words surface slowly, the narrator's epitaph, then only the options the story supports. */
function Dead() {
  const { epitaph, canRetry } = useStore()
  useEffect(() => {
    const t = setTimeout(() => AudioManager.sfx('anklets', 0.25, [-6, 0.2, -10]), 1800)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="dead" role="alertdialog" aria-label="You died">
      <h2 className="died" aria-label="You died">
        {'YOU DIED'.split('').map((ch, i) => (
          <span key={i} style={{ animationDelay: `${1.2 + i * 0.16 + (i % 3) * 0.07}s` }}>{ch === ' ' ? '\u00a0' : ch}</span>
        ))}
      </h2>
      <p className="died-hi" lang="hi">तुम मर चुके हो</p>
      {epitaph && <p className="epitaph">{epitaph}</p>}
      <div className="dead-options">
        {canRetry && <button className="choice" onClick={player.retry}>Return to the last decision</button>}
        <button className="choice dim" onClick={() => player.start(START)}>Start again</button>
      </div>
    </div>
  )
}

function Ended() {
  return (
    <div className="ended">
      <button className="choice" onClick={() => player.start(START)}>Watch again</button>
    </div>
  )
}

/** You are Aarav: his lines are yours. */
const LABEL: Record<string, string> = { AARAV: 'You', DIARY: 'Diary' }

export function Overlay() {
  const { phase, caption, showTitle, blackout, muted, sceneId } = useStore()
  const toggleMute = () => {
    AudioManager.mute(!muted)
    useStore.getState().set({ muted: !muted })
  }
  return (
    <div className="overlay">
      <div className="blackout" style={{ opacity: blackout }} />
      <div className={`title ${showTitle ? 'on' : ''}`} aria-hidden={!showTitle}>
        <h1>KAALI RAAT</h1>
        <p>The Road That Remembers</p>
      </div>
      {caption && (
        <p key={caption.text} className={`caption sp-${caption.speaker.toLowerCase()}`} aria-live="polite">
          {caption.speaker !== 'NARRATOR' && <span className="speaker">{LABEL[caption.speaker] ?? caption.speaker}</span>}
          {caption.text}
        </p>
      )}
      {phase === 'gate' && <Gate />}
      {phase === 'choice' && <Choices />}
      {phase === 'ended' && <Ended />}
      {phase === 'dead' && <Dead />}
      {phase !== 'gate' && (
        <button className="mute" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
          </svg>
        </button>
      )}
      {import.meta.env.DEV && sceneId && <span className="dev-scene">{sceneId}</span>}
    </div>
  )
}
