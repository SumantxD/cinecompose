import * as THREE from 'three'
import { createCharacterRig } from './rig.ts'
import { solveTwoBone } from './pose.ts'
import { DEFAULT_MOTION } from './types.ts'
import type { CharacterClip, FacialChannel, Vec3 } from './types.ts'
import sourceMetadata from './animation-source.ts'

export type AnimationCategory = 'Idle' | 'Locomotion' | 'Reactions' | 'Creature' | 'Survival' | 'Interactions' | 'Face'
export interface FacePose { mouthOpen: number; smile: number; frown: number; eyes: number; browAngle: number; browRaise: number; eyeShift: number }
export interface PoseFrame {
  q?: Record<string, Vec3>
  hips?: Vec3
  hands?: Partial<Record<'left' | 'right', Vec3>>
  gait?: { stride: number; lift: number; sink: number; phase?: number; backwards?: boolean; side?: number; asymmetry?: number }
  face?: Partial<FacePose>
  blink?: boolean
}
export interface AnimationDefinition {
  id: string
  name: string
  category: AnimationCategory
  duration: number
  loop: boolean
  origin: 'CC0' | 'Authored'
  sourceClip?: string
  summary: string
  tags: string[]
  pose?: (u: number) => PoseFrame
}
export interface AuthoringSettings { speed: number; strength: number; mirror: boolean }
type EntryInput = Partial<AnimationDefinition> & Pick<AnimationDefinition, 'id' | 'name' | 'category' | 'pose'>
type EntryOptions = Partial<EntryInput> & Partial<PoseFrame>

const entry = (input: EntryInput): AnimationDefinition => ({ duration: 3, loop: true, origin: 'Authored', summary: 'Restrained, full-body motion', tags: input.id.split('-'), ...input })
const sourceFiles = [
  ['Action_dance', 'Survival'],
  ['Action_interact', 'Interactions', false],
  ['Action_pick_up_from_a_table', 'Interactions', false],
  ['Action_sit_down', 'Interactions', false],
  ['Action_stand_up_from_sitting', 'Interactions', false],
  ['Block_with_the_sword', 'Survival', false],
  ['Death_fall_backwards', 'Survival', false],
  ['Dodge_roll', 'Survival', false],
  ['Hit_knockback', 'Survival', false],
  ['Hit_to_the_chest', 'Survival', false],
  ['Hit_to_the_head', 'Survival', false],
  ['Idle_arms_folded_waiting', 'Idle'],
  ['Idle_crouching', 'Idle'],
  ['Idle_relaxed', 'Idle'],
  ['Idle_sitting', 'Idle'],
  ['Idle_talking', 'Idle'],
  ['Idle_with_a_sword', 'Idle'],
  ['Idle_zombie', 'Creature'],
  ['Jump_in_the_air', 'Survival'],
  ['Jump_landing', 'Survival', false],
  ['Jump_take_off', 'Survival', false],
  ['Move_climb_up_1_m', 'Interactions', false],
  ['Move_get_up_from_the_ground', 'Survival', false],
  ['Punch_cross_right_2', 'Survival', false],
  ['Punch_hook_right_2', 'Survival', false],
  ['Punch_jab_left_2', 'Survival', false],
  ['Run_jog_forwards', 'Locomotion'],
  ['Run_sprint', 'Locomotion'],
  ['Strike_zombie_scratch', 'Creature', false],
  ['Sword_slash', 'Survival', false],
  ['Walk_carrying', 'Locomotion'],
  ['Walk_crouched_forwards', 'Locomotion'],
  ['Walk_formal', 'Locomotion'],
  ['Walk_forwards', 'Locomotion'],
  ['Walk_zombie_forwards', 'Creature'],
] as const
const imported: AnimationDefinition[] = sourceFiles.map(([sourceClip, category, loop]) => ({
  id: sourceClip.toLowerCase().replaceAll('_', '-'), name: sourceClip.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()),
  category, duration: sourceMetadata.find(entry => entry.clip === sourceClip)!.duration, loop: loop ?? true, origin: 'CC0', sourceClip, summary: 'Quaternius motion, retargeted to the shared rig', tags: sourceClip.split('_'),
}))
const theta = Math.PI * 2, smooth = (x: number) => { const v = Math.min(1, Math.max(0, x)); return v * v * (3 - 2 * v) }
const sine = (u: number, frequency = 1, offset = 0) => Math.sin(u * theta * frequency + offset)
const pulse = (u: number, centre: number, width: number) => {
  const distance = Math.min(Math.abs(u - centre), 1 - Math.abs(u - centre))
  return distance >= width ? 0 : smooth(1 - distance / width) ** 2
}
const curve = (u: number, stops: [number, number][]): number => {
  if (u <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    const [end, value] = stops[i], [start, previous] = stops[i - 1]
    if (u <= end) return previous + (value - previous) * smooth((u - start) / (end - start))
  }
  return stops.at(-1)![1]
}
const blink = (u: number) => pulse(u, 0.62, 0.023)

function idle(id: string, name: string, lean: number, specific: (u: number) => PoseFrame = () => ({}), options: EntryOptions = {}): AnimationDefinition {
  return entry({ id, name, category: 'Idle', duration: 4.6, ...options, pose: u => {
    const override = specific(u)
    return {
      hips: override.hips ?? options.hips ?? [sine(u, 0.5) * 0.009, sine(u) * 0.006, 0],
      q: {
        spine: [lean + sine(u) * 0.8, sine(u, 0.5) * 1.1, 0],
        chest: [lean * 0.7 + sine(u) * 1.3, 0, sine(u, 0.5) * 0.7],
        head: [0, 0, 0], leftShoulder: [sine(u) * 1.6, 0, 3.2], rightShoulder: [-sine(u) * 1.6, 0, -3.2],
        leftElbow: [-8 + sine(u) * 1.4, 0, 0], rightElbow: [-8 - sine(u) * 1.4, 0, 0],
        ...options.q, ...override.q,
      },
      hands: override.hands ?? options.hands,
      face: { eyeShift: sine(u, 2) * 0.06, ...options.face, ...override.face },
      blink: override.blink ?? options.blink ?? true,
    }
  } })
}

