import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import { ScreenOverlay as Html } from './ScreenOverlay'
import { OrbitControls as OrbitImpl } from 'three-stdlib'
import type { TransformControls as TransformImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useStudio } from './studioStore'
import { cam, cameraPaths, type CameraSample } from '../cinematic/timeline'
import { freeDolly } from './navigation.ts'
import { frameAxisView, directorOverview, directorFramePoints, type AxisView } from './viewpoints.ts'
import { cameraPointFromNumber, currentCameraPoint, rememberCameraPoint } from './DirectorFrameControls'
import {
  getCameraPoint, moveCameraAim, moveCameraPoint, movePathHandle, pathFromShot,
  sampleShot, shotPointCount, splitCameraPath,
} from '../cinematic/curve.ts'
import type { Cue, Shot, Vec3 } from '../cinematic/types'
const moved = (v: THREE.Vector3): Vec3 => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100]

function DragTransform({ value, onChange, children }: { value: Vec3; onChange: (v: Vec3) => void; children: ReactNode }) {
  const [object, setObject] = useState<THREE.Group | null>(null)
  const control = useThree((s) => s.controls) as OrbitImpl | null
  const transform = useRef<TransformImpl | null>(null)
  const gl = useThree((s) => s.gl)
  const connected = useThree((s) => s.events.connected)
  useEffect(() => {
    const dom = connected ?? gl.domElement
    // three-stdlib marks runtime picker state private; native orbit must be gated before its pointer-down.
    const active = () => transform.current as unknown as { axis: string | null; dragging: boolean } | null
    const blockOrbit = () => { if (control && (useStudio.getState().gizmoDragging || active()?.axis || active()?.dragging)) control.enabled = false }
    const syncOrbit = () => { if (!control || active()?.dragging || useStudio.getState().gizmoDragging) return; control.enabled = !active()?.axis }
    const enableOrbit = () => { if (control && !active()?.dragging && !useStudio.getState().gizmoDragging) control.enabled = true }
    dom.addEventListener('pointerdown', blockOrbit, true)
    dom.addEventListener('pointermove', syncOrbit)
    dom.addEventListener('pointerleave', enableOrbit)
    return () => {
      dom.removeEventListener('pointerdown', blockOrbit, true)
      dom.removeEventListener('pointermove', syncOrbit)
      dom.removeEventListener('pointerleave', enableOrbit)
      enableOrbit()
    }
  }, [control, connected, gl, object])
  return <>
    <group ref={setObject} position={value}>{children}</group>
    {object && <TransformControls ref={transform} object={object} mode="translate" size={0.65}
      onMouseDown={() => { if (control) control.enabled = false; useStudio.getState().set({ gizmoDragging: true }); useStudio.getState().begin() }}
      onMouseUp={() => { useStudio.getState().set({ gizmoDragging: false }); if (control) control.enabled = true }}
      onObjectChange={() => onChange(moved(object.position))} />}
  </>
}

function Marker({ color = '#e4a34d', scale = 1 }: { color?: string; scale?: number }) {
  return <mesh scale={scale} renderOrder={20}><octahedronGeometry args={[0.13, 0]} />
    <meshBasicMaterial color={color} depthTest={false} depthWrite={false} transparent opacity={0.95} /></mesh>
}

function shotStart(index: number) {
  const shots = useStudio.getState().cfg.shots
  let t = 0
  for (let i = 0; i < index; i++) t += shots[i].duration
  return t
}

function selectCameraPoint(shotIndex: number, nodeIndex: number) {
  const st = useStudio.getState(), shot = st.cfg.shots[shotIndex]
  rememberCameraPoint(st.sceneId, shotIndex, nodeIndex)
  const point = getCameraPoint(shot, nodeIndex)
  st.set({ sel: { kind: 'shot', index: shotIndex, node: nodeIndex }, cameraEnd: nodeIndex === shotPointCount(shot) - 1, playing: false, t: shotStart(shotIndex) + point.time })
}

