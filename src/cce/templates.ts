import { axis, effect, shake, sfx, type CceAction, type CceCategory, type CceEvent, type CceTemplate } from './types.ts'

// Data, not scene-specific React. Actions are normalized so duration/intensity stay live-editable.
const t = (category: CceCategory, id: string, name: string, description: string, duration: number, intensity: number, events: CceEvent[], actions: CceAction[], extra: Partial<CceTemplate> = {}): CceTemplate => ({
  category, id, name, description, duration, intensity, events, actions, cost: 'free', cooldown: 8, ...extra,
})
const events = {
  heard: ['sound-behind'] as CceEvent[], found: ['discovery', 'realisation'] as CceEvent[],
  unease: ['unease', 'watched'] as CceEvent[], appear: ['entity-appears'] as CceEvent[],
  gone: ['entity-vanishes'] as CceEvent[], chase: ['chase'] as CceEvent[],
  scare: ['jumpscare'] as CceEvent[], world: ['environment-reacts'] as CceEvent[],
}

export const CCE_TEMPLATES: CceTemplate[] = [
  // Camera
  t('camera', 'patient-push', 'Patient push', 'A restrained advance; let stillness carry the threat.', 4, .45, events.unease, [axis(0, 1, 'dolly', .6, false, 'inOut')], { cooldown: 14 }),
  t('camera', 'crash-zoom', 'Crash zoom', 'A fast lens punch, then settle back into the shot.', 1.1, .8, events.found, [axis(.08, .84, 'fov', -22, true), effect('chromatic', .1, .24, .0018)], { cost: 'low', cooldown: 18 }),
  t('camera', 'whip-pan', 'Whip pan', 'A sudden head-height turn toward an off-screen sound.', .9, .8, events.heard, [axis(.1, .16, 'yaw', 1.1), shake(.12, .18, .006, 14)]),
  t('camera', 'dutch-realisation', 'Dutch realisation', 'A bounded roll as the world stops feeling level.', 2.8, .55, ['realisation', 'unease'], [axis(0, 1, 'roll', .1, false, 'inOut'), axis(.15, .85, 'fov', -4, false, 'inOut')], { cooldown: 20 }),
  t('camera', 'dolly-punch', 'Dolly punch', 'A short physical push toward discovered evidence.', 1.2, .7, events.found, [axis(.08, .3, 'dolly', .9), axis(.55, .45, 'dolly', -.25, false, 'inOut')]),
  t('camera', 'snap-wide', 'Snap zoom out', 'Open the lens abruptly to expose the surrounding space.', 1.4, .7, events.found, [axis(.16, .12, 'fov', 20), axis(.2, .16, 'truck', .18)]),
  t('camera', 'orbit-reveal', 'Orbit snap', 'Move around the subject instead of merely turning the lens.', 1.6, .65, events.appear, [axis(.12, .36, 'orbit', .8), axis(.16, .3, 'dolly', .18)]),
  t('camera', 'pov-head-snap', 'POV head snap', 'A fast angular response; a motivated insert, not permanent FPS.', .8, .75, events.heard, [axis(.12, .1, 'yaw', -.9), axis(.14, .12, 'pitch', -.06)]),
  t('camera', 'micro-jitter', 'Micro jitter', 'Small seeded irregularity beneath an otherwise quiet hold.', 4, .3, events.unease, [shake(0, 1, .006, 7)]),
  t('camera', 'tracking-sprint', 'Tracking sprint', 'Deterministic running motion and forward surges; no free-roam controller.', 3, .85, events.chase, [shake(0, 1, .022, 11), axis(0, .25, 'dolly', .22, true), axis(.25, .25, 'dolly', .22, true), axis(.5, .25, 'dolly', .22, true), axis(.75, .25, 'dolly', .22, true)], { cooldown: 25 }),

  // Editing and cut-shape
  t('editing', 'jump-ahead', 'Jump cut', 'Skip forward in lens and position without changing scene time.', 1.2, .65, events.found, [axis(.42, .025, 'fov', -10), axis(.42, .025, 'dolly', .24)]),
  t('editing', 'smash-reverse', 'Smash reverse', 'One abrupt cut to the opposite side of the current subject.', 1.5, .85, events.appear, [axis(.48, .025, 'orbit', Math.PI), effect('blackout', .47, .045, .7)]),
  t('editing', 'flash-cut', 'Flash cut', 'A brief bright interruption with a tight lens on the other side.', 1.1, .65, events.scare, [effect('flash', .34, .07, .45), axis(.39, .61, 'fov', -15), effect('chromatic', .38, .16, .002)], { cost: 'low', cooldown: 22 }),
  t('editing', 'whip-cut', 'Whip cut', 'Use angular motion to motivate a hard reverse.', 1.3, .8, events.heard, [axis(.12, .12, 'yaw', .75), axis(.34, .025, 'orbit', Math.PI * .75)]),
  t('editing', 'repeat-angle', 'Repeated angle', 'Repeat a short event from two nearby, deliberately different framings.', 2.2, .55, events.found, [axis(.08, .18, 'fov', -7, true), axis(.42, .05, 'truck', .4), axis(.44, .18, 'fov', -10, true), axis(.7, .05, 'orbit', -.32), axis(.72, .18, 'fov', -5, true)]),
  t('editing', 'blackout-reveal', 'Blackout reveal', 'A short dark cut before returning with a closer lens.', 1.5, .65, events.appear, [effect('blackout', .35, .14, 1), axis(.43, .57, 'fov', -9), axis(.43, .57, 'dolly', .15)]),
  t('editing', 'micro-montage', 'Micro montage', 'Three terse inserts: wide, detail, displaced detail.', 2.4, .65, events.found, [axis(0, .3, 'fov', 8), axis(.32, .025, 'fov', -16), axis(.34, .27, 'dolly', .25), axis(.64, .025, 'truck', .34), axis(.64, .025, 'fov', -8)]),
  t('editing', 'held-breath', 'Held breath', 'A nearly black beat while the sound drops away.', 1.8, .5, events.unease, [effect('blackout', .18, .45, .28), { kind: 'ambience', at: .18, hold: .7, sound: 'rain', volume: 0, fade: .12 }]),

  // Reaction choreography
  t('reaction', 'fear-retreat', 'Fear / retreat', 'A backward move and an imperfect, seeded head response.', 1.7, .75, events.scare, [axis(.12, .4, 'dolly', -.75), axis(.12, .2, 'yaw', .14), shake(.1, .55, .012, 10)]),
  t('reaction', 'shock-zoom', 'Shock / stop then zoom', 'A wide register followed by an unmistakably close response.', 1.5, .8, events.found, [axis(.1, .12, 'fov', 7), axis(.42, .15, 'fov', -16), effect('blackout', .38, .055, .25)]),
  t('reaction', 'confusion', 'Confusion / searching frame', 'Small alternating tilts, never an unmotivated glitch.', 2.5, .45, ['realisation', 'unease'], [axis(.04, .32, 'roll', .055, true, 'inOut'), axis(.32, .32, 'yaw', -.16, true, 'inOut'), axis(.64, .32, 'roll', -.045, true, 'inOut')]),
  t('reaction', 'panic', 'Panic / handheld', 'More motion and a wider lens, bounded so orientation survives.', 2.6, .85, events.chase, [shake(0, 1, .026, 12), axis(0, .14, 'fov', 8)]),
  t('reaction', 'realisation-close', 'Realisation / slow then close', 'Observation first, impact second.', 3.2, .65, events.found, [axis(0, .68, 'dolly', .35, false, 'inOut'), axis(.7, .12, 'fov', -14)]),
  t('reaction', 'watched-stop', 'Being watched / stop', 'A slow search that locks when it finds the wrong space.', 3, .4, events.unease, [axis(0, .72, 'yaw', .42, false, 'inOut'), shake(.76, .12, .004, 10), axis(.78, .22, 'fov', -3)]),

  // Horror grammar; entity/light restoration is compiled against the surrounding scene.
  t('horror', 'subliminal-figure', 'Subliminal apparition', 'The figure exists only across a short dark interruption.', 1.4, .7, events.appear, [effect('blackout', .3, .1, .7), { kind: 'entity', at: .33, hold: .06, visible: true }, effect('chromatic', .34, .12, .001)], { requires: ['entity'], cost: 'low', cooldown: 35 }),
  t('horror', 'darkness-displacement', 'Darkness displacement', 'Light stutters; the figure is present only inside the dark beat.', 1.8, .75, events.appear, [{ kind: 'light', at: .15, hold: .62, mode: 'flicker' }, { kind: 'entity', at: .32, hold: .16, visible: true }, sfx(.18, 'tube_tick', .13)], { requires: ['entity', 'light'], cooldown: 35 }),
  t('horror', 'false-reveal', 'False reveal', 'Advance on a suspicion, then open the lens instead of paying it off.', 2.6, .55, events.appear, [axis(0, .58, 'dolly', .6, false, 'inOut'), axis(.62, .12, 'fov', 12), axis(.66, .34, 'dolly', -.15, false, 'inOut')], { cooldown: 20 }),
  t('horror', 'delayed-apparition', 'Delayed apparition', 'Look, find nothing, then discover the figure after returning.', 3, .7, events.appear, [axis(.08, .22, 'yaw', .8), axis(.36, .2, 'yaw', -.65), { kind: 'entity', at: .59, hold: .36, visible: true }, sfx(.6, 'signal', .16, true)], { requires: ['entity'], cooldown: 35 }),
  t('horror', 'shadow-first', 'Shadow before figure', 'A shadow-only register precedes the readable silhouette.', 2.8, .65, events.appear, [{ kind: 'entity', at: .15, hold: .38, visible: true, shadowOnly: true }, { kind: 'entity', at: .55, hold: .4, visible: true }, axis(.52, .38, 'fov', -5, false, 'inOut')], { requires: ['entity'], cooldown: 35 }),
  t('horror', 'frame-displacement', 'Visual stutter', 'Two short frame displacements and a restrained lens discontinuity.', 1.25, .7, events.gone, [effect('blackout', .26, .05, .65), axis(.28, .04, 'truck', .07), effect('blackout', .42, .05, .65), axis(.44, .04, 'truck', -.11), axis(.46, .18, 'fov', -4, true), effect('chromatic', .27, .25, .0012)], { cost: 'low', cooldown: 18 }),
  t('horror', 'impact-close', 'Impact / extreme close', 'Silence, a close punch, seeded shake and a small impact—not a loud stinger.', 1.6, .9, events.scare, [{ kind: 'ambience', at: .06, hold: .35, sound: 'rain', volume: 0, fade: .03 }, axis(.4, .12, 'fov', -23), axis(.4, .16, 'dolly', .45), effect('flash', .41, .06, .3), shake(.42, .36, .023, 14), sfx(.43, 'capture_hit', .2)], { cost: 'low', cooldown: 30 }),

  // Audio choreography, using the existing explicit-unmute sound system.
  t('audio', 'cut-to-silence', 'Cut to silence', 'Pull both night beds briefly, then restore their authored levels.', 2.2, .45, events.unease, [{ kind: 'ambience', at: .18, hold: .7, sound: 'rain', volume: 0, fade: .04 }, { kind: 'ambience', at: .18, hold: .7, sound: 'night_drone', volume: 0, fade: .04 }]),
  t('audio', 'distant-motif', 'Distant motif', 'The three-note signal stays far away and quiet.', 2.5, .45, events.appear, [sfx(.24, 'signal', .22, true)]),
  t('audio', 'three-knocks', 'Three knocks', 'Three restrained impacts with deliberate air between them.', 2.8, .55, events.heard, [sfx(.15, 'knock_three', .2), sfx(.45, 'knock_three', .16), sfx(.78, 'knock_three', .22)]),
  t('audio', 'late-footstep', 'One step too late', 'A short footstep rhythm, then one step that should not remain.', 2.4, .55, events.heard, [sfx(.12, 'footstep', .28, true), sfx(.3, 'footstep', .25, true), sfx(.48, 'footstep', .3, true), sfx(.84, 'footstep', .34, true)]),
  t('audio', 'sound-behind', 'Sound behind', 'A quiet off-axis anklet cue, then hold the image.', 2, .5, events.heard, [sfx(.3, 'anklets', .18, true)]),

  // Environment-linked interruption
  t('environment', 'tube-stutter', 'Tube stutter', 'Starter click, bounded flicker, then restore the previous light state.', 1.6, .55, events.world, [{ kind: 'light', at: .2, hold: .58, mode: 'flicker' }, sfx(.2, 'tube_tick', .15)], { requires: ['light'] }),
  t('environment', 'power-dip', 'Power dip', 'The practical drops out and the frame darkens with it.', 1.8, .65, events.world, [{ kind: 'light', at: .3, hold: .42, mode: 'off' }, effect('blackout', .3, .42, .35), sfx(.3, 'tube_tick', .12)], { requires: ['light'] }),
  t('environment', 'light-dies', 'Distant light dies', 'A delayed extinction after the viewer has settled into the frame.', 3.2, .55, events.world, [{ kind: 'light', at: .42, hold: .52, mode: 'off' }, axis(.46, .4, 'fov', -3, false, 'inOut')], { requires: ['light'] }),
  t('environment', 'camera-tremor', 'Camera tremor', 'A low passing-rumble and restrained camera vibration; no fake rigid-body destruction.', 2.4, .65, events.world, [shake(.1, .75, .014, 8), sfx(.12, 'train_pass', .14)]),

  // Editorial only: author-supplied text, never generated story/dialogue.
  t('editorial', 'impact-word', 'Impact word', 'Your editorial word with a synchronized lens pulse.', 1.1, .55, events.found, [{ kind: 'text', at: .15, duration: .65 }, axis(.15, .2, 'fov', -6, true)], { requires: ['text'], cooldown: 12 }),
  t('editorial', 'quiet-word', 'Quiet word', 'Your editorial word held over an almost unmoving composition.', 2.6, .35, events.unease, [{ kind: 'text', at: .25, duration: .55 }, axis(0, 1, 'dolly', .08, false, 'inOut')], { requires: ['text'], cooldown: 12 }),

  // Curated combinations
  t('composite', 'discovery-sequence', 'Discovery sequence', 'Observe, tighten, reverse, then leave a little silence.', 4, .7, events.found, [axis(0, .4, 'dolly', .25, false, 'inOut'), axis(.4, .08, 'fov', -14), axis(.56, .025, 'orbit', -.55), { kind: 'ambience', at: .68, hold: .3, sound: 'rain', volume: 0, fade: .08 }, sfx(.55, 'tube_tick', .12)], { cooldown: 25 }),
  t('composite', 'chase-pressure', 'Chase pressure', 'Three wide/narrow pulses over a physically motivated run.', 3.6, .85, events.chase, [shake(0, 1, .022, 11), axis(.08, .18, 'fov', 9, true), axis(.34, .06, 'truck', .25, true), axis(.56, .1, 'fov', -12, true), axis(.8, .1, 'truck', -.2, true)], { cooldown: 25 }),
]

export const CCE_CATEGORIES: [CceCategory, string][] = [
  ['camera', 'Camera'], ['editing', 'Editing'], ['reaction', 'Reactions'], ['horror', 'Horror'],
  ['audio', 'Audio'], ['environment', 'Environment'], ['editorial', 'Editorial'], ['composite', 'Combinations'],
]
