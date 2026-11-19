import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { jointMap } from '../src/characters/retarget.ts'
import { CharacterController } from '../src/characters/controller.ts'
import { AnimationLibrary, CharacterAnimation, documentToAnimationClip } from '../src/characters/library.ts'
import { LIBRARY_DEFINITIONS } from '../src/characters/motion-pack.ts'
import { createCharacterRig } from '../src/characters/rig.ts'
import { exportAnimationPackGLB } from '../src/characters/export.ts'
import { validClip, retimeClip, retimeFaceKeys } from '../src/characters/types.ts'

globalThis.FileReader ??= class {
  result = null
  onloadend = null
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.() }
}
const bytes = file => {
  const data = fs.readFileSync(file)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}
const source = await new GLTFLoader().parseAsync(bytes('public/animations/kaali-raat-cc0.glb'), '')
const metadata = JSON.parse(fs.readFileSync('public/animations/kaali-raat-cc0.meta.json', 'utf8'))
assert.equal(metadata.license, 'CC0-1.0')
assert.equal(source.animations.length, 35)
assert.equal(metadata.clips.length, 35)
assert.equal(new Set(LIBRARY_DEFINITIONS.map(entry => entry.id)).size, 135)
for (const clip of source.animations) {
  assert.ok(clip.duration > 0 && clip.duration <= 120)
  for (const track of clip.tracks) assert.ok(track.times.length && [...track.times, ...track.values].every(Number.isFinite), `${clip.name}: invalid source track`)
}
const library = new AnimationLibrary({ source: { root: source.scene, animations: source.animations } })
const poseDirection = (clip, a, b, fraction = .55) => {
  const sampleScene = source.scene.clone(true), joints = jointMap(sampleScene), mixer = new THREE.AnimationMixer(sampleScene)
  const action = mixer.clipAction(clip).play()
  action.time = clip.duration * fraction; mixer.update(0); sampleScene.updateMatrixWorld(true)
  const result = joints.get(b).getWorldPosition(new THREE.Vector3()).sub(joints.get(a).getWorldPosition(new THREE.Vector3())).normalize()
  mixer.uncacheClip(clip)
  return result
}
const targetPoseDirection = async (clip, a, b, fraction = .55) => {
  const rig = createCharacterRig(), controller = new CharacterController(rig, {}, library)
  controller.update(clip.duration * fraction, { clip, clipTime: clip.duration * fraction })
  const result = rig.bones[b].getWorldPosition(new THREE.Vector3()).sub(rig.bones[a].getWorldPosition(new THREE.Vector3())).normalize()
  rig.dispose()
  return result
}
for (const [id, a, b] of [['idle-arms-folded-waiting', 'leftElbow', 'leftWrist'], ['punch-cross-right-2', 'rightElbow', 'rightWrist'], ['death-fall-backwards', 'leftHip', 'leftKnee']]) {
  const clip = await library.getClip(id)
  const sourceName = LIBRARY_DEFINITIONS.find(entry => entry.id === id)?.sourceClip
  assert.ok(sourceName, `${id}: definition must name its source clip`)
  const sourceClip = source.animations.find(sample => sample.name === sourceName)
  assert.ok(sourceClip, `${id}: source clip must exist`)
  const expected = poseDirection(sourceClip, a, b)
  const actual = await targetPoseDirection(clip, a, b)
  assert.ok(expected.dot(actual) > .97, `${id}: ${a} to ${b} direction is not retargeted (${expected.dot(actual).toFixed(3)})`)
}
const dodge = await library.getClip('dodge-roll'), dodgeSource = source.animations.find(clip => clip.name === 'Dodge_roll')
assert.ok(dodgeSource)
const firstHip = dodge.tracks.hips.position[0].v, lastHip = dodge.tracks.hips.position.at(-1).v
assert.ok(Math.hypot(...lastHip.map((value, index) => value - firstHip[index])) > 1, 'Dodge Roll must preserve its final travel, not wrap to the opening pose')
assert.ok(poseDirection(dodgeSource, 'leftHip', 'leftKnee', 1).dot(await targetPoseDirection(dodge, 'leftHip', 'leftKnee', 1)) > .97, 'Dodge Roll final pose must match the source end pose')
const controller = new CharacterController(createCharacterRig(), {}, library)
const minima = [], seams = [], motions = new Map()
for (const definition of LIBRARY_DEFINITIONS) {
  const clip = await library.getClip(definition.id)
  assert.equal(validClip(clip), true, `${definition.id}: not a valid Character Lab clip`)
  assert.ok(clip.source && clip.source.id === definition.id)
  const signature = JSON.stringify({ tracks: clip.tracks, targets: clip.targets, face: clip.face, faceHead: clip.faceHead, motion: clip.motion })
  assert(!motions.has(signature), `${definition.id}: duplicate motion data with ${motions.get(signature)}`)
  motions.set(signature, definition.id)
  const sourceBefore = JSON.stringify(clip)
  for (const t of [0, clip.duration * .37, clip.duration]) {
    controller.update(t, { clip, clipTime: t, cameraPosition: new THREE.Vector3(0, 1.6, 4) })
    for (const bone of Object.values(controller.rig.bones)) {
      assert.ok([...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite), `${definition.id}: invalid transform`)
      assert.ok(Math.abs(bone.quaternion.length() - 1) < 1e-5, `${definition.id}: unnormalized rotation`)
    }
    controller.rig.skinned.computeBoundingBox()
    const bounds = controller.rig.skinned.boundingBox
    assert.ok(bounds.min.y > -.06, `${definition.id}: geometry penetrates the floor at ${t}: ${bounds.min.y}`)
    const heightLimit = definition.id.includes('climb') ? 3.25 : definition.id.includes('jump') ? 2.8 : 2.25
    assert.ok(bounds.max.y < heightLimit, `${definition.id}: implausible aerial pose at ${t}: ${bounds.max.y}`)
    minima.push({ id: definition.id, t, y: bounds.min.y, max: bounds.max.y })
  }
  assert.equal(JSON.stringify(clip), sourceBefore, `${definition.id}: playback mutated its clip`)
  if (['idle-defensive', 'survival-aim', 'interaction-listen-door'].includes(definition.id)) {
    controller.update(clip.duration * .2, { clip, clipTime: clip.duration * .2 })
    const before = controller.rig.bones.head.quaternion.clone()
    controller.update(clip.duration * .65, { clip, clipTime: clip.duration * .65 })
    assert.ok(before.angleTo(controller.rig.bones.head.quaternion) > 1e-3, `${definition.id}: restrained idle motion must not freeze`)
  }
  if (clip.loop) {
    let worstRatio = 1
    for (const [name, track] of Object.entries(clip.tracks)) {
      const keys = track.rotation
      if (!keys) continue
      assert.ok(keys.length > 1)
      let fastest = 0
      for (let i = 1; i < keys.length; i++) fastest = Math.max(fastest, new THREE.Quaternion(...keys[i - 1].q).angleTo(new THREE.Quaternion(...keys[i].q)) / (keys[i].t - keys[i - 1].t))
      const seamRate = new THREE.Quaternion(...keys.at(-2).q).angleTo(new THREE.Quaternion(...keys[0].q)) / (keys.at(-1).t - keys.at(-2).t)
      assert.ok(seamRate <= fastest * 1.05 + 1e-7, `${definition.id}/${name}: loop seam angular speed ${seamRate} exceeds normal ${fastest}`)
      if (fastest) worstRatio = Math.max(worstRatio, seamRate / fastest)
    }
    seams.push({ id: definition.id, ratio: worstRatio })
  }
}