function selectPointNumber(number: number) {
  const shots = useStudio.getState().cfg.shots
  let point = number - 1
  for (let shotIndex = 0; shotIndex < shots.length; shotIndex++) {
    const count = shotPointCount(shots[shotIndex])
    if (point >= 0 && point < count) return selectCameraPoint(shotIndex, point)
    point -= count
  }
}

function selectedFocusPoint(): Vec3 | null {
  const s = useStudio.getState()
  if (s.sel?.kind === 'shot') {
    const shot = s.cfg.shots[s.sel.index]
    return getCameraPoint(shot, s.sel.node ?? (s.cameraEnd ? shotPointCount(shot) - 1 : 0)).position
  }
  if (s.sel?.kind === 'cue') {
    const cue = s.cfg.cues[s.sel.index]
    if ((cue.action === 'entity' || cue.action === 'sfx') && cue.position) return cue.position
  }
  return null
}

function PointNumber({ number, end, selected, onClick }: { number: number; end: boolean; selected: boolean; onClick: () => void }) {
  return <Html label={String(number)} className={`st-point-number ${end ? 'end' : 'start'} ${selected ? 'sel' : ''}`} title={`Point ${number}: show in film preview`} onClick={onClick} button />
}

type HandleField = 'in' | 'out' | 'aimIn' | 'aimOut'

