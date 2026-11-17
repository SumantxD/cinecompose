import type { Cue, Vec3 } from './types.ts'
import { STEP_HZ } from './presets.ts'

// Technique macros: a scene lists `{ "use": "LGT-03", "at": 20.5, ...params }` and it expands into plain cues
// on the scene clock, so techniques compose without fighting over camera, audio or story timing.
// IDs and intent: docs/cinematics/horror-techniques.md. Erasable TS only — scripts/check-episode.mjs imports this.

export interface TechniqueUse {
  use: string
  at: number
  [param: string]: unknown
}

type Macro = (t: TechniqueUse) => Cue[]

const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d)
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)

export const TECHNIQUES: Record<string, Macro> = {
  /** LGT-03 Flicker Displacement: light stutters, the entity changes inside the dark, light settles. */
  'LGT-03': (t) => {
    const light = str(t.light), entity = str(t.entity)
    const after: Cue[] = t.position
      ? [{ at: t.at + 0.4, action: 'entity', target: entity, visible: true, position: t.position as Vec3 }]
      : [{ at: t.at + 0.4, action: 'entity', target: entity, visible: false }]
    return [
      { at: t.at, action: 'light', target: light, mode: 'flicker' },
      ...after,
      { at: t.at + num(t.duration, 0.9), action: 'light', target: light, mode: str(t.settle, 'on') as 'on' },
    ]
  },

  /** SND-01 + ENT-04: she is simply there, and the motif sounds far away. */
  'ENT-04': (t) => [
    { at: t.at, action: 'entity', target: str(t.entity), visible: true, position: t.position as Vec3 | undefined },
    { at: t.at + num(t.motifDelay, 3.5), action: 'sfx', sound: 'signal', volume: num(t.volume, 0.3), position: (t.motifFrom as Vec3) ?? [30, 3, -20] },
  ],

  /** EDT-01 Cut to Silence: instant black and every listed bed gone at once. */
  'EDT-01': (t) => [
    { at: t.at, action: 'fade', to: 1, duration: 0.01 },
    ...((t.beds as string[]) ?? ['rain', 'night_drone']).map((sound): Cue => ({ at: t.at, action: 'ambience', sound, volume: 0, fade: 0 })),
  ],

  /**
   * SND-03 Rhythm Matching: your footsteps (synced to the pov_walk bob), and optionally someone else's
   * matching them `lag` seconds late from `otherFrom` — who takes `extra` more steps after you stop.
   */
  'SND-03': (t) => {
    const count = num(t.count, 8), interval = 1 / num(t.hz, STEP_HZ), cues: Cue[] = []
    const sound = str(t.sound, 'footstep'), other = str(t.other)
    for (let i = 0; i < (t.selfSilent ? 0 : count); i++) {
      const at = t.at + i * interval
      cues.push({ at, action: 'sfx', sound, volume: num(t.volume, 0.6) * (0.85 + 0.15 * ((i * 7) % 3) / 2), rate: 0.94 + ((i * 5) % 4) * 0.03 })
    }
    if (other)
      for (let i = 0; i < count + num(t.extra, 0); i++)
        cues.push({ at: t.at + i * interval + num(t.lag, 0.04), action: 'sfx', sound: other, volume: num(t.otherVolume, 0.5), position: (t.otherFrom as Vec3) ?? [0, 0.2, -3] })
    return cues
  },

  /** SND-05 Pull the Rain: the bed fades out so slowly the silence arrives before anyone notices. */
  'SND-05': (t) => [{ at: t.at, action: 'ambience', sound: str(t.sound, 'rain'), volume: 0, fade: num(t.duration, 10) }],
}

export function expandTechniques(uses: TechniqueUse[] = []): Cue[] {
  return uses.flatMap((u) => {
    const macro = TECHNIQUES[u.use]
    if (!macro) throw new Error(`Unknown technique "${u.use}" (see docs/cinematics/horror-techniques.md)`)
    return macro(u)
  })
}