for (const id of ['fear-startle', 'face-scream', 'creature-crawl']) {
  const a = await library.getClip(id, { speed: 1, mirror: false }), b = await library.getClip(id, { speed: 2, mirror: true })
  assert.notEqual(a, b)
  assert.equal(a.source.mirror, false)
  assert.equal(a.tracks.head.rotation[0].t, b.tracks.head.rotation[0].t)
  const left = a.tracks.leftShoulder.rotation[0].q, mirrored = b.tracks.rightShoulder.rotation[0].q
  assert.ok(Math.abs(left[1] + mirrored[1]) < 1e-10 && Math.abs(left[2] + mirrored[2]) < 1e-10, `${id}: mirror math`)
}
const walk = await library.getClip('walk-forwards', { speed: 2 })
const normalWalk = await library.getClip('walk-forwards')
assert.ok(Math.abs(walk.duration - normalWalk.duration / 2) < 1e-10)
const longFace = await library.getClip('idle-breathing')
const staleFace = { ...longFace, ...normalWalk, libraryId: normalWalk.source.id }
assert.equal(validClip(staleFace), false, 'The body-replacement regression must catch stale facial timing')
assert(validClip({ ...staleFace, face: normalWalk.face }), 'Body replacement explicitly clears optional facial data')
const neutralFace = await library.getClip('face-scream', { strength: 0 })
assert.ok(neutralFace.face.mouthOpen.every(key => Math.abs(key.v) < 1e-10))
await assert.rejects(library.getClip('missing-clip'), /Unknown animation/)

