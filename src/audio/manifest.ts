// Every sound the episode can play. Scenes and cues refer to these ids only.
// To replace a synth with a recording: put the file in public/audio/, set `file`, log it in public/CREDITS.md.
// If the file fails to load, the synth fallback plays instead.

export interface SoundDef {
  file?: string
  synth: string
  loop?: boolean
  /** Positioned in 3D via cue `position`; otherwise plays flat. */
  spatial?: boolean
  volume?: number
}

export const SOUNDS: Record<string, SoundDef> = {
  // Rain is a composite: two beds with different loop lengths + live drop scheduler (AudioManager). Never one loop.
  rain: { synth: 'rain', loop: true },
  rain_body: { synth: 'rain_body', loop: true },
  drop_asphalt: { synth: 'drop_asphalt' },
  drop_leaf: { synth: 'drop_leaf' },
  drop_puddle: { synth: 'drop_puddle' },
  drip_tin: { synth: 'drip_tin' },
  night_drone: { synth: 'night_drone', loop: true },
  hum: { synth: 'hum', loop: true, spatial: true },
  tube_tick: { synth: 'tube_tick', spatial: true },
  signal: { synth: 'signal', spatial: true },
  footstep: { synth: 'footstep', spatial: true, volume: 0.5 },
  anklets: { synth: 'anklets', spatial: true, volume: 0.7 },
  train_horn: { synth: 'train_horn', spatial: true, volume: 0.9 },
  capture_hit: { synth: 'capture_hit', volume: 0.75 },
}
