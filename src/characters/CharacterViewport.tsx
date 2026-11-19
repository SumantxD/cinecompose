import { useEffect, useMemo, useRef } from 'react'
import { Canvas, createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, TransformControls } from '@react-three/drei'
import { OrbitControls as OrbitImpl, TransformControls as TransformImpl } from 'three-stdlib'
import * as THREE from 'three'
import { activeClip, flipPlayback, keyIK, keyPosition, keyRotation, useCharacter } from './store.ts'
import { CharacterController } from './controller.ts'
import { samplePositionKeys, fitPoseCamera } from './pose.ts'
import { exportCharacterGLB } from './export.ts'
import type { CharacterClip, IKTarget } from './types.ts'
import { freeDolly, touchDollyPan } from '../studio/navigation.ts'

export type CharacterPart = 'root' | string
interface Props { controller: CharacterController; selected: CharacterPart; mode: 'rotate' | 'translate'; joints: boolean; faceMode?: boolean; onSelect: (part: string) => void; onCamera: (camera: THREE.Camera) => void; preview?: CharacterClip; onFinish?: (finished: boolean) => void; onTogglePlayback?: () => void; onPoseValues?: (key: string, values: number[]) => void }
const HANDS: IKTarget[] = ['leftHand', 'rightHand']

function BodyViewport({ controller, selected, mode, joints, faceMode = false, onSelect, onCamera, preview, onFinish, onTogglePlayback, onPoseValues }: Props) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const getScene = useThree((state) => state.get)
  const rig = controller.rig
  const orbit = useRef<OrbitImpl | null>(null)
  const faceViewBackup = useRef<{ position: THREE.Vector3; target: THREE.Vector3; fov: number } | null>(null)
  const transform = useRef<TransformImpl | null>(null)
  const activeAxis = () => (transform.current as unknown as { axis: string | null } | null)?.axis
  const pick = (event: ThreeEvent<PointerEvent>, part: string) => {
    event.stopPropagation()
    if (activeAxis()) return
    onSelect(part)
  }
  const markers = useRef<Record<string, THREE.Group | null>>({})
  const poseSignature = useRef('')
  const dragging = useRef(false)
  const keys = useRef(new Set<string>())
  const move = useRef(new THREE.Vector3()), forward = useRef(new THREE.Vector3()), right = useRef(new THREE.Vector3())
  const targetGroups = useMemo(() => {
    const leftHand = new THREE.Group(), rightHand = new THREE.Group()
    leftHand.name = 'target:leftHand'; rightHand.name = 'target:rightHand'
    return { leftHand, rightHand }
  }, [])
  const editorTargets = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'characterEditorTargets'
    return group
  }, [controller])

  useEffect(() => () => { editorTargets.removeFromParent() }, [editorTargets])
  useEffect(() => {
    onCamera(camera)
    if (import.meta.env.DEV) (window as unknown as { characterLab: unknown }).characterLab = {
      controller, rig, store: useCharacter, r3f: getScene(), THREE,
      export: () => exportCharacterGLB(rig, activeClip(), { cameraPosition: camera.position.clone() }),
    }
  }, [camera, controller, getScene, onCamera, rig])

  useEffect(() => {
    const dom = gl.domElement
    const points = new Map<number, THREE.Vector2>()
    let origin: Parameters<typeof touchDollyPan>[2] | null = null
    const begin = (control: OrbitImpl) => {
      const [a, b] = [...points.values()]
      const span = a.distanceTo(b)
      if (span < 1) return
      origin = { position: camera.position.clone(), target: control.target.clone(), quaternion: camera.quaternion.clone(), span, centre: a.clone().add(b).multiplyScalar(0.5) }
      control.enabled = false
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !orbit.current) return
      dom.setPointerCapture(event.pointerId)
      points.set(event.pointerId, new THREE.Vector2(event.pageX, event.pageY))
      if (points.size >= 2 && !dragging.current) begin(orbit.current)
      if (origin) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    const move = (event: PointerEvent) => {
      const point = points.get(event.pointerId)
      if (!point || !orbit.current) return
      point.set(event.pageX, event.pageY)
      if (dragging.current || points.size < 2) return
      if (!origin) begin(orbit.current)
      if (!origin) return
      event.preventDefault(); event.stopImmediatePropagation()
      const [a, b] = [...points.values()]
      touchDollyPan(camera as THREE.PerspectiveCamera, orbit.current.target, origin, a.clone().add(b).multiplyScalar(0.5), a.distanceTo(b), dom.clientHeight)
      orbit.current.update()
    }
    const end = (event: PointerEvent) => {
      points.delete(event.pointerId)
      origin = null
      if (orbit.current) orbit.current.enabled = !dragging.current
    }
    const cancel = () => { points.clear(); origin = null; if (orbit.current) orbit.current.enabled = !dragging.current }
    dom.addEventListener('pointerdown', down, true)
    dom.addEventListener('pointermove', move, true)
    dom.addEventListener('pointerup', end, true)
    dom.addEventListener('pointercancel', end, true)
    window.addEventListener('blur', cancel)
    return () => {
      dom.removeEventListener('pointerdown', down, true)
      dom.removeEventListener('pointermove', move, true)
      dom.removeEventListener('pointerup', end, true)
      dom.removeEventListener('pointercancel', end, true)
      window.removeEventListener('blur', cancel)
      if (orbit.current) orbit.current.enabled = true
    }
  }, [camera, gl])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button')) return
      if (event.ctrlKey || event.metaKey) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(event.code)) keys.current.add(event.code)
      if (event.code === 'Space') { event.preventDefault(); (onTogglePlayback ?? flipPlayback)() }
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [onTogglePlayback])

  useEffect(() => {
    const dom = gl.domElement
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      camera.getWorldDirection(forward.current)
      if (orbit.current) freeDolly(camera.position, orbit.current.target, forward.current, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? dom.clientHeight : 1), 1)
      orbit.current?.update()
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button') || event.ctrlKey || event.metaKey) return
      const control = orbit.current
      if (!control) return
      if (event.code === 'Home') {
        faceViewBackup.current = null
        const overview = fitPoseCamera(rig, camera as THREE.PerspectiveCamera)
        camera.position.copy(overview.position)
        control.target.copy(overview.target)
      }
      if (event.code === 'KeyF') {
        const object = faceMode ? rig.bones.head : selected.startsWith('ik:') ? targetGroups[selected.slice(3) as IKTarget] : controller.rig.bones[selected]
        if (faceMode) faceViewBackup.current ??= { position: camera.position.clone(), target: control.target.clone(), fov: (camera as THREE.PerspectiveCamera).fov }
        if (!object) return
        const focus = faceMode ? object.getWorldPosition(new THREE.Vector3()) : selected === 'root' ? controller.rig.bones.root.localToWorld(new THREE.Vector3(0, 0.92, 0)) : object.getWorldPosition(new THREE.Vector3())
        const offset = camera.position.clone().sub(control.target)
        if (offset.lengthSq() < 0.00001) offset.set(0.4, 0.2, 1)
        offset.normalize().multiplyScalar(faceMode ? .62 : selected === 'root' ? 2.8 : 1.5)
        camera.position.copy(focus).add(offset)
        control.target.copy(focus)
        if (faceMode) (camera as THREE.PerspectiveCamera).fov = 30
      }
      control.update()
    }
    dom.addEventListener('wheel', wheel, { passive: false, capture: true })
    window.addEventListener('keydown', keyboard)
    return () => { dom.removeEventListener('wheel', wheel, true); window.removeEventListener('keydown', keyboard) }
  }, [camera, controller, gl, selected, targetGroups, faceMode])

  useFrame(({ camera }, delta) => {
    const state = useCharacter.getState(), clip = activeClip()
    let time = state.time
    const facePreview = !!preview?.source?.id.startsWith('face-')
    const duration = (facePreview ? clip : preview ?? clip).duration
    const loop = !!(facePreview ? clip.loop : (preview ?? clip).loop)
    if (state.playing) {
      const advanced = time + Math.min(delta, 0.05)
      time = loop ? advanced % duration : Math.min(advanced, duration)
      useCharacter.setState({ time, playing: time < duration || loop })
      controller.resumeClip(time)
    } else controller.pauseClip(time)
    const layer = facePreview ? { clip, clipTime: time, transitionSeconds: 0 } : preview ? { transitionSeconds: 0 } : { clip, clipTime: time }
    controller.update(time, { cameraPosition: camera.position, ...layer, groundY: 0, paused: !state.playing })
    let values: number[] | undefined
    if (selected.startsWith('ik:')) values = targetGroups[selected.slice(3) as IKTarget]?.position.toArray()
    else {
      const bone = rig.bones[selected]
      if (bone) values = mode === 'translate' ? bone.position.toArray() : bone.rotation.toArray().slice(0, 3).map(value => Number(value) * 180 / Math.PI)
    }
    if (values) {
      const rounded = values.map(value => Number(value.toFixed(3))).join(',')
      const signature = `${selected}:${mode}:${rounded}`
      if (signature !== poseSignature.current) {
        poseSignature.current = signature
        onPoseValues?.(`${selected}-${mode}`, values)
      }
    }
    onFinish?.(!!preview && !facePreview && !useCharacter.getState().playing && !!controller.animationState?.finished)
    for (const [name, bone] of Object.entries(rig.bones)) markers.current[name]?.position.copy(bone.getWorldPosition(move.current))
    for (const side of HANDS) {
      const reached = clip.motion.reach?.[side]
      targetGroups[side].visible = !!reached
      if (!reached) continue
      const out = new THREE.Vector3()
      const animated = samplePositionKeys(clip.targets[side], time, out)
      out.copy(animated ? out : new THREE.Vector3(...reached))
      targetGroups[side].position.copy(out)
    }
    const control = orbit.current
    if (control) {
      const speed = (keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')) ? 6 : 2
      move.current.set(0, 0, 0)
      camera.getWorldDirection(forward.current)
      right.current.crossVectors(forward.current, camera.up).normalize()
      if (keys.current.has('KeyW')) move.current.add(forward.current)
      if (keys.current.has('KeyS')) move.current.sub(forward.current)
      if (keys.current.has('KeyD')) move.current.add(right.current)
      if (keys.current.has('KeyA')) move.current.sub(right.current)
      if (keys.current.has('KeyE')) move.current.y += 1
      if (keys.current.has('KeyQ')) move.current.y -= 1
      if (move.current.lengthSq() > 0) {
        move.current.normalize().multiplyScalar(Math.min(delta, 0.05) * speed)
        camera.position.add(move.current); control.target.add(move.current)
      }
      control.update()
    }
  })

  const bodyPart = (event: ThreeEvent<PointerEvent>): string | null => {
    const mesh = event.object as THREE.SkinnedMesh
    if (mesh.isSkinnedMesh && event.face) {
      const index = mesh.skeleton.bones[mesh.geometry.getAttribute('skinIndex').getX(event.face.a)]
      if (index) return index.name
    }
    return event.object.parent instanceof THREE.Bone ? event.object.parent.name : null
  }
  const selectBody = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (activeAxis()) return
    const part = bodyPart(event)
    if (part) onSelect(part)
  }
  const clip = activeClip()
  const isIK = selected.startsWith('ik:')
  const object = isIK ? targetGroups[selected.slice(3) as IKTarget] : rig.bones[selected]
  useEffect(() => {
    if (faceMode || !faceViewBackup.current) return
    camera.position.copy(faceViewBackup.current.position)
    if (camera instanceof THREE.PerspectiveCamera) camera.fov = faceViewBackup.current.fov
    camera.updateProjectionMatrix()
    if (orbit.current) {
      orbit.current.target.copy(faceViewBackup.current.target)
      orbit.current.update()
    }
    faceViewBackup.current = null
  }, [camera, controller, faceMode, rig])
  const gazeDriven = selected === 'head' && ['camera', 'target'].includes(clip.motion.gaze)
  return <>
    <color attach="background" args={['#111a22']} />
    <ambientLight intensity={0.75} />
    <hemisphereLight args={['#a8bbc4', '#30302b', 1.05]} />
    <directionalLight castShadow position={[-3, 5, 4]} intensity={2.8} shadow-mapSize={[1024, 1024]} shadow-camera-near={0.1} shadow-camera-far={15} />
    <directionalLight position={[2, 2, 5]} intensity={1.1} color="#c8d4d8" />
    <directionalLight position={[3, 2, -4]} intensity={1.5} color="#829eb8" />
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[6, 64]} />
      <meshStandardMaterial color="#19242e" roughness={0.94} />
    </mesh>
    <primitive object={rig.group} onPointerDown={selectBody} />
    {joints && Object.entries(rig.bones).map(([name]) => <group key={name} ref={node => { markers.current[name] = node }}>
      <mesh renderOrder={20} onPointerDown={(event) => pick(event, name)}>
        <sphereGeometry args={[selected === name ? 0.028 : 0.018, 10, 8]} />
        <meshBasicMaterial color={selected === name ? '#ffbf69' : '#72b9b0'} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh onPointerDown={(event) => pick(event, name)}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>)}
    {createPortal(<primitive object={editorTargets}>
      {HANDS.map((side) => <primitive key={side} object={targetGroups[side]}>
        <mesh onPointerDown={(event) => pick(event, `ik:${side}`)}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshBasicMaterial color="#8de1cf" wireframe depthTest={false} />
        </mesh>
      </primitive>)}
    </primitive>, rig.bones.root)}
    {!faceMode && !preview && object && !gazeDriven && (!isIK || clip.motion.reach?.[selected.slice(3) as IKTarget]) && <TransformControls ref={transform} object={object} mode={isIK ? 'translate' : mode} space={isIK ? 'world' : 'local'} size={0.75}
      onMouseDown={() => { controller.stopClip(useCharacter.getState().time); useCharacter.getState().begin(); useCharacter.setState({ playing: false }); dragging.current = true; if (orbit.current) orbit.current.enabled = false }}
      onMouseUp={() => { dragging.current = false; if (orbit.current) orbit.current.enabled = true }}
      onObjectChange={() => {
        const { time, playing } = useCharacter.getState()
        if (!object || !dragging.current || playing) return
        if (isIK) keyIK(time, selected.slice(3) as IKTarget, controller.rig.bones.root.worldToLocal(object.getWorldPosition(new THREE.Vector3())).toArray())
        else if (mode === 'translate') keyPosition(time, selected, object.position.toArray())
        else keyRotation(time, selected, object.quaternion.toArray())
      }}
    />}
    <OrbitControls ref={orbit} makeDefault domElement={gl.domElement} target={[0, 0.92, 0]} enableDamping={false} enableZoom enablePan screenSpacePanning />
  </>
}

export function CharacterViewport(props: Props) {
  return <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ fov: 38, position: [2.4, 1.4, 3.2], near: 0.02, far: 50 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}>
    <BodyViewport {...props} />
  </Canvas>
}