const idles = [
  idle('idle-breathing', 'Quiet breathing', 1, u => ({ q: { head: [sine(u) * 1.1, 0, 0] } }), { duration: 5.4, summary: 'Small breath and weight shifts. A neutral starting state.' }),
  idle('idle-nervous', 'Nervous waiting', 3, u => ({ q: { head: [4, curve(u, [[0, 0], [.18, -17], [.44, -17], [.65, 9], [.9, 0], [1, 0]]), sine(u, 2) * 1.4] }, face: { browAngle: -.28, browRaise: .15, eyeShift: sine(u, 2) * .18 } }), { summary: 'Uneasy gaze and guarded shoulders, without continuous fidgeting.' }),
  idle('idle-suspicious', 'Suspicious listening', -1, u => ({ q: { head: [0, curve(u, [[0, 0], [.2, -28], [.48, -28], [.78, 19], [1, 0]]), -3] }, face: { browAngle: .22, eyes: .58, eyeShift: curve(u, [[0, -.4], [.23, -.6], [.48, -.6], [.8, .5], [1, -.4]]) } }), { duration: 5.8 }),
  idle('idle-aggressive', 'Aggressive stance', 9, u => ({
    q: { spine: [9, 0, 0], chest: [8, 0, 0], head: [-4, sine(u, .5) * 3.5, 0], leftShoulder: [-12, 0, 10], rightShoulder: [-12, 0, -10], leftElbow: [-38, 0, 0], rightElbow: [-38, 0, 0] },
    face: { browAngle: .65, mouthOpen: .05 + Math.max(0, sine(u)) * .07 },
  }), { summary: 'Low breathing, planted legs and a contained forward threat.' }),
  idle('idle-sleep', 'Slumped sleep', 27, u => ({
    hips: [0, -.18, 0], face: { eyes: .015, mouthOpen: .035 }, blink: false,
    q: { spine: [27, 0, 0], chest: [21, 0, 6], head: [29, sine(u, .5) * 2, 12], leftHip: [-16, 0, 0], rightHip: [-16, 0, 0], leftKnee: [29, 0, 0], rightKnee: [29, 0, 0] },
  }), { duration: 7.2 }),
  idle('idle-injured', 'Injured breathing', 18, u => ({
    hips: [-.035, -.08, 0], hands: { right: [-.14, 1.18, .24] },
    q: { spine: [18, 0, -5], chest: [14, 0, 6], head: [15, -10 + sine(u) * 2, -5], leftHip: [-5, 0, -4], rightHip: [-9, 0, 5], leftKnee: [11, 0, 0], rightKnee: [15, 0, 0] },
    face: { frown: .38, browAngle: -.4, eyes: .48, mouthOpen: .1 + Math.max(0, sine(u, 2)) * .12 },
  }), { duration: 4.4 }),
  idle('idle-praying', 'Quiet prayer', 9, () => ({ q: { head: [10, 0, 0] }, hands: { left: [.045, 1.28, .31], right: [-.045, 1.28, .31] }, face: { eyes: .06, frown: .2 } }), { duration: 5.8, summary: 'Joined hands, bowed head and a very small sway.' }),
  idle('idle-possessed', 'Possessed stillness', -4, u => ({
    q: { spine: [-4, 0, 0], chest: [-5, 0, -2], head: [pulse(u, .44, .065) * 10, pulse(u, .68, .045) * 7, curve(u, [[0, 0], [.32, 0], [.46, 17], [.65, 17], [.84, 0], [1, 0]])], leftShoulder: [0, 0, -5], rightShoulder: [0, 0, 5] },
    face: { eyes: .9, mouthOpen: .08 + pulse(u, .44, .065) * .25, browRaise: -.3 }, blink: false,
  }), { duration: 5.3, summary: 'Long stillness interrupted by one small, controlled movement.' }),
  idle('idle-defensive', 'Defensive crouch', 17, () => ({
    hips: [0, -.23, 0], q: { spine: [17, 0, 0], chest: [10, 0, 0], head: [13, 0, 0], leftHip: [-32, 0, -3], rightHip: [-29, 0, 4], leftKnee: [38, 0, 0], rightKnee: [35, 0, 0] },
    hands: { left: [.15, 1.28, .36], right: [-.18, 1.32, .32] }, face: { eyes: .85, browAngle: .35 },
  }), { duration: 3.6 }),
  idle('idle-dead-eyes', 'Dead-eyed stare', -1, () => ({
    q: { spine: [-1, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], leftShoulder: [0, 0, -3], rightShoulder: [0, 0, 3], leftElbow: [-4, 0, 0], rightElbow: [-4, 0, 0] },
    face: { eyes: 1, mouthOpen: .035, browRaise: -.25 }, blink: false,
  }), { duration: 6, summary: 'Almost no movement. An unblinking, attentive partner to the natural idles.' }),
  idle('idle-shoulders', 'Shoulder tension release', 5, u => ({
    q: { spine: [5, 0, 0], chest: [4, 0, 0], head: [4, 0, 0], leftShoulder: [0, 0, 3 + pulse(u, .45, .18) * 9], rightShoulder: [0, 0, -3 - pulse(u, .45, .18) * 9], leftElbow: [-14, 0, 0], rightElbow: [-14, 0, 0] },
    face: { browAngle: -.18 },
  }), { duration: 5.7 }),
  idle('idle-listen', 'Listening at the edge', 4, () => ({
    q: { spine: [4, -8, 0], chest: [3, -10, 0], head: [8, -21, 0], leftShoulder: [0, 0, 5], rightShoulder: [0, 0, -3] }, face: { eyes: .8, browRaise: .2, eyeShift: -.3 },
  }), { duration: 4.9 }),
]

interface GaitOptions { stride?: number; lift?: number; sink?: number; lean?: number; arm?: number; phase?: number; backwards?: boolean; side?: number; asymmetry?: number; sway?: number; zombie?: boolean; hurt?: boolean; lookBack?: boolean; loop?: boolean; summary?: string }
const walk = (id: string, name: string, duration: number, o: GaitOptions = {}): AnimationDefinition => entry({
  id, name, category: 'Locomotion', duration, loop: o.loop ?? true,
  summary: o.summary ?? (o.zombie ? 'Uneven pursuit, with restrained shoulder movement.' : 'Stance and swing phases with a grounded foot pass.'),
  pose: u => {
    const phase = u + (o.phase ?? 0), swing = sine(phase), side = o.hurt ? -1 : 1
    const q: Record<string, Vec3> = {
      spine: [o.lean ?? 3, -swing * 3.5, side * swing * (o.hurt ? 3 : 1)], chest: [(o.lean ?? 3) * .65, swing * 2, 0],
      hips: [0, -swing * 2.5, o.hurt ? -4 : swing * 1.2], head: [o.hurt ? 9 : 2, o.lookBack ? curve(u, [[0, 0], [.08, 0], [.23, 115], [.55, 115], [.83, 0], [1, 0]]) : -swing * 1.2, o.hurt ? -5 : 0],
    }
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? 1 : -1
      q[`${side}Shoulder`] = [sine(phase + (side === 'right' ? .5 : 0)) * (o.arm ?? 13), 0, sign * 3]
      q[`${side}Elbow`] = [-15 - Math.max(0, -sine(phase + (side === 'right' ? .5 : 0))) * 16, 0, 0]
    }
    return {
      hips: [swing * (o.sway ?? .012), -0.025 - (o.hurt ? pulse(u, .25, .18) * .045 : 0), 0], q,
      gait: { stride: o.stride ?? .26, lift: o.lift ?? .065, sink: o.sink ?? .045, backwards: o.backwards, side: o.side, asymmetry: o.asymmetry },
      hands: o.zombie ? { left: [.13, 1.14 + swing * .035, .36], right: [-.15, 1.13 - swing * .035, .39] } : undefined,
      face: { browRaise: o.hurt ? -.4 : 0, frown: o.hurt ? .45 : .03, mouthOpen: o.zombie ? .18 : o.hurt ? .12 : 0 }, blink: true,
    }
  },
})
const locomotion = [
  walk('walk-slow', 'Slow, deliberate walk', 2.3, { stride: .2, arm: 9, lean: 2 }),
  walk('walk-cautious', 'Cautious forward walk', 2.1, { stride: .19, arm: 8, sink: .08, lean: 7 }),
  walk('walk-hurried', 'Hurried frightened walk', 1.15, { stride: .28, arm: 20, lean: 8 }),
  walk('walk-backwards', 'Cautious backward walk', 1.9, { stride: .18, arm: 8, backwards: true, lean: 5 }),
  walk('walk-side-step', 'Sidestep into cover', 1.55, { stride: .16, side: 1, sink: .06, arm: 7 }),
  walk('walk-sneak', 'Silent sneaking', 2.25, { stride: .14, lift: .032, sink: .23, lean: 19, arm: 6 }),
  walk('walk-crawl', 'Low crawl', 1.65, { stride: .13, lift: .025, sink: .48, lean: 46, arm: 4, sway: .02, summary: 'A low, forward crawl with a shortened step.' }),
  walk('walk-limp-left', 'Limping on the left leg', 2.15, { stride: .22, hurt: true, asymmetry: .62, lean: 9, arm: 7 }),
  walk('walk-limp-right', 'Limping on the right leg', 2.15, { stride: .22, hurt: true, asymmetry: -.62, lean: 9, arm: 7 }),
  walk('walk-injured', 'Walking while injured', 2.35, { stride: .15, lift: .035, hurt: true, sink: .09, lean: 14, arm: 5 }),
  walk('walk-stumble', 'Stumbling recovery', 1.6, { stride: .2, phase: .11, sway: .032, lift: .085, sink: .07, lean: 9, arm: 27, loop: false }),
  walk('walk-looking-back', 'Walking while looking behind', 3.6, { stride: .22, lookBack: true, sink: .065, lean: 5, arm: 10 }),
  walk('walk-hesitant', 'Hesitant steps', 2.8, { stride: .15, lift: .045, sink: .075, lean: 3, arm: 5, phase: .18 }),
  walk('walk-searching', 'Searching while walking', 3.2, { stride: .19, lean: 5, arm: 10, phase: .27, sway: .018 }),
]

