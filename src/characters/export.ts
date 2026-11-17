import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { CharacterController } from './controller.ts'
import type { CharacterRig } from './rig.ts'
import type { AnimationContext, CharacterClip } from './types.ts'
import { documentToAnimationClip } from './library.ts'

function clonedRig(rig: CharacterRig): CharacterRig {
  const group = cloneSkeleton(rig.group) as THREE.Group
  const skinned = group.getObjectByName(rig.skinned.name) as THREE.SkinnedMesh
  const bones = Object.fromEntries(Object.entries(rig.bones).map(([name]) => [name, group.getObjectByName(name) as THREE.Bone]))
  const cloneFace = (source: THREE.Object3D[]) => source.map((node) => group.getObjectByName(node.name) as THREE.Mesh)
  return {
    ...rig, group, skinned, skeleton: skinned.skeleton, bones,
    face: { ...rig.face, mouth: cloneFace([rig.face.mouth])[0], eyes: cloneFace(rig.face.eyes) as CharacterRig['face']['eyes'], brows: cloneFace(rig.face.brows) as CharacterRig['face']['brows'] },
    animationNodes: cloneFace(rig.animationNodes),
  }
}

export interface BakedCharacter {
  scene: THREE.Group
  clip: THREE.AnimationClip
}

/** Samples at one fixed rate; no wall time, randomness, mixer state or renderer timing enters the clip. */
export function bakeCharacterClip(rig: CharacterRig, clip: CharacterClip, context: AnimationContext = {}): BakedCharacter {
  const work = clonedRig(rig)
  const controller = new CharacterController(work)
  const frames = Math.ceil(clip.duration * 30)
  const times = Array.from({ length: frames + 1 }, (_, i) => i * clip.duration / frames)
  const boneValues = Object.keys(work.bones).map(() => ({ rotation: [] as number[], position: [] as number[] }))
  const morph: Record<string, number[]> = {}
  for (const name of Object.keys(work.face.mouth.morphTargetDictionary ?? {})) morph[name] = []
  const facial = { eyes: work.face.eyes.map(() => ({ scale: [] as number[], position: [] as number[] })), brows: work.face.brows.map(() => ({ rotation: [] as number[], position: [] as number[] })) }
  for (const t of times) {
    controller.update(t, { ...context, clip, clipTime: t, transitionSeconds: 0 })
    Object.values(work.bones).forEach((bone, i) => {
      boneValues[i].rotation.push(...bone.quaternion.toArray())
      boneValues[i].position.push(...bone.position.toArray())
    })
    for (const [name, index] of Object.entries(work.face.mouth.morphTargetDictionary ?? {})) morph[name].push(work.face.mouth.morphTargetInfluences![index])
    work.face.brows.forEach((brow, i) => {
      facial.brows[i].rotation.push(...brow.quaternion.toArray())
      facial.brows[i].position.push(...brow.position.toArray())
    })
    work.face.eyes.forEach((eye, i) => {
      facial.eyes[i].scale.push(...eye.scale.toArray())
      facial.eyes[i].position.push(...eye.position.toArray())
    })
  }
  const tracks = Object.values(work.bones).flatMap((bone, i) => [
    new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, boneValues[i].rotation),
    new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, boneValues[i].position),
  ])
  Object.entries(morph).forEach(([name, values]) => tracks.push(new THREE.NumberKeyframeTrack(`mouth.morphTargetInfluences[${name}]`, times, values)))
  work.face.brows.forEach((brow, i) => {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${brow.name}.quaternion`, times, facial.brows[i].rotation))
    tracks.push(new THREE.VectorKeyframeTrack(`${brow.name}.position`, times, facial.brows[i].position))
  })
  work.face.eyes.forEach((eye, i) => {
    tracks.push(new THREE.VectorKeyframeTrack(`${eye.name}.scale`, times, facial.eyes[i].scale))
    tracks.push(new THREE.VectorKeyframeTrack(`${eye.name}.position`, times, facial.eyes[i].position))
  })
  controller.update(0, { ...context, clip, clipTime: 0, transitionSeconds: 0 })
  return { scene: work.group, clip: new THREE.AnimationClip(clip.name, -1, tracks) }
}

export function saveData(data: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name.replace(/[^\w.-]/g, '_')
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportCharacterGLB(rig: CharacterRig, clip: CharacterClip, context: AnimationContext = {}): Promise<ArrayBuffer> {
  const baked = bakeCharacterClip(rig, clip, context)
  baked.scene.getObjectByName('characterEditorTargets')?.removeFromParent()
  const result = await new GLTFExporter().parseAsync(baked.scene, { binary: true, animations: [baked.clip], onlyVisible: false })
  if (!(result instanceof ArrayBuffer)) throw new Error('GLB export did not produce binary data')
  return result
}

export async function exportAnimationPackGLB(rig: CharacterRig, clips: CharacterClip[]): Promise<ArrayBuffer> {
  if (!clips.length) throw new Error('Choose at least one animation')
  if (new Set(clips.map(clip => clip.name)).size !== clips.length) throw new Error('Animation names must be unique')
  const work = clonedRig(rig)
  work.group.getObjectByName('characterEditorTargets')?.removeFromParent()
  for (const [name, pose] of Object.entries(rig.rest)) {
    const bone = work.bones[name]
    bone.position.copy(pose.position)
    bone.quaternion.copy(pose.quaternion)
  }
  const result = await new GLTFExporter().parseAsync(work.group, { binary: true, animations: clips.map(clip => documentToAnimationClip(rig, clip)), onlyVisible: false })
  if (!(result instanceof ArrayBuffer)) throw new Error('Animation pack export did not produce binary data')
  return result
}
