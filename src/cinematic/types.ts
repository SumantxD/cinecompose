export type Vec3 = [number, number, number]

/** Camera presets. Behaviour lives in cinematic/presets.ts — scenes only pick one. */
export type ShotType =
  | 'static'
  | 'slow_push'
  | 'pull_back'
  | 'track_lateral'
  | 'pan'
  | 'focus'
  | 'over_shoulder'
  | 'low_angle'
  | 'high_angle'
  | 'first_person'
  | 'pov_walk'
  | 'security'

export interface Shot {
  id: string
  type: ShotType
  duration: number
  from: Vec3
  to?: Vec3
  lookAt: Vec3
  lookAtTo?: Vec3
  /** Vertical FOV for landscape (16:9). */
  fov: number
  /** Vertical FOV for portrait (9:16). Defaults to fov * 1.45. */
  fovPortrait?: number
  /** Per-shot grade: exposure multiplier (×scene exposure). Set at the cut, like a colourist would. */
  exposure?: number
  /** Soft cool fill riding on the camera (film "eye light") so close subjects read. 0 = off. */
  eyeLight?: number
  /** Camera roll in radians (Dutch angle, CAM-10). Keep under 0.12. */
  roll?: number
  rollTo?: number
  ease?: string
}

export type LightMode = 'off' | 'on' | 'flicker' | 'dying'

/** A timed event on the scene clock (seconds from scene start). */
export type Cue =
  | { at: number; action: 'light'; target: string; mode: LightMode }
  | { at: number; action: 'entity'; target: string; visible: boolean; position?: Vec3; tilt?: number; speed?: number; from?: Vec3; shadowOnly?: boolean; rotationY?: number; anim?: string; headYaw?: number; keep?: boolean }
  | { at: number; action: 'sfx'; sound: string; volume?: number; position?: Vec3; rate?: number }
  | { at: number; action: 'ambience'; sound: string; volume: number; fade?: number }
  | { at: number; action: 'title'; visible: boolean }
  | { at: number; action: 'fade'; to: number; duration: number }

export interface SceneConfig {
  sceneId: string
  /** Key into scenes/registry.ts — which 3D environment to mount. */
  environment: string
  duration: number
  shots: Shot[]
  lighting: { ambientIntensity: number; fogDensity: number; exposure?: number; fogColor?: string; moon?: number; /** image-based fill (NightSky) intensity */ gi?: number }
  audio: { ambience: { sound: string; volume: number }[]; music: string | null }
  cues: Cue[]
  /** Technique macros (cinematic/techniques.ts) — expanded into cues at build time. */
  techniques?: import('./techniques').TechniqueUse[]
}