function fear(id: string, name: string, recipe: (u: number) => PoseFrame, extra: EntryOptions = {}): AnimationDefinition {
  return entry({ id, name, category: 'Reactions', duration: 3.4, ...extra, pose: u => {
    const base = recipe(u), tiny = sine(u, 5) * .55
    return { face: { browAngle: -.38, eyes: .9, mouthOpen: .12 }, q: { spine: [4 + tiny, 0, 0], head: [3 - tiny, 0, 0], ...base.q }, ...base }
  } })
}
const reactions = [
  fear('fear-startle', 'Sudden startle', u => ({ hips: [0, -pulse(u, .25, .12) * .105, 0], q: { spine: [-pulse(u, .25, .12) * 14, 0, 0], head: [-pulse(u, .25, .12) * 18, 0, 0], leftShoulder: [0, 0, pulse(u, .25, .12) * 16], rightShoulder: [0, 0, -pulse(u, .25, .12) * 16] }, hands: { left: [.19, 1.32 + pulse(u, .25, .12) * .16, .17], right: [-.19, 1.32 + pulse(u, .25, .12) * .16, .17] }, face: { mouthOpen: pulse(u, .25, .12) * .55, browRaise: .75 } }), { duration: 2.7, loop: false }),
  fear('fear-freeze', 'Frozen by fear', u => ({ q: { spine: [8 + sine(u, 3) * .45, 0, 0], head: [-5, 0, 0] }, hips: [0, -.06, 0], hands: { left: [.2, 1.13, .18], right: [-.2, 1.13, .18] }, face: { eyes: 1.08, mouthOpen: .17 } }), { duration: 4.5, summary: 'The body almost stops. Only breathing and a small hand tremor remain.' }),
  fear('fear-look-back', 'Slow look behind', u => ({ q: { spine: [0, curve(u, [[0, 0], [.16, 8], [.43, 21], [.66, 21], [1, 0]]), 0], head: [curve(u, [[0, 0], [.15, -7], [.4, -10], [.7, -10], [1, 0]]), curve(u, [[0, 0], [.12, 0], [.35, 104], [.64, 104], [1, 0]]), 0] }, face: { eyeShift: curve(u, [[0, 0], [.15, .6], [.65, .6], [1, 0]]) } }), { duration: 4.7, loop: false }),
  fear('fear-head-turn', 'Slow, careful head turn', u => ({ q: { head: [curve(u, [[0, 0], [.2, -5], [.65, -5], [1, 0]]), curve(u, [[0, 0], [.25, -80], [.67, -80], [1, 0]]), 0] } }), { duration: 4.1, loop: false }),
  fear('fear-tremble', 'Trembling in place', u => ({ hips: [0, -.07 + sine(u, 3) * .008, 0], q: { spine: [10 + sine(u, 7) * 1.2, 0, sine(u, 5) * .7], head: [4 + sine(u, 9) * 1.4, 0, 0], leftElbow: [-53 + sine(u, 6) * 4, 0, 0], rightElbow: [-53 - sine(u, 6) * 4, 0, 0] } }), { duration: 3.8, summary: 'Low-amplitude, coherent tremors through the shoulders and hands.' }),
  fear('fear-back-away', 'Backing away in fear', u => ({ hips: [0, -.065, 0], q: { spine: [9 + pulse(u, .3, .16) * 9, 0, 0], head: [0, 0, 0] }, gait: { stride: .13, lift: .038, sink: .095, backwards: true }, hands: { left: [.2, 1.18, .27], right: [-.2, 1.18, .27] }, face: { eyes: 1.05, mouthOpen: .22 } }), { duration: 2.05 }),
  fear('fear-cover-face', 'Covering the face', u => { const a = curve(u, [[0, 0], [.2, 1], [.75, 1], [1, 0]]); return { q: { spine: [a * 15, 0, 0], head: [a * 17, 0, 0] }, hands: { left: [.13 * a + .2 * (1 - a), 1.05 + a * .49, .05 + a * .145], right: [-.13 * a - .2 * (1 - a), 1.04 + a * .49, .05 + a * .16] }, face: { eyes: .12, mouthOpen: a * .22, frown: a * .65 } } }, { duration: 4.2, loop: false }),
  fear('fear-hide-face', 'Hiding the face in both hands', u => ({ hips: [0, -.09, 0], q: { spine: [19 + sine(u, 3) * 1.2, 0, 0], head: [23, 0, 0] }, hands: { left: [.09, 1.46, .18], right: [-.09, 1.46, .18] }, face: { eyes: .02, frown: .65 } }), { duration: 4.8 }),
  fear('fear-look-down', 'Unable to look', u => { const a = curve(u, [[0, 0], [.23, 1], [.78, 1], [1, 0]]); return { q: { spine: [a * 6, 0, 0], head: [a * 24, -a * 9, 0] }, face: { eyes: .65 - a * .4, frown: a * .6, eyeShift: -a * .5 } } }, { duration: 3.9, loop: false }),
  fear('fear-point', 'Pointing at something', u => { const a = curve(u, [[0, 0], [.18, 1], [.65, 1], [1, 0]]); return { q: { spine: [0, a * 10, 0], head: [0, a * 14, 0], leftShoulder: [-4 * a, 0, 4] }, hands: { left: [.2, .87, .03], right: [-.16, .87 + a * .56, .02 + a * .49] }, face: { eyes: 1, mouthOpen: a * .18 } } }, { duration: 3.6, loop: false }),
  fear('fear-scream', 'A sudden scream', u => { const a = curve(u, [[0, 0], [.15, 1], [.55, 1], [.83, 0], [1, 0]]); return { hips: [0, -a * .04, 0], q: { spine: [-a * 8, 0, 0], head: [-a * 14, 0, 0], leftShoulder: [-a * 10, 0, a * 14], rightShoulder: [-a * 10, 0, -a * 14], leftElbow: [-a * 44, 0, 0], rightElbow: [-a * 44, 0, 0] }, face: { mouthOpen: a * .97, eyes: .85 + a * .3, browRaise: a * .8 } } }, { duration: 3.1, loop: false }),
  fear('fear-cry', 'Quiet crying', u => ({ q: { spine: [16 + sine(u, 3) * 1.5, 0, 0], head: [18 + sine(u, 5) * 1.2, 0, 0] }, hands: { left: [.14, 1.37, .19], right: [-.15, 1.17, .21] }, face: { frown: .8, browAngle: -.55, eyes: .32, mouthOpen: .10 + Math.max(0, sine(u, 3)) * .13 } }), { duration: 5.2 }),
  fear('fear-kneel', 'Falling to both knees', u => { const a = smooth(Math.min(1, u * 1.4)), rest = a * .31; return { hips: [0, rest - a * .53, 0], q: { spine: [a * 23, 0, 0], head: [a * 20, 0, 0], leftHip: [-a * 88, 0, 0], rightHip: [-a * 88, 0, 0], leftKnee: [a * 96, 0, 0], rightKnee: [a * 96, 0, 0], leftElbow: [-a * 20, 0, 0], rightElbow: [-a * 20, 0, 0] }, face: { frown: a * .7, eyes: .45, mouthOpen: a * .12 } } }, { duration: 3.2, loop: false }),
  fear('fear-pray', 'Praying under pressure', u => ({ hips: [0, -.48, 0], q: { spine: [15 + sine(u, 3) * .8, 0, 0], head: [18, 0, 0], leftHip: [-87, 0, 0], rightHip: [-87, 0, 0], leftKnee: [97, 0, 0], rightKnee: [97, 0, 0] }, hands: { left: [.05, 1.08, .29], right: [-.05, 1.08, .29] }, face: { eyes: .03, frown: .5, mouthOpen: .04 + Math.max(0, sine(u, 2)) * .06 } }), { duration: 4.4 }),
  fear('fear-plead', 'Pleading for help', u => ({ hips: [0, -.12, 0], q: { spine: [15 + sine(u) * 2, 0, 0], head: [8, 0, 0] }, hands: { left: [.16, 1.32 + sine(u) * .025, .38], right: [-.16, 1.31 - sine(u) * .025, .4] }, face: { frown: .65, mouthOpen: .12 + Math.max(0, sine(u, 3)) * .14 } }), { duration: 3.9 }),
  fear('fear-recoil', 'Recoil from a sudden sight', u => { const a = pulse(u, .2, .13); return { hips: [0, -a * .17, 0], q: { spine: [-a * 19, 0, 0], head: [a * 7, -a * 10, 0] }, hands: { left: [.2, 1.17 + a * .18, .17 + a * .16], right: [-.2, 1.17 + a * .18, .17 + a * .16] }, face: { eyes: 1.1, mouthOpen: a * .44, browRaise: a * .7 } } }, { duration: 2.5, loop: false }),
]

