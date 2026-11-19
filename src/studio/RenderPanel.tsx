import { useRef, type ChangeEvent } from 'react'
import { useStudio } from './studioStore'
import { RENDER_PROFILES, validateRenderSettings, HDRI_LIBRARY } from '../cinematic/rendering'
import { DEFAULT_RELIEF } from '../scenes/reference-forest/layout'
import type { HdriId, QualityProfile, RenderSettingsPatch, ForestSettings } from '../cinematic/types'

function Range({ label, value, min, max, step = 0.01, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="st-slider" title={label}>
      <span>{label}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <input type="number" aria-label={`${label} value`} min={min} max={max} step={step} value={Math.round(value * 1000) / 1000} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label className="st-slider"><span>{label}</span><input type="checkbox" aria-label={label} checked={value} onChange={(e) => onChange(e.target.checked)} /></label>
}

/** Rendering quality, effects, environment lighting and GPU budget controls. Scene JSON owns the saved values. */
export function RenderPanel() {
  const st = useStudio()
  const cfg = st.cfg
  const forest = (next: Partial<ForestSettings>) => st.edit((c) => { c.props = { ...c.props, forest: { ...c.props!.forest!, ...next } } })
  const patch = cfg.rendering
  const fileInput = useRef<HTMLInputElement>(null)
  const set = (next: RenderSettingsPatch) => st.edit((c) => { c.rendering = { ...c.rendering, ...next } })
  const section = <K extends 'ao' | 'dof' | 'bloom' | 'grade' | 'vignette' | 'grain' | 'chromatic' | 'godRays'>(name: K, next: Partial<NonNullable<RenderSettingsPatch[K]>>) =>
    st.edit((c) => { c.rendering = { ...c.rendering, [name]: { ...(c.rendering?.[name] ?? {}), ...next } } })
  const setEnvironment = (value: string) => st.edit((c) => {
    if (!value) { if (c.rendering) delete c.rendering.environment; return }
    c.rendering = { ...c.rendering, environment: { hdri: value as HdriId, intensity: c.rendering?.environment?.intensity ?? 0.35, rotation: c.rendering?.environment?.rotation ?? 0 } }
  })
  const reset = () => {
    const saved = JSON.parse(st.saved) as { rendering?: RenderSettingsPatch }
    st.edit((c) => {
      if (saved.rendering) c.rendering = saved.rendering
      else delete c.rendering
    })
  }
  const loadPreset = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as RenderSettingsPatch
      const errors = validateRenderSettings(parsed)
      if (errors.length) return alert(errors.join('\n'))
      st.edit((c) => { c.rendering = parsed })
    } catch {
      alert('Rendering preset must be JSON.')
    }
  }
  const savePreset = () => {
    const blob = new Blob([JSON.stringify(patch ?? {}, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${cfg.sceneId}-rendering.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const metric = st.metrics
  return (
    <section className="st-render-panel">
      <h3>Rendering quality</h3>
      <p className="st-help">Profiles change GPU cost and output resolution. Existing scenes without custom settings keep their current look.</p>
      <div className="st-row" role="group" aria-label="Quality profile">
        {(['ultra', 'high', 'performance'] as QualityProfile[]).map((p) => (
          <button key={p} className={patch?.profile === p ? 'on' : ''} onClick={() => set({ ...RENDER_PROFILES[p], profile: p })} title={`Apply the ${p} rendering profile`}>{p[0].toUpperCase() + p.slice(1)}</button>
        ))}
        {!patch && <button onClick={() => set({ profile: 'high' })} title="Edit individual settings without changing the legacy image">Customize</button>}
      </div>

      <details className="st-look-guide">
        <summary>Cinematic look guide</summary>
        <ol className="st-help">
          <li>Use detailed, real foreground assets. Keep simplified meshes and impostors in the distance, not as a disguise for weak close-up work.</li>
          <li>Use albedo, normal, roughness and AO together. Normal maps add surface grain, not physical ground height.</li>
          <li>Share one terrain-height function across geometry, prop roots and mist. Small physical bumps and slightly buried roots make contact believable.</li>
          <li>Let a warm practical light anchor the path. Keep the cool fill restrained and separate HDRI illumination from the visible sky.</li>
          <li>Spend geometry and shadow budget on hero objects. Judge portrait and landscape frames, not feature counts.</li>
        </ol>
        <p className="st-help">Lessons from the reference forest. Use <code>?studio&amp;scene=reference_forest</code> to inspect the example.</p>
      </details>

      {patch && <>
        <h4>Output and sampling</h4>
        <Range label="Render scale" value={patch.renderScale ?? 2} min={0.5} max={2} step={0.05} onChange={(v) => set({ renderScale: v })} />
        <label className="st-slider"><span>Anti-aliasing</span>
          <select aria-label="Anti-aliasing" value={patch.antialias ?? 'none'} onChange={(e) => set({ antialias: e.target.value as RenderSettingsPatch['antialias'] })}>
            <option value="none">Off</option><option value="msaa">MSAA</option><option value="smaa">SMAA (edge aware)</option>
          </select>
        </label>
        <Range label="MSAA samples" value={patch.msaaSamples ?? 0} min={0} max={8} step={1} onChange={(v) => set({ msaaSamples: Math.round(v) })} />
        <Toggle label="Real-time shadows" value={patch.shadows ?? true} onChange={(v) => set({ shadows: v })} />
        <label className="st-slider"><span>Shadow quality</span>
          <select aria-label="Shadow quality" value={patch.shadowType ?? 'pcf'} onChange={(e) => set({ shadowType: e.target.value as RenderSettingsPatch['shadowType'] })}>
            <option value="basic">Basic</option><option value="pcf">PCF</option><option value="pcf-soft">PCF soft</option>
          </select>
        </label>
        <label className="st-slider"><span>Shadow map</span>
          <select aria-label="Shadow map size" value={patch.shadowMapSize ?? 1024} onChange={(e) => set({ shadowMapSize: +e.target.value })}>
            {[256, 512, 1024, 2048, 4096].map((n) => <option key={n} value={n}>{n}px</option>)}
          </select>
        </label>
        <label className="st-slider"><span>Texture filtering</span>
          <select aria-label="Texture anisotropy" value={patch.textureAnisotropy ?? 4} onChange={(e) => set({ textureAnisotropy: +e.target.value })}>
            {[1, 2, 4, 8, 16].map((n) => <option key={n} value={n}>Trilinear ×{n}</option>)}
          </select>
        </label>
        <label className="st-slider"><span>Tone mapping</span>
          <select aria-label="Tone mapping" value={patch.toneMapping ?? 'aces'} onChange={(e) => set({ toneMapping: e.target.value as RenderSettingsPatch['toneMapping'] })}>
            <option value="aces">ACES filmic</option><option value="neutral">Neutral</option><option value="none">None</option>
          </select>
        </label>

        <h4>Ambient occlusion</h4>
        <Toggle label="N8AO occlusion" value={patch.ao?.enabled ?? false} onChange={(v) => section('ao', { enabled: v })} />
        {patch.ao?.enabled && <>
          <label className="st-slider"><span>AO quality</span>
            <select aria-label="AO quality" value={patch.ao?.quality ?? 'medium'} onChange={(e) => section('ao', { quality: e.target.value as NonNullable<RenderSettingsPatch['ao']>['quality'] })}>
              {['performance', 'low', 'medium', 'high', 'ultra'].map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </label>
          <Range label="AO radius" value={patch.ao?.radius ?? 1.1} min={0.05} max={12} onChange={(v) => section('ao', { radius: v })} />
          <Range label="AO intensity" value={patch.ao?.intensity ?? 2.2} min={0.25} max={8} onChange={(v) => section('ao', { intensity: v })} />
          <Toggle label="Half-resolution AO" value={patch.ao?.halfRes ?? true} onChange={(v) => section('ao', { halfRes: v })} />
        </>}

        <h4>Camera effects</h4>
        <Toggle label="Depth of field" value={patch.dof?.enabled ?? false} onChange={(v) => section('dof', { enabled: v })} />
        {patch.dof?.enabled && <>
          <Range label="Focus depth" value={patch.dof?.focusDistance ?? 0.035} min={0} max={1} onChange={(v) => section('dof', { focusDistance: v })} />
          <Range label="Focal length" value={patch.dof?.focalLength ?? 0.025} min={0.001} max={0.2} onChange={(v) => section('dof', { focalLength: v })} />
          <Range label="Aperture (f-stop)" value={patch.dof?.fStop ?? 2.8} min={0.08} max={32} onChange={(v) => section('dof', { fStop: v })} />
          <Range label="Bokeh scale" value={patch.dof?.bokeh ?? 1.2} min={0} max={6} onChange={(v) => section('dof', { bokeh: v })} />
        </>}
        <Toggle label="Chromatic aberration" value={patch.chromatic?.enabled ?? false} onChange={(v) => section('chromatic', { enabled: v })} />
        {patch.chromatic?.enabled && <Range label="Aberration offset" value={patch.chromatic?.offset ?? 0.001} min={0} max={0.01} step={0.0001} onChange={(v) => section('chromatic', { offset: v })} />}

        <h4>Grade and effects</h4>
        <Toggle label="Bloom" value={patch.bloom?.enabled ?? true} onChange={(v) => section('bloom', { enabled: v })} />
        <Range label="Bloom intensity" value={patch.bloom?.intensity ?? 0.55} min={0} max={6} onChange={(v) => section('bloom', { intensity: v })} />
        <Range label="Bloom threshold" value={patch.bloom?.threshold ?? 0.85} min={0} max={1} onChange={(v) => section('bloom', { threshold: v })} />
        <Range label="Saturation" value={patch.grade?.saturation ?? -0.22} min={-1} max={1} onChange={(v) => section('grade', { saturation: v })} />
        <Range label="Contrast" value={patch.grade?.contrast ?? 0.08} min={-1} max={1} onChange={(v) => section('grade', { contrast: v })} />
        <Toggle label="Vignette" value={patch.vignette?.enabled ?? true} onChange={(v) => section('vignette', { enabled: v })} />
        <Range label="Vignette darkness" value={patch.vignette?.darkness ?? 0.78} min={0} max={2} onChange={(v) => section('vignette', { darkness: v })} />
        <Toggle label="Film grain" value={patch.grain?.enabled ?? true} onChange={(v) => section('grain', { enabled: v })} />
        <Range label="Grain opacity" value={patch.grain?.opacity ?? 0.32} min={0} max={1} onChange={(v) => section('grain', { opacity: v })} />

        <h4>Light shafts and environment</h4>
        <Toggle label="God rays" value={patch.godRays?.enabled ?? false} onChange={(v) => section('godRays', { enabled: v })} />
        {patch.godRays?.enabled && <>
          <div className="st-vec"><span>Source XYZ</span>
            {(['X', 'Y', 'Z'] as const).map((axis, i) => <input key={axis} type="number" aria-label={`God ray source ${axis}`} step={0.5} value={(patch.godRays?.position ?? [0, 12, -28])[i]} onChange={(e) => section('godRays', { position: (patch.godRays?.position ?? [0, 12, -28]).map((n, k) => k === i ? +e.target.value : n) as [number, number, number] })} />)}
          </div>
          <Range label="Ray intensity" value={patch.godRays?.intensity ?? 1} min={0} max={4} onChange={(v) => section('godRays', { intensity: v })} />
          <Range label="Ray density" value={patch.godRays?.density ?? 0.92} min={0} max={1} onChange={(v) => section('godRays', { density: v })} />
          <Range label="Ray decay" value={patch.godRays?.decay ?? 0.92} min={0} max={1} onChange={(v) => section('godRays', { decay: v })} />
        </>}
        <label className="st-slider"><span>Environment light</span>
          <select aria-label="Environment lighting" value={patch.environment?.hdri ?? ''} onChange={(e) => setEnvironment(e.target.value)}>
            <option value="">Procedural night fill</option>
            {Object.entries(HDRI_LIBRARY).map(([id, asset]) => <option key={id} value={id}>{asset.label}</option>)}
          </select>
        </label>
        {patch.environment && <>
          <Range label="HDRI intensity" value={patch.environment.intensity} min={0} max={4} onChange={(v) => set({ environment: { ...patch.environment!, intensity: v } })} />
          <Range label="HDRI rotation" value={patch.environment.rotation} min={-360} max={360} step={1} onChange={(v) => set({ environment: { ...patch.environment!, rotation: v } })} />
          <Toggle label="Visible sky" value={patch.environment.background === true} onChange={(v) => set({ environment: { ...patch.environment!, background: v } })} />
          <Range label="Sky brightness" value={patch.environment.backgroundIntensity ?? .45} min={0} max={4} onChange={(v) => set({ environment: { ...patch.environment!, backgroundIntensity: v } })} />
          <Range label="Sky softness" value={patch.environment.backgroundBlurriness ?? .03} min={0} max={1} onChange={(v) => set({ environment: { ...patch.environment!, backgroundBlurriness: v } })} />
          <Range label="Sky rotation" value={patch.environment.backgroundRotation ?? patch.environment.rotation} min={-360} max={360} step={1} onChange={(v) => set({ environment: { ...patch.environment!, backgroundRotation: v } })} />
        </>}
        {cfg.environment === 'reference-forest' && cfg.props?.forest && <>
          <h4>Reference environment</h4>
          <Range label="Tree density" value={cfg.props.forest.density} min={0} max={1} onChange={(v) => forest({ density: v })} />
          <Range label="Ground texture scale" value={cfg.props.forest.textureScale} min={4} max={60} step={1} onChange={(v) => forest({ textureScale: v })} />
          <Range label="Ground normal strength" value={cfg.props.forest.normalStrength} min={0} max={2} onChange={(v) => forest({ normalStrength: v })} />
          <Range label="Terrain relief (m)" value={cfg.props.forest.relief ?? DEFAULT_RELIEF} min={0} max={.6} onChange={(v) => forest({ relief: v })} />
          <Range label="Ground wetness" value={cfg.props.forest.wetness} min={0} max={1} onChange={(v) => forest({ wetness: v })} />
          <Range label="Forest wind" value={cfg.props.forest.wind} min={0} max={2} onChange={(v) => forest({ wind: v })} />
          <Range label="Forest mist" value={cfg.props.forest.mist} min={0} max={.12} step={.005} onChange={(v) => forest({ mist: v })} />
          <Toggle label="Ground puddles" value={cfg.props.forest.puddles} onChange={(v) => forest({ puddles: v })} />
        </>}

        <h4>Budget and presets</h4>
        {metric
          ? <p className="st-help">Renderer: {metric.fps} FPS · {metric.calls} draw calls · {metric.triangles.toLocaleString()} triangles · {metric.textures} textures · {metric.geometries} geometries · {metric.programs} programs</p>
          : <p className="st-help">Move the film preview to sample renderer budget.</p>}
        <div className="st-row">
          <button onClick={reset} title="Restore only this scene's saved rendering settings">Reset rendering</button>
          <button onClick={savePreset} title="Download these rendering settings as JSON">Save preset</button>
          <button onClick={() => fileInput.current?.click()} title="Load a rendering preset JSON">Load preset</button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="st-file" aria-label="Rendering preset JSON" onChange={loadPreset} hidden />
        </div>
      </>}
    </section>
  )
}
