import * as THREE from 'three'
import { createCharacterRig, type CharacterRig } from './rig.ts'
import { DEFAULT_MOTION } from './types.ts'
import { solveTwoBone } from './pose.ts'
import type { CharacterClip } from './types.ts'

const ALIASES: Record<string, string[]> = {
  hips: ['pelvis', 'hips'], spine: ['spine_01', 'spine'], chest: ['spine_02', 'spine_03', 'chest'],
  neck: ['neck_01', 'neck'], head: ['Head', 'head'], headTip: ['head_leaf', 'head_top'],
  leftShoulder: ['upperarm_l', 'leftarm'], leftElbow: ['lowerarm_l', 'leftforearm'], leftWrist: ['hand_l', 'lefthand'],
  rightShoulder: ['upperarm_r', 'rightarm'], rightElbow: ['lowerarm_r', 'rightforearm'], rightWrist: ['hand_r', 'righthand'],
  leftHip: ['thigh_l', 'leftupleg'], leftKnee: ['calf_l', 'leftleg'], leftAnkle: ['foot_l', 'leftfoot'], leftToe: ['ball_l', 'lefttoebase'],
  rightHip: ['thigh_r', 'rightupleg'], rightKnee: ['calf_r', 'rightleg'], rightAnkle: ['foot_r', 'rightfoot'], rightToe: ['ball_r', 'righttoebase'],
  leftFinger: ['middle_01_l', 'lefthandindex1'], rightFinger: ['middle_01_r', 'righthandindex1'],
}
const normal = (name: string) => name.toLowerCase().replace(/^mixamorig:?/, '').replace(/[^a-z0-9]/g, '')

export function jointMap(source: THREE.Object3D): Map<string, THREE.Object3D> {
  const byName = new Map<string, THREE.Object3D>()
  source.traverse(node => {
    const key = normal(node.name)
    if (!byName.has(key)) byName.set(key, node)
  })
  const output = new Map<string, THREE.Object3D>()
  for (const [part, variants] of Object.entries(ALIASES)) {
    for (const variant of variants) {
      const node = byName.get(normal(variant))
      if (node) { output.set(part, node); break }
    }
  }
  return output
}

const CHAIN: [string, string, string][] = [
  ['spine', 'chest', 'spine'], ['chest', 'neck', 'chest'], ['neck', 'head', 'neck'],
  ['leftShoulder', 'leftElbow', 'leftElbow'], ['leftElbow', 'leftWrist', 'leftWrist'],
  ['rightShoulder', 'rightElbow', 'rightElbow'], ['rightElbow', 'rightWrist', 'rightWrist'],
  ['leftHip', 'leftKnee', 'leftKnee'], ['leftKnee', 'leftAnkle', 'leftAnkle'],
  ['rightHip', 'rightKnee', 'rightKnee'], ['rightKnee', 'rightAnkle', 'rightAnkle'],
  ['leftAnkle', 'leftToe', 'leftAnkle'], ['rightAnkle', 'rightToe', 'rightAnkle'],
  ['leftWrist', 'leftFinger', 'leftWrist'], ['rightWrist', 'rightFinger', 'rightWrist'],
]

interface RetargetOptions {
  target?: CharacterRig
  inPlace?: boolean
  loop?: boolean
  id?: string
  name?: string
}

