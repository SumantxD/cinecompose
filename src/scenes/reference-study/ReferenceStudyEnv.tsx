import { useEffect, useMemo, useRef, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { clock } from '../../cinematic/clock'
import type { Shot } from '../../cinematic/types'
import type { EnvironmentProps } from '../registry'
import type { ChoreographyPlan, VisualBeat } from '../../cinematic/choreography'
import { FogSystem } from '../../components/FogSystem'
import { ModelInstances } from '../../components/ModelInstances'
import { rng } from '../../utils/random'

function Projection({ shots, enabled }: { shots: Shot[]; enabled: boolean }) {
  const urls = useMemo(() => shots.map((shot) => shot.reference!.url), [shots])
  const textures = useTexture(urls)
  const group = useRef<THREE.Group>(null), current = useRef<THREE.Mesh>(null), previous = useRef<THREE.Mesh>(null)
  const layers = useMemo(() => {
    const starts = shots.reduce<number[]>((a, _shot, i) => (a.push((a[i - 1] ?? 0) + (shots[i - 1]?.duration ?? 0)), a), [])
    const panels = shots.map((shot) => {
      const from = new THREE.Vector3(...(shot.from ?? [4.2, 1.7, 5])), to = new THREE.Vector3(...(shot.lookAt ?? shot.lookAtTo ?? [-.4, 1.62, -1.8]))
      const position = from.clone().add(to.clone().sub(from).normalize().multiplyScalar(8))
      return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(from, position, new THREE.Vector3(0, 1, 0))) }
    })
    return { starts, panels, direction: new THREE.Vector3() }
  }, [shots])
  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
    })
  }, [textures])
  useFrame(({ camera }) => {
    if (!group.current || !current.current || !previous.current) return
    group.current.visible = enabled
    if (!enabled) return
    const { starts, panels } = layers
    let index = shots.length - 1
    for (let i = 0; i < shots.length; i++) if (clock.t < starts[i] + shots[i].duration) { index = i; break }
    const shot = shots[index], ref = shot.reference!, panel = panels[index]
    group.current.position.copy(panel.position); group.current.quaternion.copy(panel.quaternion)
    const perspective = camera as THREE.PerspectiveCamera
    const height = 8 * 2 * Math.tan((perspective.fov ?? 50) * Math.PI / 360)
    const image = textures[index].image as { width?: number; height?: number } | undefined
    const aspect = (image?.width ?? 324) / (image?.height ?? 576)
    group.current.scale.set(height * aspect, height, 1)
    const last = Math.max(0, index - 1), blend = ref.transition === 'dissolve' ? THREE.MathUtils.clamp((clock.t - starts[index]) / Math.min(.16, shot.duration * .35), 0, 1) : 1
    const a = current.current.material as THREE.MeshBasicMaterial, b = previous.current.material as THREE.MeshBasicMaterial
    a.map = textures[index]; a.opacity = blend; a.needsUpdate = true
    b.map = textures[last]; b.opacity = 1 - blend; b.needsUpdate = true
    previous.current.visible = blend < 1
  })
  return <group ref={group} name="reference-projection">
    <mesh ref={previous} renderOrder={-101} position={[0, 0, -.002]}><planeGeometry args={[1, 1]} /><meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} fog={false} /></mesh>
    <mesh ref={current} renderOrder={-100}><planeGeometry args={[1, 1]} /><meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} fog={false} /></mesh>
  </group>
}

