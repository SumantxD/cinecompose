import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createCharacter, validClip } from '../src/characters/index.ts'
import { bakeCharacterClip } from '../src/characters/export.ts'
import { touchDollyPan } from '../src/studio/navigation.ts'
import { fitPoseCamera } from '../src/characters/pose.ts'

const c = createCharacter()
rigsInitial()
function rigsInitial() {
  assert.ok(c.rig.skinned.isSkinnedMesh)
  assert.ok(c.rig.skeleton.bones.length >= 16)
  assert.ok(c.rig.skinned.geometry.groups.length > 0, 'multi-material skin needs draw groups')
  assert.equal(c.rig.skinned.geometry.groups.reduce((sum, group) => sum + group.count, 0), c.rig.skinned.geometry.index.count)
  const index = c.rig.skinned.geometry.getAttribute('skinIndex')
  const weights = c.rig.skinned.geometry.getAttribute('skinWeight')
  for (let i = 0; i < weights.count; i++) assert.equal(Array.from({length: 4}, (_, j) => weights.array[i * 4 + j]).reduce((a, b) => a + b, 0), 1)
  let deformation = 0
  for (let i = 0; i < index.count; i += 4) {
    if (index.getX(i) !== c.rig.skeleton.bones.indexOf(c.rig.bones.head)) continue
    const before = new THREE.Vector3().fromBufferAttribute(c.rig.skinned.geometry.getAttribute('position'), i).toArray()
    c.rig.bones.head.rotation.y = Math.PI / 2
    c.rig.group.updateMatrixWorld(true)
    const after = c.rig.skinned.getVertexPosition(i, new THREE.Vector3()).toArray()
    deformation = Math.max(deformation, Math.hypot(...after.map((v, j) => v - before[j])))
  }
  assert.ok(deformation > 0.01, 'head rotation must deform the head geometry')
}

const clip = { id: 'clip1', name: 'test', duration: 1, motion: { ...c.motion, movement: 'walk', speed: 0.4, posture: 'disturbed', expression: 'fear', gaze: 'forward', breathing: 'heavy', headMovement: 'unpredictable', groundContact: true }, tracks: {}, targets: {} }
for (const speed of [0.4, 1.4]) {
  c.play({ movement: 'walk', speed }, 0, 0)
  for (let i = 0; i <= 100; i++) {
    c.update(i / 50)
    const feet = ['leftAnkle', 'rightAnkle'].map((name) => c.rig.bones[name].getWorldPosition(new THREE.Vector3()).y)
    assert.ok(feet.some((y) => Math.abs(y - 0.08) < 0.0005), `contact lost at speed ${speed}, step ${i}: ${feet}`)
  }
}
c.play(clip.motion, 0, 0)
for (let i = 0; i <= 200; i++) {
  c.update(i * 1.3 / 200)
  for (const b of Object.values(c.rig.bones)) {
    assert.ok(b.position.toArray().every(Number.isFinite))
    assert.ok(Math.abs(b.quaternion.length() - 1) < 1e-5, `${b.name} quaternion drift`)
  }
  const feet = ['leftAnkle', 'rightAnkle'].map((name) => c.rig.bones[name].getWorldPosition(new THREE.Vector3()).y)
  assert.ok(feet.some((y) => Math.abs(y - 0.08) < 0.0005), `contact lost at ${i}: ${feet}`)
}

const hand = [0.38, 1.2, 0.38]
c.play({ reach: { leftHand: hand }, groundContact: false }, 0, 0)
c.update(0)
assert.ok(c.rig.bones.leftWrist.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...hand)) < 1e-6)

