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

export type HandleMode = 'locked' | 'direction' | 'free'

export interface CameraNode {
  id: string
  position: Vec3
  aim: Vec3
  in: Vec3
  out: Vec3
  aimIn: Vec3
  aimOut: Vec3
  mode: HandleMode
}

export interface CameraSegment {
  id: string
  from: number
  to: number
  duration: number
  easing: string
  /** Subrange of the parent timing function, preserved by nested splits. */
  easeRange?: [number, number]
}

export interface CameraPath {
  nodes: CameraNode[]
  segments: CameraSegment[]
}

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
  /** Named rendered subject for collision, occlusion and framing checks during authoring. */
  focus?: { object: string; local?: Vec3; radius?: number; optional?: boolean }
  /** Per-shot grade: exposure multiplier (×scene exposure). Set at the cut, like a colourist would. */
  exposure?: number
  /** Soft cool fill riding on the camera (film "eye light") so close subjects read. 0 = off. */
  eyeLight?: number
  /** Camera roll in radians (Dutch angle, CAM-10). Keep under 0.12. */
  roll?: number
  rollTo?: number
  ease?: string
  /** Explicit Bézier nodes and timing. Legacy from/to shots migrate only when edited. */
  path?: CameraPath
}

export type LightMode = 'off' | 'on' | 'flicker' | 'dying'

/** A timed event on the scene clock (seconds from scene start). */
export type Cue =
  | { at: number; action: 'light'; target: string; mode: LightMode }
  | { at: number; action: 'entity'; target: string; visible: boolean; position?: Vec3; tilt?: number; speed?: number; from?: Vec3; shadowOnly?: boolean; rotationY?: number; anim?: string; headYaw?: number; keep?: boolean; face?: boolean; feetForward?: boolean; smile?: boolean }
  | { at: number; action: 'train'; target: string; from: Vec3; to: Vec3; duration: number }
  | { at: number; action: 'sfx'; sound: string; volume?: number; position?: Vec3; rate?: number }
  | { at: number; action: 'ambience'; sound: string; volume: number; fade?: number }
  | { at: number; action: 'title'; visible: boolean }
  | { at: number; action: 'fade'; to: number; duration: number }

/** Authorable outdoor rain. Everything falls back to the environment's own setup when omitted. */
export interface RainConfig {
  /** false hides the outdoor rain emitters (shelter logic and audio are separate). */
  enabled?: boolean
  /** GPU rain streaks. 0 / omitted = the environment's own density. */
  count?: number
  /** Horizontal wind drift [x, z]. */
  wind?: [number, number]
}

export interface GroundMistConfig {
  center: Vec3
  width: number
  length: number
  height?: number
  opacity?: number
}

export interface SceneConfig {
  sceneId: string
  /** Key into scenes/registry.ts — which 3D environment to mount. */
  environment: string
  duration: number
  shots: Shot[]
  lighting: { ambientIntensity: number; fogDensity: number; exposure?: number; fogColor?: string; moon?: number; /** image-based fill (NightSky) intensity */ gi?: number }
  audio: { ambience: { sound: string; volume: number }[]; music: string | null }
  cues: Cue[]
  /** Set dressing selected by the story branch. */
  props?: { horse?: 'room' | 'carried' | 'meera' | 'absent' | 'inventory'; footprints?: boolean; cassette?: boolean; paperBurn?: { at: number; duration: number }; groundMist?: GroundMistConfig; rain?: RainConfig }
  /** Technique macros (cinematic/techniques.ts) — expanded into cues at build time. */
  techniques?: import('./techniques').TechniqueUse[]
}