const facial = await library.getClip('face-confused')
const unretimedBody = await library.getClip('fear-startle')
const retimed = JSON.parse(JSON.stringify(unretimedBody))
retimed.face = structuredClone(facial.face)
retimeFaceKeys(retimed.face, retimed.duration / facial.duration)
assert(validClip(retimed), 'Facial keys must fit the saved body duration')
const lastFaceKey = facial.face.mouthOpen.at(-1)
assert(Math.abs(retimed.face.mouthOpen.at(-1).t - lastFaceKey.t * retimed.duration / facial.duration) < 1e-10)
assert.equal(JSON.stringify(unretimedBody), JSON.stringify(await library.getClip('fear-startle')), 'Face application must not mutate source clips')
retimeClip(retimed, 0.5)
assert(validClip(retimed), 'Duration edits must retime body, IK and facial keys')
for (const track of Object.values(retimed.tracks)) for (const keys of [track.rotation ?? [], track.position ?? []]) assert(keys.every(key => key.t <= 0.5))
assert.throws(() => retimeClip(retimed, 0), /Clip length/)
assert.throws(() => retimeClip(retimed, Infinity), /Clip length/)
controller.update(0.25, { clip: retimed, clipTime: 0.25, cameraPosition: new THREE.Vector3(0, 1.6, 4) })
assert(Object.values(controller.rig.bones).every(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite)))
retimed.faceHead = facial.faceHead
const facialPreview = new CharacterController(createCharacterRig(), {}, library)
const facialApplied = new CharacterController(createCharacterRig(), {}, library)
await facialPreview.setFace('face-confused', 0, 0, facial.duration / retimed.duration)
for (const t of [0.1, 0.45]) {
  facialPreview.update(t, { clip: retimed, clipTime: t })
  facialApplied.update(t, { clip: retimed, clipTime: t })
  assert(facialPreview.rig.bones.head.quaternion.angleTo(facialApplied.rig.bones.head.quaternion) < 1e-6)
  assert(facialPreview.rig.face.mouth.morphTargetInfluences.every((v, i) => Math.abs(v - facialApplied.rig.face.mouth.morphTargetInfluences[i]) < 1e-10), `Face application differs at ${t}: ${JSON.stringify({ preview: [...facialPreview.rig.face.mouth.morphTargetInfluences], applied: [...facialApplied.rig.face.mouth.morphTargetInfluences], duration: facial.duration })}`)
  facialPreview.rig.face.eyes.forEach((eye, i) => assert(eye.position.distanceTo(facialApplied.rig.face.eyes[i].position) < 1e-10))
}
facialPreview.rig.dispose()
facialApplied.rig.dispose()
const variant = await library.getClip('face-confused', { mirror: true })
assert(Math.abs(variant.faceHead[1] + facial.faceHead[1]) < 1e-10)
assert(Math.abs(variant.faceHead[2] + facial.faceHead[2]) < 1e-10)
const variationBody = JSON.parse(JSON.stringify(await library.getClip('idle-breathing')))
variationBody.face = structuredClone(variant.face)
retimeFaceKeys(variationBody.face, variationBody.duration / variant.duration)
variationBody.faceHead = variant.faceHead
const mirroredPreview = new CharacterController(createCharacterRig(), {}, library)
const mirroredApplied = new CharacterController(createCharacterRig(), {}, library)
await mirroredPreview.setFace('face-confused', 0, 0, variant.duration / variationBody.duration, { mirror: true })
for (const t of [0.1, 2.7]) {
  mirroredPreview.update(t, { clip: variationBody, clipTime: t })
  mirroredApplied.update(t, { clip: variationBody, clipTime: t })
  assert(mirroredPreview.rig.bones.head.quaternion.angleTo(mirroredApplied.rig.bones.head.quaternion) < 1e-6, 'Mirrored face preview and application must share the head pose')
  assert(mirroredPreview.rig.face.mouth.morphTargetInfluences.every((v, i) => Math.abs(v - mirroredApplied.rig.face.mouth.morphTargetInfluences[i]) < 1e-10))
  mirroredPreview.rig.face.eyes.forEach((eye, i) => assert(eye.position.distanceTo(mirroredApplied.rig.face.eyes[i].position) < 1e-10))
}
await mirroredPreview.setFace('face-scream', 0, 0, 1, { strength: 0 })
mirroredPreview.update(0, { clip: variationBody, clipTime: 0 })
assert(mirroredPreview.rig.face.mouth.morphTargetInfluences.every(v => Math.abs(v) < 1e-10), 'Facial strength must affect the controller, not just metadata')
mirroredPreview.rig.dispose()
mirroredApplied.rig.dispose()
const pausedStart = new CharacterController(createCharacterRig(), {}, library)
await pausedStart.playClip('idle-breathing', { time: 0, transition: .24 })
pausedStart.update(0, { transitionSeconds: 0 })
assert(Object.values(pausedStart.rig.bones).every(bone => bone.quaternion.toArray().every(Number.isFinite)), 'A paused first frame must not divide a transition by zero')
pausedStart.rig.dispose()
const oneShot = new CharacterController(createCharacterRig(), {}, library)
const oneShotClip = await oneShot.playClip('idle-breathing', { time: 2, loop: false, transition: 0 })
assert.equal(oneShotClip.loop, false, 'Returned clip must honor the one-shot request')
oneShot.update(2 + oneShotClip.duration + 1)
assert.equal(oneShot.animationState.finished, true)
assert.equal((await library.getClip('idle-breathing')).loop, true, 'One-shot playback must not mutate library cache entries')
oneShot.rig.dispose()
const transition = new CharacterAnimation(library)
await transition.play('idle-breathing', { time: 0, transition: 0 })
transition.sample(0.5)
await transition.play('fear-startle', { time: 0, transition: .4 })
const rewoundBlend = transition.sample(0)
assert.equal(rewoundBlend.id, 'fear-startle')
assert.equal(rewoundBlend.previousClip.source.id, 'idle-breathing')
assert.equal(rewoundBlend.blend, 0)
assert(Math.abs(rewoundBlend.previousTime - .5) < 1e-10, 'Rewinds must blend from the displayed previous pose, not time zero')
const rewoundMidpoint = transition.sample(.2)
assert(Math.abs(rewoundMidpoint.blend - .5) < 1e-10)
assert(Math.abs(rewoundMidpoint.previousTime - .7) < 1e-10)

