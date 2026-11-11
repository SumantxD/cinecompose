import type { ComponentType } from 'react'
import type { SceneConfig } from '../cinematic/types'
import { RailwayCrossingEnv } from './railway-crossing/RailwayCrossingEnv'

/** Environment key (scene.json `environment`) → 3D set. `void` = black stage for animatic scenes. */
export const ENVIRONMENTS: Record<string, ComponentType<{ lighting: SceneConfig['lighting'] }>> = {
  'railway-crossing': RailwayCrossingEnv,
  void: () => null,
}

/** Every scene.json under src/scenes, by sceneId. A folder may hold several scene configs sharing one environment. */
const FILES = import.meta.glob<SceneConfig>('./*/*.json', { eager: true, import: 'default' })
export const SCENES = new Map(Object.values(FILES).map((c) => [c.sceneId, c]))
/** sceneId → path under src/scenes (for the Studio's save). */
export const SCENE_FILES = new Map(Object.entries(FILES).map(([path, c]) => [c.sceneId, path.slice(2)]))

/** Placeholder for scenes the script references but nobody has built yet: black, rain, captions. */
export function animatic(sceneId: string): SceneConfig {
  return {
    sceneId,
    environment: 'void',
    duration: 0,
    shots: [],
    lighting: { ambientIntensity: 0, fogDensity: 0 },
    audio: { ambience: [{ sound: 'rain', volume: 0.35 }, { sound: 'night_drone', volume: 0.2 }], music: null },
    cues: [{ at: 0, action: 'fade', to: 1, duration: 0.4 }],
  }
}