const creature = (id: string, name: string, pose: AnimationDefinition['pose'], extra: EntryOptions = {}): AnimationDefinition => entry({ id, name, category: 'Creature', duration: 3.6, ...extra, pose })
const creatures = [
  creature('creature-lurch', 'Uneven zombie lurch', u => ({ hips: [sine(u) * .04, -.08 + sine(u, 2) * .025, 0], q: { spine: [15, sine(u) * 7, sine(u) * 4], head: [7 + sine(u, 2) * 5, sine(u) * 10, 11 + sine(u, 3) * 3] }, gait: { stride: .18, lift: .06, sink: .1, phase: .1, asymmetry: .7 }, hands: { left: [.18, 1.14, .33], right: [-.16, 1.22, .27] }, face: { mouthOpen: .24, eyes: .25 } }), { duration: 2.2 }),
  creature('creature-crawl', 'Crawling creature', u => ({ hips: [sine(u, 2) * .025, -.56, 0], q: { hips: [64 + sine(u, 2) * 3, 0, 0], spine: [-8, sine(u) * 6, 0], chest: [8, -sine(u) * 8, 0], head: [25, sine(u) * 8, 0], leftHip: [60 + sine(u) * 19, 0, -7], rightHip: [60 - sine(u) * 19, 0, 7], leftKnee: [66 + sine(u, 1, .4) * 17, 0, 0], rightKnee: [66 - sine(u, 1, .4) * 17, 0, 0], leftAnkle: [-39, 0, 0], rightAnkle: [-39, 0, 0] }, hands: { left: [.19, .10, .39 + sine(u) * .13], right: [-.19, .10, .39 - sine(u) * .13] }, face: { mouthOpen: .32, eyes: .7 } }), { duration: 1.85, summary: 'Low body placement, alternating hand contacts and a dragging crawl.' }),
  creature('creature-lurk', 'Lurking low', u => ({ hips: [sine(u, .5) * .035, -.31, 0], q: { spine: [22, sine(u, .5) * 6, 0], head: [-8 + sine(u) * 2, curve(u, [[0, -17], [.38, -17], [.75, 24], [1, -17]]), 0], leftHip: [-36, 0, -8], rightHip: [-34, 0, 8], leftKnee: [49, 0, 0], rightKnee: [46, 0, 0] }, hands: { left: [.22, .55, .30], right: [-.22, .55, .30] }, face: { eyes: 1, mouthOpen: .13 } }), { duration: 4.8 }),
  creature('creature-sniff', 'Sniffing the air', u => ({ hips: [0, -.1, 0], q: { spine: [6, 0, 0], head: [curve(u, [[0, -9], [.2, 7], [.48, 12], [.72, 8], [1, -9]]), curve(u, [[0, 0], [.27, -18], [.67, 21], [1, 0]]), 0] }, face: { mouthOpen: .07 + Math.max(0, sine(u, 3)) * .13, eyes: .27 } }), { duration: 4.6 }),
  creature('creature-alert', 'Creature suddenly alert', u => { const a = pulse(u, .28, .09); return { q: { spine: [3, a * 13, 0], head: [a * 4, curve(u, [[0, 0], [.23, 0], [.3, 78], [.65, 78], [.95, 0], [1, 0]]), -a * 9] }, face: { eyes: .4 + a * .7, mouthOpen: a * .18 } } }, { duration: 3.8, loop: false }),
  creature('creature-attack', 'Creature claw attack', u => { const a = pulse(u, .37, .22); return { hips: [0, -.12, 0], q: { spine: [18 - a * 25, sine(u, 2) * 8, 0], head: [-a * 6, 0, 0] }, hands: { left: [.18 + a * .04, 1.25 - a * .43, .24 + a * .32], right: [-.17 - a * .04, 1.28 - a * .34, .27 + a * .24] }, face: { mouthOpen: .55, browAngle: .5, eyes: .8 } } }, { duration: 2.1, loop: false }),
  creature('creature-lunge', 'Creature lunge', u => { const a = pulse(u, .32, .21); return { hips: [0, -.16 - a * .15, a * .19], q: { spine: [8 + a * 26, 0, 0], head: [-a * 11, 0, 0] }, hands: { left: [.18, 1.31 + a * .12, .13 + a * .42], right: [-.18, 1.31 + a * .12, .13 + a * .42] }, face: { mouthOpen: .6 + a * .23, eyes: 1.1 } } }, { duration: 1.75, loop: false }),
  creature('creature-grab', 'Grabbing a victim', u => { const a = curve(u, [[0, 0], [.22, 1], [.6, 1], [1, 0]]); return { q: { spine: [12 + a * 14, 0, 0], head: [a * 12, 0, 0] }, hands: { left: [.18 - a * .05, 1.12 + a * .11, .1 + a * .32], right: [-.18 + a * .05, 1.1 + a * .18, .11 + a * .32] }, face: { mouthOpen: a * .38, eyes: .85 } } }, { duration: 2.7, loop: false }),
  creature('creature-drag', 'Dragging a victim', u => ({ hips: [0, -.26, -.025], q: { spine: [19, sine(u) * 6, 0], head: [7, sine(u) * 8, 0] }, gait: { stride: .13, lift: .04, sink: .24, backwards: true }, hands: { left: [.16, .96, .38 + sine(u) * .035], right: [-.16, .96, .38 + sine(u) * .035] }, face: { mouthOpen: .16, eyes: .5 } }), { duration: 2.5 }),
  creature('creature-feed', 'Feeding crouch', u => ({ hips: [0, -.48, 0], q: { spine: [41 + sine(u, 2) * 5, 0, 0], head: [25 + sine(u, 3) * 7, 0, 0], leftHip: [-75, 0, -7], rightHip: [-74, 0, 7], leftKnee: [86, 0, 0], rightKnee: [84, 0, 0] }, hands: { left: [.14, .69 + sine(u, 2) * .06, .33], right: [-.14, .69 + sine(u, 2) * .06, .34] }, face: { mouthOpen: .24 + Math.max(0, sine(u, 3)) * .33, eyes: .23 } }), { duration: 3.2 }),
  creature('creature-collapse', 'Collapsing creature', u => { const a = curve(u, [[0, 0], [.15, .28], [.56, 1], [1, 1]]); return { hips: [0, -a * .84, -a * .035], q: { hips: [-a * 72, 0, 0], spine: [-a * 12, 0, 0], head: [a * 17, 0, 0], leftShoulder: [0, 0, a * 28], rightShoulder: [0, 0, -a * 28] }, face: { eyes: .7 - a * .62, mouthOpen: .28 - a * .22 } } }, { duration: 3, loop: false }),
  creature('creature-twitch', 'Possessed body twitch', u => { const a = pulse(u, .42, .042), b = pulse(u, .65, .035); return { q: { spine: [(a - b) * 8, 0, 0], head: [(b - a) * 7, (a - b) * 13, a * 10], leftShoulder: [b * 7, 0, a * 12], rightShoulder: [-a * 7, 0, -b * 12] }, face: { eyes: 1, mouthOpen: .25 + a * .28 } } }, { duration: 4.7, summary: 'Two isolated twitches inside a still, alert hold.' }),
  creature('creature-spine-bend', 'Unnatural backward spine bend', u => { const a = curve(u, [[0, 0], [.3, 1], [.72, 1], [1, 0]]); return { hips: [0, -.08, 0], q: { hips: [-a * 12, 0, 0], spine: [-a * 28, 0, 0], chest: [-a * 42, 0, 0], neck: [-a * 22, 0, 0], head: [-a * 17, 0, 0] }, face: { mouthOpen: a * .5, eyes: .7 } } }, { duration: 4.6, loop: false }),
  creature('creature-head-snap', 'A single head snap', u => { const a = pulse(u, .35, .065); return { q: { head: [-a * 5, a * 88, a * 7] }, face: { eyes: .95, mouthOpen: .04 } } }, { duration: 3.8, loop: false, summary: 'A fast head turn with a hold and a slower return. No random shake.' }),
  creature('creature-rise', 'Rising from the ground', u => { const a = curve(u, [[0, 1], [.32, .7], [.9, 0], [1, 0]]); return { hips: [0, -a * .66, 0], q: { hips: [a * 64, 0, 0], spine: [a * 12, -a * 8, 0], head: [a * 17, 0, 0], leftHip: [-a * 35, 0, 0], rightHip: [-a * 24, 0, 0], leftKnee: [a * 42, 0, 0], rightKnee: [a * 35, 0, 0] }, face: { eyes: .1 + (1 - a) * .8, mouthOpen: .25 } } }, { duration: 3.8, loop: false }),
  creature('creature-flail', 'Trapped, flailing arms', u => ({ hips: [0, -.27, 0], q: { spine: [10 + sine(u, 2) * 9, sine(u, 3) * 13, sine(u, 4) * 6], head: [sine(u, 3) * 11, sine(u, 2) * 15, 0], leftHip: [-33, 0, 0], rightHip: [-31, 0, 0], leftKnee: [44, 0, 0], rightKnee: [42, 0, 0] }, hands: { left: [.32 + sine(u, 3) * .05, 1.22 + sine(u, 2) * .15, .19], right: [-.32 - sine(u, 3) * .05, 1.2 - sine(u, 2) * .14, .2] }, face: { mouthOpen: .55, eyes: 1.1 } }), { duration: 2.4 }),
]