controller.play({ movement: 'walk', speed: .4, posture: 'disturbed', expression: 'fear', gaze: 'camera', breathing: 'heavy', headMovement: 'unpredictable' }, 0, 0)
controller.update(1, { cameraPosition: new THREE.Vector3(0, 1.6, 4) })
const previousAPI = JSON.stringify(controller.motion)
await controller.playClip('idle-breathing', { time: 1, transition: .4 })
controller.update(1)
assert.equal(controller.animationState.id, 'idle-breathing')
assert.equal(controller.animationState.clipTime, 0)
await controller.playClip('fear-startle', { time: 1, transition: .4, loop: false })
controller.update(1.2)
assert.equal(controller.animationState.id, 'fear-startle')
assert.ok(Math.abs(controller.animationState.blend - .5) < 1e-10)
assert.equal(controller.animationState.previousClip.source.id, 'idle-breathing')
controller.pauseClip(1.2)
controller.update(99)
assert.equal(controller.animationState.paused, true)
assert.ok(Math.abs(controller.animationState.clipTime - .2) < 1e-10)
assert.ok(Math.abs(controller.animationState.blend - .5) < 1e-10)
assert.ok(Math.abs(controller.animationState.previousTime - .2) < 1e-10)
controller.resumeClip(3.2)
controller.seekClip(.4, 3.2)
controller.update(3.2)
assert.ok(Math.abs(controller.animationState.clipTime - .4) < 1e-10)
controller.update(controller.animationState.duration + 4)
assert.equal(controller.animationState.finished, true)
const finishedRotation = controller.rig.bones.head.quaternion.toArray()
controller.update(999)
assert.deepEqual(controller.rig.bones.head.quaternion.toArray(), finishedRotation)
assert.equal(JSON.stringify(controller.motion), previousAPI, 'library playback must not replace the procedural API')
await controller.playState('walk', { time: 10, transition: 0, loop: true })
const stateWalk = await library.getClip('walk-forwards')
controller.update(10 + stateWalk.duration * 1.5)
assert.ok(Math.abs(controller.animationState.clipTime - stateWalk.duration * .5) < 1e-9)
await assert.rejects(controller.playState('missing'), /Unknown animation state/)
await assert.rejects(controller.playClip('face-scream'), /separate layer/)
await controller.setFace('face-scream', 12, 0)
controller.update(12)
assert.ok(controller.rig.face.mouth.morphTargetInfluences[controller.rig.face.mouth.morphTargetDictionary.mouthOpen] > .95)
await controller.setFace('face-neutral', 13, 0)
controller.update(13)
assert.ok(controller.rig.face.mouth.morphTargetInfluences[controller.rig.face.mouth.morphTargetDictionary.mouthOpen] < .001)
await assert.rejects(controller.setFace('walk-forwards'), /Unknown facial preset/)
const leftPromise = controller.playClip('fear-startle', { time: 14, transition: 0 })
const rightPromise = controller.playClip('idle-breathing', { time: 14, transition: 0 })
await Promise.all([leftPromise, rightPromise])
assert.equal(controller.animationState.id, 'idle-breathing')

