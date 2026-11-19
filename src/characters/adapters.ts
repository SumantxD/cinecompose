import * as THREE from 'three'
import type { CharacterRig } from './rig.ts'

const X_AXIS = new THREE.Vector3(1, 0, 0), Z_AXIS = new THREE.Vector3(0, 0, 1)
import { createProceduralFaceAdapter, type FacialRig } from './face.ts'
import type { FaceAdapter, FacePose } from './facial.ts'

type MorphBinding = { node: THREE.Mesh; indices: number[]; weight: (pose: FacePose) => number }
interface VRMLike { expressionManager?: { setValue: (name: string, value: number) => void; getExpression?: (name: string) => unknown } }
export interface FaceAdapterOptions { vrm?: VRMLike; procedural?: FacialRig }

const clamp = THREE.MathUtils.clamp

export function createVRMAdapter(vrm: VRMLike): FaceAdapter {
  const manager = vrm.expressionManager
  const set = (name: string, value: number) => {
    if (!manager || manager.getExpression && !manager.getExpression(name)) return
    manager.setValue(name, clamp(value, 0, 1))
  }
  return {
    kind: 'vrm',
    apply(pose) {
      const left = pose.eyeAsymmetry < 0 ? 1 + pose.eyeAsymmetry * .35 : 1
      const right = pose.eyeAsymmetry > 0 ? 1 - pose.eyeAsymmetry * .35 : 1
      set('blinkLeft', 1 - clamp(pose.eyeOpen * left, 0, 1))
      set('blinkRight', 1 - clamp(pose.eyeOpen * right, 0, 1))
      set('blink', 1 - clamp(pose.eyeOpen, 0, 1))
      set('aa', pose.mouthOpen)
      set('ih', clamp(pose.mouthWidth + pose.mouthOpen * .25, 0, 1))
      set('ou', pose.mouthRound)
      set('ee', pose.mouthWidth)
      set('oh', pose.mouthRound * pose.mouthOpen)
      set('happy', pose.smile)
      set('joy', pose.smile)
      set('sad', pose.frown)
      set('sorrow', pose.frown)
      set('angry', Math.max(0, pose.browAngle))
      set('relaxed', Math.max(0, -pose.frown))
      set('lookUp', Math.max(0, pose.pupilY))
      set('lookDown', Math.max(0, -pose.pupilY))
      set('lookLeft', Math.max(0, -pose.pupilX))
      set('lookRight', Math.max(0, pose.pupilX))
    },
  }
}

const MORPH_ALIASES: { names: string[]; weight: (pose: FacePose) => number }[] = [
  { names: ['eyeBlinkLeft', 'eyeBlink_L'], weight: p => 1 - clamp(p.eyeOpen * (p.eyeAsymmetry < 0 ? 1 + p.eyeAsymmetry * .35 : 1), 0, 1) },
  { names: ['eyeBlinkRight', 'eyeBlink_R'], weight: p => 1 - clamp(p.eyeOpen * (p.eyeAsymmetry > 0 ? 1 - p.eyeAsymmetry * .35 : 1), 0, 1) },
  { names: ['eyeWideLeft', 'eyeWide_L'], weight: p => Math.max(0, p.eyeOpen - 1) },
  { names: ['eyeWideRight', 'eyeWide_R'], weight: p => Math.max(0, p.eyeOpen - 1) },
  { names: ['browOuterUpLeft', 'browRaiseLeft', 'browUp_L'], weight: p => Math.max(0, p.browRaise) / 1.8 },
  { names: ['browOuterUpRight', 'browRaiseRight', 'browUp_R'], weight: p => Math.max(0, p.browRaise) / 1.8 },
  { names: ['browDownLeft', 'browDown_L'], weight: p => Math.max(0, -p.browRaise + p.browAsymmetry) / 1.8 },
  { names: ['browDownRight', 'browDown_R'], weight: p => Math.max(0, -p.browRaise - p.browAsymmetry) / 1.8 },
  { names: ['browInnerUp', 'browInnerUpLeft', 'browInnerUpRight'], weight: p => Math.min(1, Math.max(0, p.browRaise / 1.8 + p.browAsymmetry * .2)) },
  { names: ['jawOpen', 'mouthOpen'], weight: p => p.mouthOpen },
  { names: ['mouthSmileLeft', 'mouthSmile_L'], weight: p => p.smile * (1 + Math.max(0, p.smileAsymmetry) * .3) },
  { names: ['mouthSmileRight', 'mouthSmile_R'], weight: p => p.smile * (1 + Math.max(0, -p.smileAsymmetry) * .3) },
  { names: ['mouthFrownLeft', 'mouthFrown_L'], weight: p => p.frown },
  { names: ['mouthFrownRight', 'mouthFrown_R'], weight: p => p.frown },
  { names: ['mouthStretchLeft', 'mouthStretch_L'], weight: p => Math.max(0, p.mouthWidth) },
  { names: ['mouthStretchRight', 'mouthStretch_R'], weight: p => Math.max(0, p.mouthWidth) },
  { names: ['mouthPucker', 'mouthFunnel'], weight: p => p.mouthRound },
  { names: ['mouthPressLeft', 'mouthPressRight', 'lipCompression'], weight: p => Math.max(0, -p.mouthWidth) },
  { names: ['cheekPuff', 'cheekPuffLeft', 'cheekPuffRight'], weight: p => p.cheeks },
  { names: ['noseSneerLeft', 'noseSneerRight', 'noseScrunch'], weight: p => p.nose },
  { names: ['tongueOut'], weight: p => p.tongue },
  { names: ['eyeLookInLeft', 'eyeLookOutRight'], weight: p => Math.max(0, p.pupilX) },
  { names: ['eyeLookOutLeft', 'eyeLookInRight'], weight: p => Math.max(0, -p.pupilX) },
  { names: ['eyeLookUpLeft', 'eyeLookUpRight'], weight: p => Math.max(0, p.pupilY) },
  { names: ['eyeLookDownLeft', 'eyeLookDownRight'], weight: p => Math.max(0, -p.pupilY) },
  { names: ['viseme_sil'], weight: p => 1 - Math.min(1, p.mouthOpen * 5) },
  { names: ['viseme_aa'], weight: p => p.mouthOpen },
  { names: ['viseme_ou', 'viseme_O', 'viseme_OO'], weight: p => p.mouthRound },
  { names: ['viseme_E', 'viseme_I'], weight: p => Math.max(0, p.mouthWidth) },
  { names: ['viseme_PP', 'viseme_MB', 'viseme_MBP'], weight: p => 1 - Math.min(1, p.mouthOpen * 6) },
]