const framed = createCharacter()
for (const pose of ['standing', 'climb', 'floor']) {
  framed.rig.bones.hips.position.set(pose === 'climb' ? 1.4 : pose === 'floor' ? -1.7 : 0, pose === 'climb' ? 2.6 : pose === 'floor' ? .02 : .94, pose === 'floor' ? 2.5 : 0)
  framed.rig.bones.hips.rotation.z = pose === 'floor' ? Math.PI / 2 : 0
  const before = Object.values(framed.rig.bones).map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()])
  for (const aspect of [680 / 502, 390 / 535]) {
    const camera = new THREE.PerspectiveCamera(37, aspect, .1, 100)
    const placement = fitPoseCamera(framed.rig, camera)
    camera.position.copy(placement.position); camera.lookAt(placement.target); camera.updateMatrixWorld(true)
    const worldBox = framed.rig.skinned.boundingBox.clone().applyMatrix4(framed.rig.skinned.matrixWorld)
    for (const x of [worldBox.min.x, worldBox.max.x]) for (const y of [worldBox.min.y, worldBox.max.y]) for (const z of [worldBox.min.z, worldBox.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera)
      assert(Math.abs(point.x) < .94 && Math.abs(point.y) < .94 && point.z > -1 && point.z < 1, `${pose}/${aspect}: overview clipped a skinned-box corner: ${point.toArray()}`)
    }
  }
  assert.deepEqual(Object.values(framed.rig.bones).map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()]), before, 'Overview cannot alter the pose')
}
framed.rig.dispose()

const c2 = createCharacter()
c.play({ movement: 'walk', headMovement: 'unpredictable' }, 0, 0)
c2.play({ movement: 'walk', headMovement: 'unpredictable' }, 0, 0)
for (const t of [0, 0.37, 2.54]) {
  c.update(t); c2.update(t)
  for (const name of Object.keys(c.rig.bones)) assert.deepEqual(c.rig.bones[name].quaternion.toArray(), c2.rig.bones[name].quaternion.toArray())
}
c.play({ gaze: 'camera' }, 0, 0)
const eyeCamera = c.rig.bones.head.getWorldPosition(new THREE.Vector3())
c.update(0, { cameraPosition: eyeCamera })
assert.ok(c.rig.bones.head.quaternion.toArray().every(Number.isFinite), 'coincident camera must not create a NaN gaze')
c.play({ reach: { rightHand: [5, 2, 3] } }, 0, 0)
c.update(0)
assert.ok(c.rig.bones.rightShoulder.getWorldPosition(new THREE.Vector3()).distanceTo(c.rig.bones.rightWrist.getWorldPosition(new THREE.Vector3())) < 0.551)
const keyed = { ...clip, duration: 2, motion: { ...clip.motion, movement: 'idle' }, tracks: { chest: { rotation: [{ t: 0, q: [0, 0, 0, 1] }, { t: 1, q: [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)] }] } } }
assert.ok(validClip(keyed))
c.update(0.5, { clip: keyed, clipTime: 0.5 })
assert.ok(Math.abs(c.rig.bones.chest.rotation.y - Math.PI / 4) < 1e-6, 'rotation interpolation')
assert.ok(!validClip({ ...clip, duration: Infinity }))
assert.ok(!validClip({ ...clip, motion: { ...clip.motion, posture: 'invalid' } }))
assert.ok(validClip(clip), 'clip validation')
const baked = bakeCharacterClip(c.rig, clip)
assert.equal(baked.clip.duration, clip.duration)
assert.ok(baked.clip.tracks.length >= c.rig.skeleton.bones.length * 2)
for(const track of baked.clip.tracks) assert.ok([...track.times, ...track.values].every(Number.isFinite), `${track.name} contains invalid numbers`)
const morph = baked.clip.tracks.find((t) => t.name === 'mouth.morphTargetInfluences[mouthOpen]')
assert.ok(morph && new Set(morph.values).size > 1, 'facial morph must be exported over time')
assert.ok(!validClip({ ...clip, motion: { ...clip.motion, speed: null } }))
assert.ok(!validClip({ ...clip, motion: { ...clip.motion, movement: '' } }))
assert.ok(!validClip({ ...clip, motion: { ...clip.motion, seed: NaN } }))
assert.ok(!validClip({ ...clip, tracks: null }))
assert.ok(!validClip({ ...clip, targets: null }))
assert.ok(!validClip({ ...clip, tracks: { constructor: {} } }))
assert.ok(!validClip({ ...clip, tracks: { head: { rotation: [{ t: 0, q: [0, 0, 0, 0] }] } } }))
assert.ok(!validClip({ ...clip, targets: { leftHand: null } }))