function PathHandle({ shotIndex, nodeIndex, field, active, onSelect }: { shotIndex: number; nodeIndex: number; field: HandleField; active: boolean; onSelect: () => void }) {
  const path = useStudio((s) => s.cfg.shots[shotIndex].path)
  if (!path) return null
  const value = path.nodes[nodeIndex][field]
  const change = (v: Vec3) => useStudio.getState().change((c) => movePathHandle(c.shots[shotIndex].path!, nodeIndex, field, v))
  const label = field === 'in' ? 'IN' : field === 'out' ? 'OUT' : field === 'aimIn' ? 'AIM IN' : 'AIM OUT'
  const colour = field.startsWith('aim') ? '#b599ca' : '#92b3c7'
  const contents = <><mesh><sphereGeometry args={[0.22, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} /></mesh><Marker color={colour} scale={0.5} /><Html label={label} className="st-handle-label" title={label} passThrough /></>
  return active ? <DragTransform value={value} onChange={change}>{contents}</DragTransform>
    : <group position={value} onPointerDown={(e) => { e.stopPropagation(); onSelect() }}>{contents}</group>
}

function AimPoint({ shotIndex, nodeIndex, active, onSelect }: { shotIndex: number; nodeIndex: number; active: boolean; onSelect: () => void }) {
  const shot = useStudio((s) => s.cfg.shots[shotIndex])
  const value = getCameraPoint(shot, nodeIndex).aim
  const change = (v: Vec3) => useStudio.getState().change((c) => moveCameraAim(c.shots[shotIndex], nodeIndex, v))
  const contents = <><mesh><sphereGeometry args={[0.22, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} /></mesh><Marker color="#b599ca" scale={0.65} /><Html label="AIM" className="st-handle-label" title="AIM" passThrough /></>
  return active ? <DragTransform value={value} onChange={change}>{contents}</DragTransform>
    : <group position={value} onPointerDown={(e) => { e.stopPropagation(); onSelect() }}>{contents}</group>
}

function CameraPoint({ shotIndex, nodeIndex, number }: { shotIndex: number; nodeIndex: number; number: number }) {
  const st = useStudio(), shot = st.cfg.shots[shotIndex]
  const selectedNode = st.sel?.node ?? (st.cameraEnd ? shotPointCount(shot) - 1 : 0)
  const selected = st.sel?.kind === 'shot' && st.sel.index === shotIndex && selectedNode === nodeIndex
  const [activeField, setActiveField] = useState<HandleField | 'point' | 'aim'>('point')
  useEffect(() => setActiveField('point'), [st.sel, st.editAim])
  const { position } = getCameraPoint(shot, nodeIndex)
  const end = nodeIndex === shotPointCount(shot) - 1
  const change = (v: Vec3) => useStudio.getState().change((c) => moveCameraPoint(c.shots[shotIndex], nodeIndex, v))
  const select = () => selectCameraPoint(shotIndex, nodeIndex)
  return <>
    {selected && !st.editAim && activeField === 'point'
      ? <DragTransform value={position} onChange={change}><Marker scale={0.8} /><PointNumber number={number} end={end} selected onClick={select} /></DragTransform>
      : <group position={position}><PointNumber number={number} end={end} selected={selected} onClick={select} /></group>}
    {selected && (st.editAim || !shot.path) && <AimPoint shotIndex={shotIndex} nodeIndex={nodeIndex} active={activeField === 'aim'} onSelect={() => setActiveField('aim')} />}
    {selected && shot.path && (st.editAim ? ['aimIn', 'aimOut'] as const : ['in', 'out'] as const).map((field) => <PathHandle key={field} shotIndex={shotIndex} nodeIndex={nodeIndex} field={field} active={activeField === field} onSelect={() => setActiveField(field)} />)}
  </>
}

function CameraPipe({ samples, index }: { samples: CameraSample[]; index: number }) {
  const st = useStudio(), shot = st.cfg.shots[index]
  const camera = useThree((s) => s.camera)
  const control = useThree((s) => s.controls) as OrbitImpl | null
  const selected = st.sel?.kind === 'shot' && st.sel.index === index
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const dragging = useRef<string | null>(null)
  const normal = useMemo(() => new THREE.Vector3(), [])
  const plane = useMemo(() => new THREE.Plane(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const points = useMemo(() => samples.map((s) => s.position), [samples])
  const vectors = useMemo(() => points.map((p) => new THREE.Vector3(...p)), [points])
  const segments = useMemo(() => [...new Set(samples.map((s) => s.segment))].map((segment) => {
    const matching = samples.filter((s) => s.segment === segment)
    return {
      segment,
      id: shot.path?.segments[segment].id ?? 'linear',
      start: matching[0].time,
      end: matching[matching.length - 1].time,
    }
  }), [samples, shot.path])
  const curve = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>()
    for (let i = 1; i < vectors.length; i++) path.add(new THREE.LineCurve3(vectors[i - 1], vectors[i]))
    return path
  }, [vectors])
  const geometry = useMemo(() => {
    const g = new THREE.TubeGeometry(curve, points.length - 1, selected ? 0.085 : 0.065, 8, false)
    const colours = new Float32Array(g.attributes.position.count * 3)
    const fastest = Math.max(...samples.map((s) => s.speed), 0.001)
    const colour = new THREE.Color(), slow = new THREE.Color('#4a9bc0'), fast = new THREE.Color('#f29a45')
    for (let ring = 0; ring < samples.length; ring++) {
      colour.copy(slow).lerp(fast, samples[ring].speed / fastest)
      for (let side = 0; side <= 8; side++) colour.toArray(colours, (ring * 9 + side) * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3))
    return g
  }, [curve, samples, selected])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    const cancel = () => {
      if (!dragging.current) return
      dragging.current = null
      if (control && !useStudio.getState().gizmoDragging) control.enabled = true
      setRatios({})
    }
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => { window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); cancel() }
  }, [control])

  const timeAt = (id: string, start: number, end: number) => start + (end - start) * (ratios[id] ?? 0.5)
  const updateFraction = (e: ThreeEvent<PointerEvent>, id: string, segmentIndex: number, start: number, end: number) => {
    const handlePosition = sampleShot(shot, timeAt(id, start, end)).position
    camera.getWorldDirection(normal)
    plane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(...handlePosition))
    if (!e.ray.intersectPlane(plane, hit)) return
    let best = 0.5, distance = Infinity
    const closest = new THREE.Vector3(), segment = new THREE.Vector3(), offset = new THREE.Vector3()
    for (let i = 0; i < vectors.length - 1; i++) {
      if (samples[i].segment !== segmentIndex || samples[i + 1].segment !== segmentIndex) continue
      segment.subVectors(vectors[i + 1], vectors[i])
      const length = segment.lengthSq()
      const t = length ? THREE.MathUtils.clamp(offset.subVectors(hit, vectors[i]).dot(segment) / length, 0, 1) : 0
      closest.copy(vectors[i]).addScaledVector(segment, t)
      const d = closest.distanceToSquared(hit)
      if (d < distance) {
        distance = d
        best = (samples[i].time + (samples[i + 1].time - samples[i].time) * t - start) / (end - start)
      }
    }
    const fraction = THREE.MathUtils.clamp(best, 0.01, 0.99)
    setRatios((current) => ({ ...current, [id]: fraction }))
  }
  const down = (event: ThreeEvent<PointerEvent>, id: string) => {
    event.stopPropagation(); event.nativeEvent.preventDefault()
    dragging.current = id
    if (control) control.enabled = false
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }
  const up = (event: ThreeEvent<PointerEvent>, id: string, start: number, end: number) => {
    event.stopPropagation()
    if (dragging.current !== id) return
    dragging.current = null
    if (control) control.enabled = true
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
    const state = useStudio.getState(), original = state.cfg.shots[index]
    const time = start + (end - start) * (ratios[id] ?? 0.5)
    const info = sampleShot(original, time)
    const path = original.path ?? pathFromShot(original)
    const nodeIndex = original.path ? original.path.segments[info.segment].to : 1
    const next = splitCameraPath(path, info.segment, info.u)
    state.edit((cfg) => { cfg.shots[index].path = next; cfg.shots[index].duration = original.duration })
    state.set({ sel: { kind: 'shot', index, node: nodeIndex }, cameraEnd: false, playing: false, t: shotStart(index) + time })
    setRatios({})
  }
  const select = () => st.set({ sel: { kind: 'shot', index, node: 0 }, cameraEnd: false, playing: false, t: shotStart(index) })
  return <group>
    <mesh geometry={geometry} renderOrder={10} onPointerDown={(e) => { e.stopPropagation(); select() }}>
      <meshBasicMaterial vertexColors transparent opacity={selected ? 1 : 0.8} depthTest={false} depthWrite={false} /></mesh>
    {segments.map(({ id, segment, start, end }) => <group key={id} position={sampleShot(shot, timeAt(id, start, end)).position}>
      <mesh renderOrder={20} onPointerDown={(e) => down(e, id)}
        onPointerMove={(e) => { if (dragging.current === id) updateFraction(e, id, segment, start, end) }}
        onPointerUp={(e) => up(e, id, start, end)}>
        <sphereGeometry args={[0.38, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} /></mesh>
      <mesh><sphereGeometry args={[0.14, 12, 8]} /><meshBasicMaterial color="#70d5a1" depthTest={false} depthWrite={false} /></mesh>
      <Html label="＋" className="st-add-point-label" title="Drag inside this segment to insert a point" passThrough />
    </group>)}
  </group>
}