const action = (id: string, name: string, pose: AnimationDefinition['pose'], category: AnimationCategory | EntryOptions = 'Interactions', extra: EntryOptions = {}): AnimationDefinition => entry({
  id, name, category: typeof category === 'string' ? category : 'Interactions', duration: 2.8, loop: false,
  ...typeof category === 'string' ? extra : category, ...extra, pose,
})
const interactions = [
  action('interaction-open-door', 'Opening a door', u => { const a = curve(u, [[0, 0], [.2, 1], [.65, 1], [1, 0]]); return { q: { spine: [a * 4, 0, 0], head: [a * 3, 0, 0] }, hands: { right: [-.15, 1.06 + a * .08, .04 + a * .32] } } }),
  action('interaction-close-door', 'Closing a door', u => { const a = curve(u, [[0, 1], [.25, 1], [.7, 0], [1, 0]]); return { q: { spine: [a * 5, 0, 0] }, hands: { right: [-.15, 1.12 - a * .05, .36 - a * .14] } } }),
  action('interaction-push-slow', 'Slowly pushing a door', u => { const a = curve(u, [[0, 0], [.25, 1], [.76, 1], [1, 0]]); return { hips: [0, -a * .035, a * .035], q: { spine: [a * 13, 0, 0], head: [a * 6, 0, 0] }, hands: { left: [.17, 1.13, .12 + a * .39], right: [-.17, 1.13, .12 + a * .39] } } }),
  action('interaction-knock', 'Knocking three times', u => { const a = Math.max(pulse(u, .28, .12), pulse(u, .51, .12), pulse(u, .74, .12)); return { q: { spine: [3, 0, 0], head: [a * 3, 0, 0] }, hands: { right: [-.17, 1.22, .23 + a * .11] } } }),
  action('interaction-window', 'Looking through a window', u => ({ hips: [0, -.07, .035], q: { spine: [5, 0, 0], head: [curve(u, [[0, -4], [.22, 8], [.52, 4], [.78, -5], [1, -4]]), curve(u, [[0, 0], [.33, -11], [.7, 9], [1, 0]]), 0] }, hands: { left: [.16, 1.15, .37], right: [-.16, 1.15, .37] }, face: { eyeShift: sine(u, .5) * .35 } }), { loop: true, duration: 4.7 }),
  action('interaction-pick-up', 'Picking something off the floor', u => { const a = curve(u, [[0, 0], [.25, 1], [.5, 1], [.85, 0], [1, 0]]); return { hips: [0, -a * .45, 0], q: { spine: [a * 43, 0, 0], head: [a * 16, 0, 0], leftHip: [-a * 32, 0, 0], leftKnee: [a * 48, 0, 0], rightHip: [-a * 29, 0, 0], rightKnee: [a * 46, 0, 0] }, hands: { right: [-.14, 1.12 - a * .93, .02 + a * .31], left: [.17, 1.11 - a * .24, .08 + a * .14] } } }),
  action('interaction-drop', 'Dropping an object', u => { const a = pulse(u, .4, .22); return { q: { spine: [a * 12, 0, 0], head: [a * 9, 0, 0] }, hands: { right: [-.16, 1.08 - a * .16, .19 + a * .1] } } }),
  action('interaction-search-drawer', 'Searching a drawer', u => ({ hips: [0, -.16, 0], q: { spine: [16, 0, 0], head: [13 + sine(u) * 4, sine(u) * 6, 0] }, hands: { left: [.2, .91, .29], right: [-.13 + sine(u) * .07, .88 + sine(u, 2) * .018, .34 + sine(u) * .05] }, face: { eyes: .48, eyeShift: sine(u) * .25 } }), { loop: true, duration: 4.2 }),
  action('interaction-stairs-up', 'Stepping up a stair', u => { const a = pulse(u, .38, .45); return { hips: [0, a * .1, a * .055], q: { spine: [a * 9, 0, 0] }, gait: { stride: .12, lift: .16, sink: .02 + a * .01 } } }),
  action('interaction-stairs-down', 'Stepping down carefully', () => ({ q: { spine: [6, 0, 0], head: [11, 0, 0] }, gait: { stride: .12, lift: .07, sink: .12 } })), 
  action('interaction-ladder', 'Climbing a ladder', u => ({ hips: [0, -.015 + sine(u, 2) * .035, 0], q: { spine: [4, 0, 0], head: [-9, sine(u, .5) * 2, 0], leftHip: [-37 + sine(u) * 25, 0, -9], rightHip: [-37 - sine(u) * 25, 0, 9], leftKnee: [48 - sine(u) * 24, 0, 0], rightKnee: [48 + sine(u) * 24, 0, 0] }, hands: { left: [.17, 1.67 + sine(u) * .16, .24], right: [-.17, 1.67 - sine(u) * .16, .24] } }), { loop: true, duration: 2.5 }),
  action('interaction-pull', 'Pulling with both hands', u => { const a = pulse(u, .42, .28); return { hips: [0, -.12 - a * .1, -a * .07], q: { spine: [a * 9, 0, 0], head: [a * 6, 0, 0] }, hands: { left: [.16, 1.07 + a * .04, .39 - a * .14], right: [-.16, 1.07 + a * .04, .39 - a * .14] } } }, { duration: 3.2 }),
  action('interaction-push', 'Pushing with both hands', u => { const a = pulse(u, .41, .27); return { hips: [0, -.09 - a * .05, a * .06], q: { spine: [6 + a * 16, 0, 0] }, hands: { left: [.17, 1.13, .13 + a * .31], right: [-.17, 1.13, .13 + a * .31] } } }),
  action('interaction-hide', 'Hiding behind an object', u => ({ hips: [0, -.23 + sine(u, 2) * .006, 0], q: { spine: [21, sine(u, .5) * 3, 0], head: [0, curve(u, [[0, 0], [.25, 0], [.48, 29], [.68, 29], [1, 0]]), 0], leftHip: [-37, 0, -4], rightHip: [-35, 0, 4], leftKnee: [43, 0, 0], rightKnee: [43, 0, 0] }, face: { eyes: .7, browAngle: -.25 } }), { loop: true, duration: 5 }),
  action('interaction-reach', 'Reaching for something', u => { const a = curve(u, [[0, 0], [.22, 1], [.65, 1], [1, 0]]); return { q: { spine: [a * 5, 0, 0], head: [a * 7, 0, 0] }, hands: { right: [-.15, 1.05 + a * .36, .01 + a * .35] } } }),
  action('interaction-listen-door', 'Listening at a door', () => ({ q: { spine: [7, -6, 0], head: [12, -18, 18] }, hands: { right: [-.2, 1.11, .29] }, face: { eyes: .36, eyeShift: -.25 } }), { loop: true, duration: 5.2 }),
]