function ClockFace({ plan }: { plan?: ChoreographyPlan }) {
  const minute = useRef<THREE.Group>(null), hour = useRef<THREE.Group>(null)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#c4bea4'; ctx.fillRect(0, 0, 256, 256)
    ctx.strokeStyle = '#353b34'; ctx.lineWidth = 3
    for (let n = 0; n < 12; n++) {
      const a = n / 12 * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(128 + Math.sin(a) * 111, 128 - Math.cos(a) * 111); ctx.lineTo(128 + Math.sin(a) * 101, 128 - Math.cos(a) * 101); ctx.stroke()
    }
    return new THREE.CanvasTexture(canvas)
  }, [])
  useEffect(() => { texture.colorSpace = THREE.SRGBColorSpace; return () => texture.dispose() }, [texture])
  useFrame(() => {
    const stop = plan?.beats.find((beat) => beat.visual === 'clock-stop')
    const t = stop ? Math.min(clock.t, stop.at + stop.duration * .35) : clock.t
    if (minute.current) minute.current.rotation.z = -t * .02
    if (hour.current) hour.current.rotation.z = -.7 - t * .003
  })
  return <group position={[-2.65, 2.45, -2.55]}>
    <mesh><circleGeometry args={[.43, 40]} /><meshStandardMaterial map={texture} roughness={.8} /></mesh>
    <mesh position={[0, 0, -.012]}><ringGeometry args={[.42, .47, 40]} /><meshStandardMaterial color="#363c37" metalness={.55} roughness={.45} /></mesh>
    <group position={[0, 0, .015]} ref={minute}><mesh position={[0, .13, 0]}><planeGeometry args={[.014, .28]} /><meshBasicMaterial color="#28332f" /></mesh></group>
    <group position={[0, 0, .018]} ref={hour}><mesh position={[.09, 0, 0]}><planeGeometry args={[.2, .02]} /><meshBasicMaterial color="#28332f" /></mesh></group>
    <mesh position={[0, 0, .02]}><circleGeometry args={[.023, 12]} /><meshBasicMaterial color="#aa5438" /></mesh>
  </group>
}

function paintScreen(texture: THREE.CanvasTexture, mode: VisualBeat, seed: number) {
  const ctx = (texture.image as HTMLCanvasElement).getContext('2d')!, random = rng(seed)
  ctx.fillStyle = mode === 'signal-lost' ? '#020607' : '#162b2d'; ctx.fillRect(0, 0, 256, 144)
  if (mode !== 'signal-lost') {
    ctx.strokeStyle = '#52817a'; ctx.lineWidth = 1
    for (let i = 0; i < 32; i++) { const y = random() * 144; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + random() * 10); ctx.stroke() }
  }
  if (mode === 'monitor-figure') {
    ctx.fillStyle = '#72847a'; ctx.beginPath(); ctx.arc(128, 59, 16, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(128, 126, 42, 52, 0, Math.PI, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#a2b29d'; ctx.font = '12px monospace'; ctx.fillText('SIGNAL UNVERIFIED', 60, 23)
  } else if (mode === 'clock-stop') {
    ctx.fillStyle = '#a69c73'; ctx.font = '18px monospace'; ctx.fillText('CLOCK: HALTED', 50, 78)
  } else if (mode === 'normal') {
    ctx.fillStyle = '#8da493'; ctx.font = '16px monospace'; ctx.fillText('CAMERA SIGNAL', 18, 28); ctx.fillText('NO INPUT', 18, 120)
  }
  texture.needsUpdate = true
}

function screenTexture(seed: number) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 144
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace; texture.name = `monitor-feed-${seed}`
  paintScreen(texture, 'normal', seed)
  return texture
}

