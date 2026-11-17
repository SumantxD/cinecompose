import { useStudio } from './studioStore'
import type { EnvironmentEffect, EnvironmentEffectType, Vec3 } from '../cinematic/types'

const TYPES: { value: EnvironmentEffectType; label: string }[] = [
  { value: 'lightning', label: '⚡ Lightning' },
  { value: 'tornado', label: '🌪 Tornado' },
  { value: 'earthquake', label: '🫨 Earthquake' },
  { value: 'flood', label: '🌊 Flood' },
]

function defaults(type: EnvironmentEffectType, id: string): EnvironmentEffect {
  switch (type) {
    case 'lightning': return { id, type, at: 0, duration: 6, intensity: 1, seed: 7 }
    case 'tornado': return { id, type, at: 0, duration: 10, intensity: 1, position: [0, 0, -18], radius: 2.4, height: 15, seed: 19 }
    case 'earthquake': return { id, type, at: 0, duration: 4, intensity: 0.8, frequency: 10 }
    case 'flood': return { id, type, at: 0, duration: 8, intensity: 1, level: 1.2, color: '#182c33' }
  }
}

function Num({ label, value, step = 0.1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return <label className="st-slider"><span>{label}</span><span /><input type="number" step={step} value={Number(value.toFixed(2))} onChange={(e) => { const v = e.target.valueAsNumber; if (Number.isFinite(v)) onChange(v) }} /></label>
}

function Vec({ label, value, onChange }: { label: string; value: Vec3; onChange: (v: Vec3) => void }) {
  return <div className="st-vec"><span>{label}</span>{value.map((n, i) => <input key={i} type="number" step={0.1} value={Number(n.toFixed(2))} onChange={(e) => { const v = e.target.valueAsNumber; if (Number.isFinite(v)) { const next: Vec3 = [...value]; next[i] = v; onChange(next) } }} />)}</div>
}

/** Add / edit / delete environmental set pieces. Nothing is added to a story unless authored here. */
export function EnvironmentFx() {
  const st = useStudio()
  const effects = st.cfg.effects ?? []
  const set = (index: number, patch: Partial<EnvironmentEffect>) => st.edit((c) => { Object.assign(c.effects![index], patch) })
  const add = (type: EnvironmentEffectType) => st.edit((c) => {
    const list = (c.effects ??= [])
    let id = `${type}_${list.length + 1}`, suffix = 1
    while (list.some((fx) => fx.id === id)) id = `${type}_${list.length + 1}_${++suffix}`
    list.push(defaults(type, id))
  })
  return (
    <section>
      <h3>Environment FX</h3>
      <div className="st-row">
        <select id="st-fx-type" defaultValue="lightning" aria-label="Effect type">{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <button onClick={() => add((document.getElementById('st-fx-type') as HTMLSelectElement).value as EnvironmentEffectType)}>＋ Add effect</button>
      </div>
      {effects.length === 0 && <span className="st-hint">No effects on this scene. Add one to preview it here; leave scenes empty to keep their canonical look.</span>}
      {effects.map((fx, i) => (
        <div key={fx.id} className="st-path-editor">
          <div className="st-row">
            <b style={{ flex: 1 }}>{fx.id}</b>
            <select value={fx.type} onChange={(e) => { const next = defaults(e.target.value as EnvironmentEffectType, fx.id); st.edit((c) => { c.effects![i] = next }) }} title="Change effect type">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className="st-danger" onClick={() => st.edit((c) => c.effects!.splice(i, 1))}>Delete</button>
          </div>
          <Num label="At (s)" value={fx.at} onChange={(v) => set(i, { at: Math.max(0, v) })} />
          <Num label="Duration (s)" value={fx.duration} onChange={(v) => set(i, { duration: Math.max(0.1, v) })} />
          <Num label="Intensity" value={fx.intensity} step={0.05} onChange={(v) => set(i, { intensity: Math.max(0, Math.min(4, v)) })} />
          {'seed' in fx && <Num label="Seed" value={fx.seed ?? 1} step={1} onChange={(v) => set(i, { seed: Math.floor(v) })} />}
          {fx.type === 'lightning' && <Vec label="Position" value={fx.position ?? [0, 0, -24]} onChange={(v) => set(i, { position: v })} />}
          {fx.type === 'tornado' && <>
            <Vec label="Position" value={fx.position} onChange={(v) => set(i, { position: v })} />
            <Num label="Radius (m)" value={fx.radius ?? 2.4} onChange={(v) => set(i, { radius: Math.max(0.2, v) })} />
            <Num label="Height (m)" value={fx.height ?? 15} onChange={(v) => set(i, { height: Math.max(3, v) })} />
          </>}
          {fx.type === 'earthquake' && <Num label="Frequency" value={fx.frequency ?? 10} onChange={(v) => set(i, { frequency: Math.max(0, v) })} />}
          {fx.type === 'flood' && <>
            <Num label="Level (m)" value={fx.level} onChange={(v) => set(i, { level: Math.max(0, v) })} />
            <label className="st-slider"><span>Water colour</span><span /><input type="color" value={fx.color ?? '#182c33'} onChange={(e) => set(i, { color: e.target.value })} /></label>
          </>}
        </div>
      ))}
    </section>
  )
}