function CameraRails() {
  const cfg = useStudio((s) => s.cfg), paths = useMemo(() => cameraPaths(cfg), [cfg])
  let number = 0
  const points = cfg.shots.flatMap((shot, shotIndex) => Array.from({ length: shotPointCount(shot) }, (_, nodeIndex) => ({ shotIndex, nodeIndex, number: ++number })))
  return <group>
    {paths.map((samples, i) => {
      const shot = cfg.shots[i], first = samples[0].position, last = samples[samples.length - 1].position
      if (first.every((n, k) => n === last[k]) && !shot.path) return null
      return <CameraPipe key={i} samples={samples} index={i} />
    })}
    {points.map((p) => <CameraPoint key={`${p.shotIndex}-${p.nodeIndex}`} {...p} />)}
  </group>
}

type PositionedCue = Extract<Cue, { action: 'entity' | 'sfx' }>
function EffectPosition({ cue, index }: { cue: PositionedCue; index: number }) {
  const st = useStudio(), selected = st.sel?.kind === 'cue' && st.sel.index === index
  const value: Vec3 = cue.position ?? [0, 0, 0], colour = cue.action === 'entity' ? '#c98698' : '#77a9d2'
  const select = () => st.set({ sel: { kind: 'cue', index }, t: cue.at, playing: false })
  const change = (v: Vec3) => useStudio.getState().change((c) => {
    const next = c.cues[index]
    if (next.action === 'entity' || next.action === 'sfx') next.position = v
  })
  return selected ? <DragTransform value={value} onChange={change}><Marker color={colour} /></DragTransform>
    : <group position={value} onPointerDown={(e) => { e.stopPropagation(); select() }}><Marker color={colour} scale={0.65} /></group>
}
function EffectMarkers() {
  const cues = useStudio((s) => s.cfg.cues)
  return <>{cues.flatMap((cue, i) => cue.action === 'entity' || cue.action === 'sfx' ? [<EffectPosition key={i} cue={cue} index={i} />] : [])}</>
}