const survival = [
  action('survival-kick', 'Defensive kick', u => { const a = pulse(u, .36, .22); return { hips: [0, -.08 - a * .08, 0], q: { spine: [-a * 13, 0, 0], rightHip: [-a * 72, 0, 0], rightKnee: [a * 75, 0, 0], rightAnkle: [-a * 24, 0, 0] }, face: { browAngle: .5, eyes: .85 } } }, 'Survival', { duration: 1.9 }),
  action('survival-block', 'Blocking with both arms', u => { const a = curve(u, [[0, 0], [.12, 1], [.58, 1], [1, 0]]); return { hips: [0, -a * .11, -a * .03], q: { spine: [a * 8, 0, 0], head: [a * 5, 0, 0] }, hands: { left: [.12, 1.05 + a * .36, .08 + a * .22], right: [-.12, 1.08 + a * .3, .1 + a * .24] }, face: { browAngle: a * .5, eyes: .6 + a * .25 } } }, 'Survival', { duration: 2.1 }),
  action('survival-dodge-left', 'Dodging to the left', u => { const a = pulse(u, .35, .25); return { hips: [a * .28, -a * .22, 0], q: { spine: [a * 17, 0, a * 16], head: [-a * 5, 0, -a * 8] }, gait: { stride: .12, lift: .07, sink: .13, side: 1 } } }, 'Survival', { duration: 1.7 }),
  action('survival-dodge-right', 'Dodging to the right', u => { const a = pulse(u, .35, .25); return { hips: [-a * .28, -a * .22, 0], q: { spine: [a * 17, 0, -a * 16], head: [-a * 5, 0, a * 8] }, gait: { stride: .12, lift: .07, sink: .13, side: -1 } } }, 'Survival', { duration: 1.7 }),
  action('survival-aim', 'Aiming a handheld object', () => ({ q: { spine: [4, -8, 0], head: [0, 7, 0], leftElbow: [-22, 0, 0] }, hands: { right: [-.15, 1.47, .39], left: [.08, 1.4, .32] }, face: { eyes: .8, browAngle: .3, eyeShift: .2 } }), 'Survival', { loop: true, duration: 3.7, summary: 'Aiming posture for an object parented to the hand. No weapon is included.' }),
  action('survival-fire', 'Firing with recoil', u => { const a = pulse(u, .17, .09); return { hips: [0, -a * .05, -a * .015], q: { spine: [-a * 8, 0, 0], head: [-a * 4, 0, 0] }, hands: { right: [-.15, 1.47 + a * .03, .39 - a * .08], left: [.08, 1.4 + a * .03, .32 - a * .06] }, face: { eyes: .8 - a * .25, browAngle: .4 } } }, 'Survival', { duration: 1.6 }),
  action('survival-reload', 'Reloading', u => ({ hips: [0, -.02, 0], q: { spine: [5, -5, 0], head: [15, 0, 0] }, hands: { left: [.05 + sine(u) * .055, 1.32 + sine(u, 2) * .03, .27], right: [-.12, 1.34, .26] }, face: { eyes: .42 } }), 'Survival', { duration: 3.8, summary: 'Hand movements for a reload. Match the prop and magazine in the scene.' }),
  action('survival-hit-reaction', 'Hit to the torso', u => { const a = pulse(u, .23, .2); return { hips: [0, -a * .11, -a * .06], q: { spine: [-a * 17, a * 8, 0], head: [a * 12, -a * 8, 0] }, hands: { left: [.12, 1.27, .2], right: [-.17, 1.02, .2] }, face: { mouthOpen: a * .5, frown: a * .7, browAngle: -.5 } } }, 'Survival', { duration: 2.2 }),
  action('survival-fall-back', 'Falling backward', u => { const a = curve(u, [[0, 0], [.12, .16], [.63, 1], [1, 1]]); return { hips: [0, -a * .84, -a * .04], q: { hips: [-a * 73, 0, 0], spine: [-a * 7, 0, 0], head: [a * 12, 0, 0], leftShoulder: [0, 0, a * 16], rightShoulder: [0, 0, -a * 16] }, face: { mouthOpen: .26 - a * .23, eyes: .85 - a * .75 } } }, 'Survival', { duration: 2.65 }),
  action('survival-fall-forward', 'Falling forward', u => { const a = curve(u, [[0, 0], [.12, .14], [.59, 1], [1, 1]]); return { hips: [0, -a * .84, a * .025], q: { hips: [a * 73, 0, 0], spine: [a * 13, 0, 0], head: [a * 16, 0, 0] }, hands: { left: [.23, .08, .55], right: [-.23, .08, .55] }, face: { eyes: .85 - a * .8, mouthOpen: .22 - a * .18 } } }, 'Survival', { duration: 2.45 }),
  action('survival-knocked-down', 'Getting knocked down', u => { const a = curve(u, [[0, 0], [.1, .14], [.37, .55], [.65, 1], [1, 1]]); return { hips: [0, -a * .84, -a * .08], q: { hips: [-a * 73, 0, a * 9], spine: [-a * 10, a * 10, 0], head: [a * 16, a * 13, 0] }, face: { mouthOpen: .46 - a * .44, eyes: .8 - a * .7 } } }, 'Survival', { duration: 2.8 }),
  action('survival-get-up', 'Getting back up', u => { const a = curve(u, [[0, 1], [.2, .9], [.7, 0], [1, 0]]); return { hips: [0, -a * .78, 0], q: { hips: [-a * 65, 0, 0], spine: [a * 21, 0, 0], head: [-a * 9, 0, 0], leftHip: [-a * 24, 0, 0], rightHip: [-a * 21, 0, 0], leftKnee: [a * 33, 0, 0], rightKnee: [a * 32, 0, 0] }, hands: { left: [.24, .08 + (1 - a) * .48, .39 - (1 - a) * .26] }, face: { eyes: .1 + (1 - a) * .7, mouthOpen: .16 } } }, 'Survival', { duration: 3.6 }),
  action('survival-death-back', 'Dying, falling backward', u => { const a = curve(u, [[0, 0], [.14, .2], [.52, .9], [.85, 1], [1, 1]]); return { hips: [0, -a * .86, -a * .03], q: { hips: [-a * 78 + Math.sin(u * theta * 2) * (1 - a) * 4, 0, 0], spine: [-a * 5, 0, 0], head: [a * 10, a * 9, a * 6] }, face: { mouthOpen: .3 - a * .3, eyes: .8 - a * .76, frown: .4 * (1 - a) } } }, 'Survival', { duration: 3.6, summary: 'A staggered fall with a settled, unblinking ending.' }),
  action('survival-gasp', 'Recovering breath', u => ({ q: { spine: [21 + sine(u, 3) * 4, 0, 0], head: [19 + sine(u, 3) * 5, 0, 0] }, hands: { left: [.13, 1.16, .19], right: [-.13, 1.06, .22] }, face: { mouthOpen: .25 + Math.max(0, sine(u, 3)) * .3, eyes: .4, browRaise: .2 } }), 'Survival', { loop: true, duration: 4.4 }),
]