function ControlRoom({ plan }: { plan?: ChoreographyPlan }) {
  const screen = useMemo(() => screenTexture(38), [])
  const alternate = useMemo(() => screenTexture(39), [])
  const screenMeshes = useRef<(THREE.Mesh | null)[]>([])
  useEffect(() => () => { screen.dispose(); alternate.dispose() }, [screen, alternate])
  const lastVisual = useRef('')
  useFrame(() => {
    const beat = [...(plan?.beats ?? [])].reverse().find((beat) => beat.at <= clock.t)
    const mode = beat?.visual ?? 'normal'
    const target = beat?.screen === 'left' ? 0 : beat?.screen === 'right' ? 2 : 1
    const key = `${mode}:${target}`
    if (key === lastVisual.current) return
    lastVisual.current = key
    paintScreen(screen, mode === 'monitor-figure' || mode === 'signal-lost' ? 'normal' : mode, 38)
    paintScreen(alternate, mode, 39)
    screenMeshes.current.forEach((mesh, index) => {
      const material = mesh?.material as THREE.MeshStandardMaterial | undefined
      const targeted = mode === 'monitor-figure' || mode === 'signal-lost'
      if (material && material.map !== (targeted && index === target ? alternate : screen)) {
        material.map = targeted && index === target ? alternate : screen
        material.needsUpdate = true
      }
    })
  })
  return <group name="control-room">
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1]} receiveShadow><planeGeometry args={[11, 15]} /><meshStandardMaterial color="#424c45" roughness={.94} /></mesh>
    <mesh position={[0, 1.9, -3.1]} receiveShadow><boxGeometry args={[8, 3.8, .14]} /><meshStandardMaterial color="#4d5545" roughness={.94} /></mesh>
    {[-3.6, 3.6].map((x) => <mesh key={x} position={[x, 1.9, 0]}><boxGeometry args={[.14, 3.8, 7]} /><meshStandardMaterial color="#3c4946" roughness={.95} /></mesh>)}
    <ClockFace plan={plan} />
    {[-2, -1, 0].map((x, index) => <group key={x} position={[x - 1.3, 1.9, -2.9]}>
      <RoundedBox args={[.83, .66, .2]} radius={.035} smoothness={2}><meshStandardMaterial color="#2a3432" roughness={.72} metalness={.18} /></RoundedBox>
      <mesh ref={(mesh) => { screenMeshes.current[index] = mesh }} name={['monitor-screen-left', 'monitor-screen-center', 'monitor-screen-right'][index]} position={[0, .02, .104]}><planeGeometry args={[.65, .46]} /><meshStandardMaterial map={screen} color="#7d9a8d" emissive="#163031" emissiveIntensity={.45} roughness={.7} /></mesh>
    </group>)}
    <group position={[1.7, .7, .8]} rotation={[-.08, -.2, 0]}>
      <RoundedBox args={[2.5, .16, 1.08]} radius={.04} smoothness={2} castShadow><meshStandardMaterial color="#404c48" roughness={.66} metalness={.5} /></RoundedBox>
      {[-.55, 0, .55].map((x, i) => <mesh key={x} position={[x, .095, .19]} castShadow><cylinderGeometry args={[.105, .105, .045, 18]} /><meshStandardMaterial color={['#5c7163', '#ad7d3f', '#824e45'][i]} roughness={.48} metalness={.22} /></mesh>)}
      {[-.88, .88].map((x) => <RoundedBox key={x} args={[.095, .68, .095]} position={[x, -.38, 0]} radius={.025}><meshStandardMaterial color="#293632" metalness={.45} roughness={.6} /></RoundedBox>)}
    </group>
    <ModelInstances id="brass_diya_lantern" placements={[{ x: -.55, y: .79, z: .68, height: .2, rotation: .5 }]} castShadow={false} />
    <pointLight name="study-lamp" color="#f0b975" intensity={2.4} distance={4} position={[-.55, 1.09, .68]} />
  </group>
}

/** Reference projection plus authored set. Placeholders are local-only and remain replaceable. */
export function ReferenceStudyEnv({ lighting, scene }: EnvironmentProps) {
  const study = scene.props?.referenceStudy
  const showPlaceholders = study?.showPlaceholders !== false
  return <group name="reference-study">
    <FogSystem color={lighting.fogColor ?? '#202b2b'} density={lighting.fogDensity} skyDome={false} />
    <ambientLight intensity={lighting.ambientIntensity * 1.4} color="#b1bcb2" />
    <Suspense fallback={null}>{study && <Projection shots={scene.shots} enabled={showPlaceholders} />}</Suspense>
    <ControlRoom plan={scene.props?.choreography} />
    <directionalLight color="#b1c5bf" intensity={lighting.moon ?? .5} position={[-2, 4, 4]} />
    {scene.environment === 'control-room' && <pointLight name="monitor-fill" color="#adccc4" intensity={6} distance={7} position={[-2.1, 2.5, -1.4]} />}
  </group>
}