function LiveFilmCamera() {
  const marker = useRef<THREE.Group>(null!)
  useFrame(() => {
    marker.current.position.set(cam.px, cam.py, cam.pz)
    marker.current.lookAt(cam.lx, cam.ly, cam.lz)
    if (cam.roll) marker.current.rotateZ(cam.roll)
  })
  return <group ref={marker} renderOrder={20}><mesh><boxGeometry args={[0.3, 0.18, 0.4]} /><meshBasicMaterial color="#65d6c4" depthTest={false} /></mesh>
    <mesh position={[0, 0, -0.3]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.07, 0.1, 0.22, 12]} /><meshBasicMaterial color="#b8fff2" depthTest={false} /></mesh></group>
}

const NAV_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'])
export function StudioRig() {
  const guides = useStudio((s) => s.guides)
  const view = useStudio((s) => s.view)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const orbitControls = useMemo(() => {
    const c = new OrbitImpl(camera)
    c.enableDamping = false; c.enableZoom = false; c.screenSpacePanning = true
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }
    return c
  }, [])
  const setScene = useThree((s) => s.set)
  const getScene = useThree((s) => s.get)
  const controls = useRef(orbitControls), keys = useRef(new Set<string>())
  const perspective = useRef(camera as THREE.PerspectiveCamera)
  const sceneId = useStudio((s) => s.sceneId)
  const frameOverview = () => {
    activeDirectorView()
    const active = perspective.current
    const { target } = directorOverview(active, useStudio.getState().cfg)
    active.up.set(0, 1, 0)
    active.lookAt(...target)
    pivot.current.set(...target)
    controls.current.target.copy(pivot.current)
    controls.current.update()
    useStudio.getState().set({ view: 'orbit', camera: active, target: pivot.current })
  }
  const framePoint = (number: number | undefined = currentCameraPoint().number, includeNext = false) => {
    const st = useStudio.getState()
    if (st.exporting) return
    const point = cameraPointFromNumber(number)
    selectCameraPoint(point.index, point.node)
    const shot = st.cfg.shots[point.index]
    const sample = getCameraPoint(shot, point.node)
    numberBuffer.current = ''
    clearTimeout(numberTimer.current)
    activeDirectorView()
    const active = perspective.current
    active.up.set(0, 1, 0)
    const next = includeNext && point.number < cameraPointTotal(st.cfg.shots) ? cameraPointFromNumber(point.number + 1) : undefined
    const target: Vec3 = next
      ? directorFramePoints(active, [sample.position, getCameraPoint(st.cfg.shots[next.index], next.node).position]).target
      : sample.aim
    if (!next) { active.fov = shot.fov; active.position.set(...sample.position) }
    active.lookAt(...target)
    active.updateProjectionMatrix()
    pivot.current.set(...target)
    controls.current.target.copy(pivot.current)
    controls.current.update()
    st.set({ view: 'orbit', camera: active, target: pivot.current })
  }
  useEffect(() => {
    const frame = requestAnimationFrame(frameOverview)
    return () => cancelAnimationFrame(frame)
  }, [sceneId])
  const orthographic = useMemo(() => new THREE.OrthographicCamera(), [])
  const pivot = useRef(new THREE.Vector3(0, 1, -4))
  const numberBuffer = useRef(''), numberTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const move = useMemo(() => new THREE.Vector3(), [])
  const forward = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const renderCamera = (next: THREE.PerspectiveCamera | THREE.OrthographicCamera) => { controls.current.object = next; setScene({ camera: next }) }
  const cameraPointTotal = (shots: Shot[]) => shots.reduce((sum, shot) => sum + shotPointCount(shot), 0)
  const activeDirectorView = () => { renderCamera(perspective.current); useStudio.getState().set({ view: 'orbit' }) }

  useEffect(() => {
    controls.current.connect(gl.domElement)
    const previous = getScene().controls
    setScene({ controls: controls.current })
    return () => { controls.current.dispose(); setScene({ controls: previous }) }
  }, [gl, getScene, setScene])

  useEffect(() => {
    const dom = gl.domElement
    let pending: { x: number; y: number; mode: AxisView } | null = null
    const finish = () => {
      pending = null
      const control = controls.current
      control.object = getScene().camera
      control.enableRotate = useStudio.getState().view === 'orbit'
    }
    const freeDrag = (event: PointerEvent) => {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const mode = useStudio.getState().view
      if (mode === 'orbit' || useStudio.getState().gizmoDragging) return
      if (getScene().scene.getObjectsByProperty('isTransformControls', true).some((o) => (o as { axis?: string | null }).axis)) return
      const control = controls.current
      const focus = control.target.clone()
      const direction = orthographic.position.clone().sub(focus).normalize()
      // Escape the polar singularity so vertical-view drags can orbit immediately.
      if (mode === 'top' || mode === 'bottom') {
        direction.z = (mode === 'top' ? -1 : 1) * Math.sin(0.18)
        direction.y *= Math.cos(0.18)
      }
      const distance = (orthographic.top / orthographic.zoom) / Math.tan(THREE.MathUtils.degToRad(perspective.current.fov / 2))
      perspective.current.up.set(0, 1, 0)
      perspective.current.position.copy(focus).addScaledVector(direction, distance)
      perspective.current.lookAt(focus)
      pending = { x: event.clientX, y: event.clientY, mode }
      control.object = perspective.current
      control.enableRotate = true
      control.setPolarAngle(Math.acos(THREE.MathUtils.clamp(direction.y, -1, 1)))
    }
    const beginDrag = (event: PointerEvent) => {
      if (!pending) return
      if (!controls.current.enabled || useStudio.getState().gizmoDragging || useStudio.getState().view !== pending.mode || controls.current.object !== perspective.current) { finish(); return }
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 4) return
      renderCamera(perspective.current)
      useStudio.getState().set({ view: 'orbit' })
      pending = null
    }
    dom.addEventListener('pointerdown', freeDrag, true)
    window.addEventListener('pointermove', beginDrag, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', finish, true)
    return () => {
      finish()
      dom.removeEventListener('pointerdown', freeDrag, true)
      window.removeEventListener('pointermove', beginDrag, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', finish, true)
    }
  }, [gl, getScene, orthographic, setScene])

  useEffect(() => {
    const unsubscribe = useStudio.subscribe((s) => {
      if (controls.current) controls.current.enabled = !s.gizmoDragging
    })
    const cancel = () => { if (useStudio.getState().gizmoDragging) useStudio.getState().set({ gizmoDragging: false }) }
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => { unsubscribe(); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel) }
  }, [])

  useEffect(() => {
    if (view === 'orbit') {
      renderCamera(perspective.current)
    } else {
      const control = controls.current
      const focus = selectedFocusPoint() ?? control?.target.toArray() as Vec3 | undefined ?? pivot.current.toArray() as Vec3
      frameAxisView(orthographic, view, focus, size.width / size.height)
      pivot.current.set(...focus)
      renderCamera(orthographic)
      if (control) { control.target.copy(pivot.current); control.enableRotate = false }
    }
  }, [view, size.width, size.height, setScene, orthographic])

  useEffect(() => {
    cam.free = false
    const control = controls.current
    if (control) {
      control.target.copy(pivot.current)
      control.enableRotate = view === 'orbit'
      control.update()
    }
    useStudio.getState().set({ camera, target: control?.target ?? pivot.current })
  }, [camera, view])

  useEffect(() => {
    const viewKeys: Record<string, AxisView> = { KeyT: 'top', KeyB: 'bottom', KeyL: 'left', KeyR: 'right' }
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,select,textarea')) return
      if (e.metaKey || e.ctrlKey) return
      if (NAV_KEYS.has(e.code)) keys.current.add(e.code)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        numberBuffer.current = (numberBuffer.current + e.key).slice(-2)
        clearTimeout(numberTimer.current)
        numberTimer.current = setTimeout(() => { selectPointNumber(Number(numberBuffer.current)); numberBuffer.current = '' }, 350)
      } else { numberBuffer.current = ''; clearTimeout(numberTimer.current) }
      const control = controls.current
      const active = getScene().camera
      if (viewKeys[e.code]) {
        e.preventDefault()
        useStudio.getState().set({ view: viewKeys[e.code] })
      }
      if (e.code === 'Home') {
        e.preventDefault()
        frameOverview()
        return
      }
      if (e.code === 'KeyG') {
        e.preventDefault()
        framePoint(undefined, e.shiftKey)
        return
      }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        e.preventDefault()
        const current = currentCameraPoint().number, total = cameraPointTotal(useStudio.getState().cfg.shots)
        const next = Math.max(1, Math.min(total, current + (e.code === 'BracketRight' ? 1 : -1)))
        if (next !== current) framePoint(next)
        return
      }
      if (e.code === 'KeyF') {
        e.preventDefault()
        const point = selectedFocusPoint() ?? [cam.px, cam.py, cam.pz] as Vec3
        pivot.current.set(...point)
        const mode = useStudio.getState().view
        if (mode === 'orbit') {
          const offset = active.position.clone().sub(control?.target ?? pivot.current)
          if (offset.lengthSq() < 1e-12) offset.set(4, 3, 6)
          offset.normalize().multiplyScalar(6)
          active.position.copy(pivot.current).add(offset)
          renderCamera(active)
        } else {
          frameAxisView(orthographic, mode, point, size.width / size.height)
          renderCamera(orthographic)
        }
        control?.target.copy(pivot.current)
      }
      control?.update()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => { keys.current.clear(); numberBuffer.current = ''; clearTimeout(numberTimer.current) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur)
      clearTimeout(numberTimer.current)
    }
  }, [getScene, setScene, orthographic, size.width, size.height])

  useEffect(() => {
    const dom = gl.domElement
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopImmediatePropagation()
      const control = controls.current
      if (!control) return
      const camera = getScene().camera, navSpeed = useStudio.getState().navSpeed
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? dom.clientHeight : 1
      if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = Math.max(0.0001, camera.zoom * (1 - event.deltaY * unit * 0.0005 * navSpeed))
        camera.updateProjectionMatrix()
      } else {
        camera.getWorldDirection(forward)
        freeDolly(camera.position, control.target, forward, event.deltaY * unit, navSpeed)
        control.update()
      }
    }
    dom.addEventListener('wheel', wheel, { passive: false, capture: true })
    return () => dom.removeEventListener('wheel', wheel, { capture: true })
  }, [getScene, gl, forward])

  useFrame((state, dt) => {
    if (import.meta.env.DEV) Object.assign(window, { studioR3f: state, studioState: useStudio })
    const control = controls.current
    if (!control) return
    const camera = state.camera
    pivot.current.copy(control.target)
    const speed = useStudio.getState().navSpeed
    control.panSpeed = camera instanceof THREE.OrthographicCamera ? speed : THREE.MathUtils.clamp(12 * speed / Math.max(camera.position.distanceTo(control.target), 0.05), 0.15, 50)
    const k = keys.current
    if (!k.size) return
    camera.getWorldDirection(forward)
    right.crossVectors(forward, camera.up).normalize()
    move.set(0, 0, 0)
    if (k.has('KeyW')) move.add(forward)
    if (k.has('KeyS')) move.sub(forward)
    if (k.has('KeyD')) move.add(right)
    if (k.has('KeyA')) move.sub(right)
    if (k.has('KeyE')) move.y += 1
    if (k.has('KeyQ')) move.y -= 1
    if (!move.lengthSq()) return
    move.normalize().multiplyScalar(dt * 4 * speed * (k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1))
    camera.position.add(move); control.target.add(move); control.update()
  })

  return <>{guides && <><CameraRails /><EffectMarkers /><LiveFilmCamera /></>}</>
}
