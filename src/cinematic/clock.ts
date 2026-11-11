import * as THREE from 'three'

/**
 * The scene clock. Every animated thing (camera, cues, flicker, rain) reads `clock.t`, never wall time,
 * so a scene can be stepped frame-by-frame for Reel export and look identical to live playback.
 */
export const clock = { t: 0, playing: false }

/** Live light state other systems react to (rain brightening near lamps, etc.). Filled by FlickeringLight. */
export const lightRegistry = new Map<string, { position: THREE.Vector3; color: THREE.Color; level: number; intensity: number }>()