const pausedCharacter = new CharacterController(createCharacterRig(), {}, library)
await pausedCharacter.playClip('idle-breathing', { time: 1, transition: .4 })
pausedCharacter.update(1.1)
await pausedCharacter.setFace('face-confused', 1, .18)
pausedCharacter.update(1.1)
pausedCharacter.pauseClip(1.1)
const pausedHead = pausedCharacter.rig.bones.head.quaternion.toArray()
const pausedFace = Array.from(pausedCharacter.rig.face.mouth.morphTargetInfluences)
pausedCharacter.update(99)
assert.deepEqual(pausedCharacter.rig.bones.head.quaternion.toArray(), pausedHead)
assert.ok(pausedCharacter.rig.face.mouth.morphTargetInfluences.every((value, i) => Math.abs(value - pausedFace[i]) < 1e-10))
pausedCharacter.resumeClip(99)
pausedCharacter.update(99)
assert.ok(Math.abs(pausedCharacter.rig.bones.head.quaternion.angleTo(new THREE.Quaternion(...pausedHead))) < 1e-10)
assert.ok(pausedCharacter.rig.face.mouth.morphTargetInfluences.every((value, i) => Math.abs(value - pausedFace[i]) < 1e-10))
pausedCharacter.rig.dispose()

const original = await library.getClip('idle-breathing')
assert.ok(!validClip({ ...original, face: { constructor: [] } }))
assert.ok(!validClip({ ...original, face: { mouthOpen: [{ t: 1, v: .2 }, { t: .5, v: .2 }] } }))
assert.ok(!validClip({ ...original, source: { id: 'original', version: 1, speed: 1, strength: 1, mirror: 0 } }))