interface FacialPreset extends Partial<FacePose> { headTilt?: number; headDown?: number; headTurn?: number; blink?: boolean }
const facialPresets: [string, string, string, FacialPreset][] = [
  ['face-neutral', 'Neutral face', 'Neutral eyes, a relaxed jaw and occasional blinks.', {}],
  ['face-fear', 'Fear', 'Wide eyes, raised brows and opening breath.', { eyes: 1.13, browAngle: -.55, browRaise: .65, mouthOpen: .34 }],
  ['face-angry', 'Angry', 'Lower brows and a fixed jaw.', { browAngle: .85, frown: .28, mouthOpen: .08, eyes: .73 }],
  ['face-shock', 'Shock', 'A quick intake of breath, wide eyes and raised brows.', { eyes: 1.3, browAngle: -.4, browRaise: 1, mouthOpen: .64 }],
  ['face-sad', 'Sad', 'A lowered gaze and a small frown.', { eyes: .43, browAngle: -.55, frown: .65, headDown: 9 }],
  ['face-crying', 'Crying', 'Closed, tense eyes with a trembling mouth.', { eyes: .07, browAngle: -.8, frown: .83, mouthOpen: .19, headDown: 13 }],
  ['face-confused', 'Confused', 'A slight head tilt with an uneven, searching gaze.', { eyes: .65, browAngle: .1, browRaise: .65, eyeShift: .3, headTilt: 12, headTurn: -8 }],
  ['face-possessed', 'Possessed face', 'Glazed eyes and a slack mouth, with almost no blinking.', { eyes: .2, mouthOpen: .46, browRaise: -.3, blink: false, headTilt: -8 }],
  ['face-dead-eyes', 'Dead eyes', 'Open, unfocused eyes and a slack expression.', { eyes: 1, mouthOpen: .07, blink: false }],
  ['face-wide-eyes', 'Wide-eyed realization', 'The face registers something before the body moves.', { eyes: 1.25, browAngle: -.6, browRaise: .8, mouthOpen: .22 }],
  ['face-scream', 'Mouth open scream', 'A sustained, open mouth for a scream reaction.', { eyes: 1.15, browAngle: -.65, browRaise: .9, mouthOpen: .98, headDown: -8 }],
  ['face-evil-smile', 'Evil smile', 'A restrained smile, lowered brows and an unsteady gaze.', { smile: .95, browAngle: .5, eyes: .63, eyeShift: -.14, headTilt: 7, blink: false }],
]
const poseHeadTilt = (preset: FacialPreset) => preset.headTilt ?? 0
const faces = facialPresets.map(([id, name, summary, preset], index) => entry({
  id, name, category: 'Face', duration: 4.2 + index * .13, summary,
  pose: u => ({ q: { head: [preset.headDown ?? 0, preset.headTurn ?? 0, poseHeadTilt(preset)] }, face: { mouthOpen: preset.mouthOpen ?? Math.max(0, sine(u)) * .035, smile: preset.smile ?? 0, frown: preset.frown ?? 0, eyes: preset.eyes ?? .65, browAngle: preset.browAngle ?? 0, browRaise: preset.browRaise ?? 0, eyeShift: preset.eyeShift ?? 0 }, blink: preset.blink ?? true }),
}))

