import { CharacterController } from './controller.ts'
import { createCharacterRig, type CharacterLook } from './rig.ts'
import type { CharacterMotion } from './types.ts'

export function createCharacter(options: { look?: CharacterLook; motion?: Partial<CharacterMotion> } = {}) {
  return new CharacterController(createCharacterRig(options.look), options.motion)
}

export { CharacterController } from './controller.ts'
export { AnimationLibrary, CharacterAnimation, ANIMATION_STATES, SOURCE_ANIMATION_URL } from './library.ts'
export { LIBRARY_DEFINITIONS } from './motion-pack.ts'
export { exportCharacterGLB, exportAnimationPackGLB } from './export.ts'
export type { AnimationCategory, AnimationDefinition, AuthoringSettings } from './motion-pack.ts'
export { retargetCharacterClip } from './retarget.ts'
export { createCharacterRig } from './rig.ts'
export type { CharacterRig, CharacterLook, RigFace } from './rig.ts'
export { DEFAULT_MOTION, putPositionKey, putRotationKey, validClip, validMotion } from './types.ts'
export type { AnimationContext, BoneTrack, CharacterClip, CharacterMotion, IKTarget, PositionKey, QuaternionValue, RotationKey, Vec3 } from './types.ts'
export { EXPRESSION_PRESETS, FACE_RANGES, NEUTRAL_FACE, PRESET_GROUPS, sampleSequence, validFaceSettings } from './facial.ts'
export type { ExpressionEvent, FaceAdapter, FacePose, FaceSettings, FaceSpeech, PresetName } from './facial.ts'
export { createVRMAdapter, createMorphAdapter, createFaceAdapter } from './adapters.ts'
export { VISEME_SHAPES, fromRhubarbJSON, fromLighterKeyframes, sampleTimeline, validTimeline } from './lipsync.ts'
export type { LipSyncTimeline, SavedSpeech, TalkingMode, VisemeCue, VisemeShape } from './lipsync.ts'


