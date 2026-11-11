import type { ShotType } from './types'

/**
 * How each shot type feels. Scenes only choose a type; tune the feel here once for the whole series.
 * drift: amplitude (m) of a slow, breath-like camera float. Never shake — see docs/cinematics/horror-techniques.md.
 */
/** bob: walking head-bob amplitude (m), synced to STEP_HZ — the same rate footstep macros use. */
export const STEP_HZ = 1.8

export const PRESETS: Record<ShotType, { ease: string; drift: number; driftRate: number; bob?: number }> = {
  static: { ease: 'none', drift: 0.004, driftRate: 0.3 }, // a held camera still breathes
  slow_push: { ease: 'sine.inOut', drift: 0.006, driftRate: 0.25 },
  pull_back: { ease: 'sine.inOut', drift: 0.006, driftRate: 0.25 },
  track_lateral: { ease: 'none', drift: 0.004, driftRate: 0.3 },
  pan: { ease: 'sine.inOut', drift: 0, driftRate: 0 },
  focus: { ease: 'power2.inOut', drift: 0.003, driftRate: 0.2 },
  over_shoulder: { ease: 'sine.inOut', drift: 0.01, driftRate: 0.35 },
  low_angle: { ease: 'sine.inOut', drift: 0.002, driftRate: 0.2 },
  high_angle: { ease: 'sine.inOut', drift: 0.003, driftRate: 0.2 },
  first_person: { ease: 'sine.inOut', drift: 0.018, driftRate: 0.45 },
  pov_walk: { ease: 'none', drift: 0.01, driftRate: 0.4, bob: 0.03 },
  security: { ease: 'none', drift: 0, driftRate: 0 },
}