export const LIBRARY_DEFINITIONS: readonly AnimationDefinition[] = [...imported, ...idles, ...locomotion, ...reactions, ...creatures, ...survival, ...interactions, ...faces]
export const DEFAULT_LIBRARY_SETTINGS: AuthoringSettings = { speed: 1, strength: 1, mirror: false }

/** All authored motion is sampled into ordinary joint tracks; nothing runs from wall time. */
export function bakeAuthoredMotion(definition: AnimationDefinition, settings: AuthoringSettings = DEFAULT_LIBRARY_SETTINGS): CharacterClip {
  if (!definition.pose) throw new Error('An authored motion recipe is required')
  const rig = createCharacterRig(), frames = Math.max(2, Math.ceil(definition.duration * 30) + 1)
  const tracks: CharacterClip['tracks'] = {}, face: CharacterClip['face'] = {}
  let faceHead: Vec3 | undefined
  for (const name of Object.keys(rig.bones)) tracks[name] = { rotation: [], position: [] }
  const euler = new THREE.Euler()
  for (let frame = 0; frame < frames; frame++) {
    const u = frame / (frames - 1), pose = definition.pose(u)
    if (definition.category === 'Face' && pose.q?.head) faceHead = pose.q.head.map(value => value * THREE.MathUtils.DEG2RAD) as Vec3
    for (const [name, bone] of Object.entries(rig.bones)) {
      bone.position.copy(rig.rest[name].position)
      if (name !== 'hips' && pose.q?.[name]) bone.quaternion.setFromEuler(euler.set(...pose.q[name].map(v => v * THREE.MathUtils.DEG2RAD) as Vec3))
      else bone.quaternion.copy(rig.rest[name].quaternion)
    }
    rig.bones.hips.position.add(new THREE.Vector3(...(pose.hips ?? [0, 0, 0])))
    if (pose.q?.hips) rig.bones.hips.quaternion.setFromEuler(euler.set(...pose.q.hips.map(v => v * THREE.MathUtils.DEG2RAD) as Vec3))
    for (const [name, bone] of Object.entries(rig.bones)) bone.quaternion.slerp(rig.rest[name].quaternion, 1 - settings.strength)
    if (pose.gait) {
      const g = pose.gait, stride = g.stride * settings.strength, length = rig.bones.leftKnee.position.length() + rig.bones.leftAnkle.position.length() - .009
      const phase = u + (g.phase ?? 0), amplitude = g.side ? Math.abs(Math.sin(phase * theta)) * .018 : Math.abs(Math.cos(phase * theta)) * .018
      rig.bones.hips.position.y = .94 - g.sink * settings.strength + amplitude
      let farthest = 0
      const targets: THREE.Vector3[] = []
      for (const side of ['left', 'right'] as const) {
        const sign = side === 'left' ? 1 : -1, cycle = ((phase + (side === 'right' ? .5 : 0)) % 1 + 1) % 1
        let travel, lift = 0
        if (cycle < .60) travel = 1 - 2 * cycle / .60
        else { const progress = (cycle - .60) / .40; travel = -1 + 2 * smooth(progress); lift = Math.sin(progress * Math.PI) * g.lift * settings.strength }
        let displacement = stride * travel * (1 + (side === 'left' ? 1 : -1) * (g.asymmetry ?? 0))
        if (g.backwards) displacement *= -1
        const x = sign * .085 + (g.side ?? 0) * displacement, z = g.side ? 0 : displacement
        const target = new THREE.Vector3(x, .08 + lift, z)
        farthest = Math.max(farthest, Math.hypot(x - sign * .085, z))
        targets.push(target)
      }
      rig.bones.hips.position.y = Math.min(rig.bones.hips.position.y, Math.sqrt(Math.max(.01, length * length - farthest * farthest)) + .08)
      rig.group.updateMatrixWorld(true)
      for (const [index, side] of (['left', 'right'] as const).entries()) {
        rig.bones[`${side}Ankle`].rotation.x = sine(phase + index * .5) * .025
        solveTwoBone(rig.bones[`${side}Hip`], rig.bones[`${side}Knee`], rig.bones[`${side}Ankle`], rig.bones.root.localToWorld(targets[index]), rig.bones.root.localToWorld(new THREE.Vector3(index === 0 ? .1 : -.1, .5, .8)))
      }
    }
    rig.group.updateMatrixWorld(true)
    for (const side of ['left', 'right'] as const) {
      const target = pose.hands?.[side]
      if (!target) continue
      const rest = rig.bones[`${side}Wrist`].getWorldPosition(new THREE.Vector3())
      const there = rest.lerp(rig.bones.root.localToWorld(new THREE.Vector3(...target)), settings.strength)
      const pole = rig.bones.root.localToWorld(new THREE.Vector3(side === 'left' ? .65 : -.65, 1.08, -.42))
      solveTwoBone(rig.bones[`${side}Shoulder`], rig.bones[`${side}Elbow`], rig.bones[`${side}Wrist`], there, pole)
    }
    const f: FacePose = { mouthOpen: 0, smile: 0, frown: 0, eyes: .65, browAngle: 0, browRaise: 0, eyeShift: 0, ...pose.face }
    if (pose.blink !== false && definition.category !== 'Face') f.eyes *= 1 - blink(u) * .94
    if (definition.category === 'Face' && pose.blink !== false) f.eyes *= 1 - blink(u) * .94
    for (const channel of Object.keys(f) as FacialChannel[]) (face[channel] ??= []).push({ t: u * definition.duration, v: f[channel] })
    rig.group.updateMatrixWorld(true)
    rig.skinned.computeBoundingBox()
    const lowest = rig.skinned.boundingBox?.min.y ?? 0
    if (lowest < .015) { rig.bones.hips.position.y += .015 - lowest; rig.group.updateMatrixWorld(true); rig.skinned.computeBoundingBox() }
    for (const [name, bone] of Object.entries(rig.bones)) {
      tracks[name].rotation!.push({ t: u * definition.duration, q: bone.quaternion.toArray() })
      tracks[name].position!.push({ t: u * definition.duration, v: bone.position.toArray() })
    }
  }
  const clip: CharacterClip = {
    id: `library:${definition.id}`, name: definition.name, duration: definition.duration, loop: definition.loop,
    motion: { ...DEFAULT_MOTION, speed: 0, breathing: 'still', gaze: 'forward', groundContact: false }, tracks, targets: {}, face, faceHead,
  }
  rig.dispose()
  return clip
}