/** Maps measured world-space joint directions, rather than assuming source and target bone axes agree. */
export function retargetCharacterClip(source: THREE.Object3D, input: THREE.AnimationClip, options: RetargetOptions = {}): CharacterClip {
  if (!Number.isFinite(input.duration) || input.duration <= 0 || input.duration > 120) throw new Error('Animation duration must be between 0 and 120 seconds')
  const rig = options.target ?? createCharacterRig(), joints = jointMap(source)
  const missing = ['hips', 'spine', 'chest', 'neck', 'head', 'leftShoulder', 'leftElbow', 'leftWrist', 'rightShoulder', 'rightElbow', 'rightWrist', 'leftHip', 'leftKnee', 'leftAnkle', 'rightHip', 'rightKnee', 'rightAnkle'].filter(name => !joints.has(name))
  if (missing.length) throw new Error(`Unsupported humanoid skeleton: ${missing.join(', ')}`)
  source.updateMatrixWorld(true)
  const restHipHeight = joints.get('hips')!.getWorldPosition(new THREE.Vector3()).y
  const mixer = new THREE.AnimationMixer(source), action = mixer.clipAction(input)
  if (options.loop === false) { action.setLoop(THREE.LoopOnce, 0); action.clampWhenFinished = true }
  action.play()
  const frames = Math.max(2, Math.ceil(input.duration * 30) + 1), inPlace = options.inPlace ?? true
  const world = new Map<string, THREE.Vector3>(), tracks: CharacterClip['tracks'] = {}
  const sourceHips: THREE.Vector3[] = [], floorSamples: number[] = []
  const p = (part: string) => world.get(part)!
  const snapshot = (time: number) => {
    mixer.setTime(time)
    source.updateMatrixWorld(true)
    for (const name of ['hips', 'leftAnkle', 'rightAnkle']) {
      const position = joints.get(name)!.getWorldPosition(new THREE.Vector3())
      if (!Number.isFinite(position.x + position.y + position.z)) throw new Error('Animation contains invalid joint positions')
      world.set(name, position)
    }
  }
  for (let i = 0; i < frames; i++) {
    snapshot(input.duration * i / (frames - 1))
    sourceHips.push(world.get('hips')!.clone())
    floorSamples.push(Math.min(world.get('leftAnkle')!.y, world.get('rightAnkle')!.y))
  }
  const hipHeight = restHipHeight
  if (hipHeight < 0.01) throw new Error('Could not measure the bind-pose hip height')
  const scale = rig.rest.hips.position.y / hipHeight
  const floor = Math.min(...floorSamples) * scale, shift = inPlace ? 0.08 - floor : 0
  for (const [name, bone] of Object.entries(rig.bones)) {
    bone.position.copy(rig.rest[name].position)
    bone.quaternion.copy(rig.rest[name].quaternion)
    tracks[name] = { rotation: [], position: [] }
  }
  const up = new THREE.Vector3(), right = new THREE.Vector3(), forward = new THREE.Vector3()
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scratch = new THREE.Quaternion()
  const aim = (part: string, tip: string | undefined, target: string) => {
    const bone = rig.bones[target]
    const targetDirection = target.endsWith('Ankle') ? new THREE.Vector3(0, 0, 1)
      : target.endsWith('Wrist') ? new THREE.Vector3(0, -1, 0)
      : target === 'head' ? new THREE.Vector3(0, 1, 0)
      : rig.bones[tip ?? '']?.position.clone().normalize()
    const direction = tip && joints.has(tip) ? p(tip).clone().sub(p(part)) : undefined
    if (!targetDirection || !direction || direction.lengthSq() < 1e-8) return
    targetDirection.applyQuaternion(bone.parent!.getWorldQuaternion(new THREE.Quaternion())).normalize()
    direction.normalize()
    const parent = bone.parent!.getWorldQuaternion(scratch)
    const wanted = rotation.setFromUnitVectors(targetDirection, direction).multiply(parent)
    bone.quaternion.copy(parent.clone().invert().multiply(wanted)).normalize()
    rig.group.updateMatrixWorld(true)
  }
  for (let frame = 0; frame < frames; frame++) {
    const time = input.duration * frame / (frames - 1), phase = frame / (frames - 1)
    mixer.setTime(time)
    source.updateMatrixWorld(true)
    for (const [name, joint] of joints) world.set(name, joint.getWorldPosition(new THREE.Vector3()))
    up.copy(p('spine')).sub(p('hips')).normalize()
    right.copy(p('leftHip')).sub(p('rightHip')).addScaledVector(up, -p('leftHip').clone().sub(p('rightHip')).dot(up)).normalize()
    if (!Number.isFinite(right.lengthSq()) || right.lengthSq() < 0.5) right.set(1, 0, 0).addScaledVector(up, -up.x).normalize()
    forward.copy(right).cross(up).normalize()
    rig.bones.hips.quaternion.copy(rotation.setFromRotationMatrix(matrix.makeBasis(right, up, forward))).normalize()
    rig.bones.hips.position.copy(sourceHips[frame]).multiplyScalar(scale)
    if (inPlace) {
      rig.bones.hips.position.x -= THREE.MathUtils.lerp(sourceHips[0].x, sourceHips.at(-1)!.x, phase) * scale
      rig.bones.hips.position.z -= THREE.MathUtils.lerp(sourceHips[0].z, sourceHips.at(-1)!.z, phase) * scale
    }
    rig.bones.hips.position.y += shift
    for (const [part, tip, target] of CHAIN) if (joints.has(part)) aim(part, tip, target)
    rig.group.updateMatrixWorld(true)
    if (inPlace) for (const side of ['left', 'right'] as const) {
      const legScale = (rig.bones[`${side}Knee`].position.length() + rig.bones[`${side}Ankle`].position.length()) / (joints.get(`${side}Knee`)!.position.length() + joints.get(`${side}Ankle`)!.position.length())
      const hip = rig.bones.hips.getWorldPosition(new THREE.Vector3())
      const anchor = p(`${side}Ankle`).clone().sub(sourceHips[frame]).multiplyScalar(legScale).add(hip)
      const knee = p(`${side}Knee`).clone().sub(sourceHips[frame]).multiplyScalar(legScale).add(hip)
      solveTwoBone(rig.bones[`${side}Hip`], rig.bones[`${side}Knee`], rig.bones[`${side}Ankle`], anchor, knee)
      rig.group.updateMatrixWorld(true)
      aim(`${side}Ankle`, `${side}Toe`, `${side}Ankle`)
    }
    rig.group.updateMatrixWorld(true)
    rig.skinned.computeBoundingBox()
    const lowest = rig.bones.root.worldToLocal(rig.skinned.boundingBox.min.clone()).y
    if (lowest < .025) { rig.bones.hips.position.y += .025 - lowest; rig.group.updateMatrixWorld(true) }
    for (const [name, bone] of Object.entries(rig.bones)) {
      if (!Number.isFinite(bone.quaternion.x + bone.quaternion.y + bone.quaternion.z + bone.quaternion.w + bone.position.x + bone.position.y + bone.position.z)) throw new Error('Retargeting produced invalid transforms')
      tracks[name].rotation!.push({ t: time, q: bone.quaternion.toArray() })
      tracks[name].position!.push({ t: time, v: bone.position.toArray() })
    }
  }
  mixer.uncacheClip(input)
  return {
    id: options.id ?? input.name, name: options.name ?? input.name, duration: input.duration,
    motion: { ...DEFAULT_MOTION, speed: 0, breathing: 'normal', groundContact: false, gaze: 'forward' },
    tracks, targets: {},
  }
}