const records = new Map()
globalThis.localStorage = {
  getItem: (key) => records.get(key) ?? null,
  setItem: (key, value) => records.set(key, String(value)),
}
const saved = { version: 1, activeId: 'a', clips: [{ ...clip, id: 'a', name: 'Stored study', tracks: {}, targets: {} }] }
const unsupported = JSON.stringify({ ...saved, version: 2 })
records.set('kr-character-lab-v1', unsupported)
const recovered = (await import('../src/characters/store.ts?recovery-test')).useCharacter.getState()
assert.equal(recovered.doc.clips[0].name, 'Character study')
assert.equal(recovered.recovery, unsupported)
assert.equal(records.get('kr-character-lab-v1-recovery'), unsupported)
assert.equal(recovered.storageOK, true)
records.set('kr-character-lab-v1', JSON.stringify(saved))
records.delete('kr-character-lab-v1-recovery')
const editable = await import('../src/characters/store.ts?editable-test')
const store = () => editable.useCharacter.getState()
assert.equal(store().doc.activeId, 'a')
store().newClip()
assert.equal(store().doc.clips.length, 2)
const savedSecond = records.get('kr-character-lab-v1')
assert.ok(savedSecond && JSON.stringify(store().doc) === savedSecond)
store().deleteClip()
assert.equal(store().doc.clips.length, 1)
store().undo()
assert.equal(JSON.stringify(store().doc), savedSecond)
store().redo()
assert.equal(store().doc.clips.length, 1)
const priorImport = JSON.stringify(store().doc)
assert.equal(store().load(JSON.stringify({ version: 2 })), false)
assert.equal(JSON.stringify(store().doc), priorImport)
assert.equal(store().load(JSON.stringify({ version: 1, activeId: 'second', clips: [
  { ...clip, id: 'a', name: 'Source', tracks: {}, targets: {} },
  { ...clip, id: 'second', name: 'Imported', duration: 2, tracks: {}, targets: {} },
] })), true)
assert.equal(store().doc.activeId, 'second')
store().undo()
assert.equal(JSON.stringify(store().doc), priorImport)
store().redo()
assert.equal(store().doc.activeId, 'second')
editable.keyIK(0.25, 'leftHand', [0.2, 1.2, 0.3])
assert.equal(editable.activeClip().targets.leftHand.length, 1)
editable.removeKeys('ik:leftHand')
assert.equal(editable.activeClip().targets.leftHand, undefined)
assert.deepEqual(editable.activeClip().motion.reach.leftHand, [0.2, 1.2, 0.3])
const beforeFailure = JSON.stringify(store().doc)
globalThis.localStorage.setItem = () => { throw new Error('blocked writes') }
store().setMotion({ posture: 'tense' })
assert.equal(store().storageOK, false)
globalThis.localStorage.setItem = (key, value) => records.set(key, String(value))
store().undo()
assert.equal(store().storageOK, true)
assert.equal(JSON.stringify(store().doc), beforeFailure)
assert.equal(JSON.parse(records.get('kr-character-lab-v1')).version, 1)
store().setTime(Infinity)
assert.equal(store().time, 0)
store().setTime(999)
assert.equal(store().time, editable.activeClip().duration)
store().setTime(NaN)
assert.equal(store().time, 0)
assert(store().load(JSON.stringify({ version: 1, activeId: 'clipInfinity', clips: [{ id: 'clipInfinity', name: 'Edited ID', duration: 1, motion: {}, tracks: {}, targets: {} }] })))
store().newClip()
store().newClip()
assert.equal(new Set(store().doc.clips.map(clip => clip.id)).size, store().doc.clips.length, 'new clips remain unique after hand-edited IDs')

const camera = new THREE.PerspectiveCamera(38, 0.75, 0.02, 50)
const target = new THREE.Vector3(0, 0.92, 0)
camera.position.set(2.4, 1.4, 3.2)
camera.lookAt(target)
const origin = { position: camera.position.clone(), target: target.clone(), quaternion: camera.quaternion.clone(), span: 160, centre: new THREE.Vector2(150, 210) }
touchDollyPan(camera, target, origin, origin.centre.clone(), 320, 535)
assert(target.distanceTo(origin.target) < 1e-12, 'pinch Centre stays fixed')
const offset = origin.position.clone().sub(origin.target).multiplyScalar(0.5)
touchDollyPan(camera, target, origin, new THREE.Vector2(174, 218), 320, 535)
assert(camera.position.clone().sub(target).distanceTo(offset) < 1e-12, 'pan translates camera and focus together')
console.log('✓ character rig: skin deformation, IK, contact cycle, deterministic motion, morph + clip baking')
console.log('✓ clip documents: validation, recovery, undo/redo, persistence and failed-write safety')