const altered = await library.getClip('fear-startle', { speed: 1.2, mirror: true })
const beforeExport = Object.values(controller.rig.bones).map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()])
const helpers = new THREE.Group()
helpers.name = 'characterEditorTargets'
controller.rig.group.add(helpers)
const clip = documentToAnimationClip(controller.rig, original)
assert.ok(clip.tracks.length >= 43)
const data = await exportAnimationPackGLB(controller.rig, [original, altered])
const loaded = await new GLTFLoader().parseAsync(data, '')
const boneNames = new Set()
const meshes = []
loaded.scene.traverse(node => { if (node.isBone) boneNames.add(node.name); if (node.isSkinnedMesh) meshes.push(node) })
assert.equal(loaded.parser.json.skins.length, 1)
assert.equal(loaded.parser.json.skins[0].joints.length, 18)
assert.ok(meshes.length > 0)
assert.ok(meshes.every(mesh => mesh.skeleton === meshes[0].skeleton), 'All material meshes must share one imported skeleton')
assert.equal(boneNames.size, 18)
assert.equal(loaded.animations.length, 2)
assert.ok(Math.abs(loaded.animations[0].duration - original.duration) < 1e-6)
assert.ok(Math.abs(loaded.animations[1].duration - altered.duration) < 1e-6)
const mouth = loaded.scene.getObjectByName('mouth')
assert.equal(Object.keys(mouth.morphTargetDictionary).length, 3)
for (const mesh of meshes) {
  const weights = mesh.geometry.getAttribute('skinWeight')
  for (const weight of weights.array) assert.ok(Number.isFinite(weight))
  assert.ok(mesh.geometry.index.count > 0 && mesh.geometry.index.count % 3 === 0)
  assert.equal(mesh.geometry.getAttribute('skinIndex').count, weights.count)
  assert.ok([...mesh.geometry.getAttribute('skinIndex').array].every(index => Number.isInteger(index) && index >= 0 && index < 18))
  if (mesh.geometry.groups.length) assert.equal(mesh.geometry.index.count, mesh.geometry.groups.reduce((sum, group) => sum + group.count, 0))
}
assert.equal(loaded.scene.getObjectByName('characterEditorTargets'), undefined)
assert.deepEqual(Object.values(controller.rig.bones).map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()]), beforeExport)
controller.rig.dispose()

console.log(`✓ animation catalog: ${LIBRARY_DEFINITIONS.length} clips validated (${source.animations.length} licensed, retargeted clips + ${LIBRARY_DEFINITIONS.length - source.animations.length} authored presets)`)
console.log(`✓ explicit-time playback: loops, one-shots, pause/seek, crossfades, cancellation, face layers and existing play() compatibility`)
console.log(`✓ reusable GLB: ${Buffer.from(data).length} bytes, 2 clips, official GLTFLoader round-trip, 18 bones and three facial morphs`)
console.log('smallest skin bounds:', minima.sort((a, b) => a.y - b.y).slice(0, 5))
console.log('largest loop head seams:', seams.sort((a, b) => b.ratio - a.ratio).slice(0, 5))