export function createMorphAdapter(root: THREE.Object3D): FaceAdapter {
  const bindings: MorphBinding[] = []
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || !node.morphTargetInfluences) return
    const dictionary = node.morphTargetDictionary
    if (!dictionary) return
    for (const alias of MORPH_ALIASES) {
      const channels = alias.names.flatMap(name => dictionary[name] === undefined ? [] : [dictionary[name]])
      if (channels.length) bindings.push({ node, indices: channels, weight: alias.weight })
    }
  })
  const nodes = [...new Set(bindings.map(binding => binding.node))]
  const initial = nodes.map(node => [...node.morphTargetInfluences!])
  const head = root.getObjectByName('head'), jaw = root.getObjectByName('jaw')
  const headRest = head?.quaternion.clone(), jawRest = jaw?.quaternion.clone(), boneRotation = new THREE.Quaternion()
  const eyeBones: { node: THREE.Object3D; scale: THREE.Vector3 }[] = []
  root.traverse(node => {
    if (/^(left|right)?_?eye$/i.test(node.name)) eyeBones.push({ node, scale: node.scale.clone() })
  })
  return {
    kind: bindings.length || eyeBones.length ? 'morph' : 'none',
    apply(pose) {
      for (const binding of bindings) for (const index of binding.indices) binding.node.morphTargetInfluences![index] = clamp(binding.weight(pose), 0, 1)
      for (const bone of eyeBones) bone.node.scale.copy(bone.scale).multiplyScalar(pose.eyeWide)
      if (jaw) jaw.quaternion.copy(jawRest!).multiply(boneRotation.setFromAxisAngle(X_AXIS, pose.mouthOpen * .38))
      if (head) head.quaternion.copy(headRest!).multiply(boneRotation.setFromAxisAngle(Z_AXIS, pose.headTilt * -.22))
    },
    dispose() { nodes.forEach((node, index) => { node.morphTargetInfluences = [...initial[index]] }) },
  }
}

export function createFaceAdapter(target: CharacterRig | THREE.Object3D | { rig: CharacterRig }, options: FaceAdapterOptions = {}): FaceAdapter {
  const rig = target instanceof THREE.Object3D ? undefined : 'rig' in target ? target.rig : target
  if (options.vrm || (target as VRMLike).expressionManager) return createVRMAdapter(options.vrm ?? target as VRMLike)
  if (options.procedural || rig?.face?.group) return createProceduralFaceAdapter(options.procedural ?? rig!.face as FacialRig)
  const root = rig?.group ?? target as THREE.Object3D
  return createMorphAdapter(root)
}
