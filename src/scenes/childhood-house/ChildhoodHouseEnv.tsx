import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FogSystem } from '../../components/FogSystem'
import { ForestEnvironment, forestFloor } from '../../components/ForestEnvironment'
import { RoadsideNature } from '../../components/RoadsideNature'
import { RainSystem } from '../../components/RainSystem'
import { FlickeringLight } from '../../components/FlickeringLight'
import { Entity } from '../../components/Entity'
import { Actor } from '../../components/Actor'
import { useStore } from '../../state/store'
import { clock } from '../../cinematic/clock'
import { ground } from '../../utils/textures'
import { CassettePlayer, CeilingFan, Diary, FamilyPhoto, Kettle, Slats, WallClock, WoodenHorse, WoodBox, periodMaterial } from '../../components/DomesticProps'
import type { EnvironmentProps } from '../registry'
import { Grounded } from '../../components/Placement'
import { practicalIntensity } from '../../cinematic/lighting'
import { loadSurfacePack } from '../../components/SurfaceTextures'

// Light ids: porch_tube, corridor_tube, room_candle, window_blue. Entities: aarav, chudail, diary.
const clear = (x: number, z: number) => Math.abs(z) > 9 && !(x > -7 && x < 7 && z > -15 && z < 12)
const GROUND = 0.176
const TABLE_TOP = 0.848
const CEILING_BOTTOM = 2.91 - 0.06
const porchHeight = (x: number, z: number) => {
  if (Math.abs(x) > 1.2 || z > 8.34) return 0
  if (z > 7.98) return 0.053
  if (z > 7.62) return 0.106
  if (z > 7.4) return 0.159
  return GROUND
}

function Door({ position }: { position: [number, number, number] }) {
  const wood = periodMaterial('wood', '#594438'), iron = periodMaterial('metal', '#746b54')
  return <group position={position}>
    {[-0.75, 0.75].map(x => <WoodBox key={x} position={[x, 1.33, 0]} size={[0.14, 2.66, 0.2]} material={wood} />)}
    <WoodBox position={[0, 2.6, 0]} size={[1.64, 0.14, 0.2]} material={wood} />
    <group position={[-0.68, 0, 0]} rotation-y={Math.PI * 0.52}>
      <WoodBox position={[0.66, 1.28, 0]} size={[1.29, 2.47, 0.065]} material={wood} />
      {[0.55, 1.72].map(y => <WoodBox key={y} position={[0.66, y, 0.043]} size={[0.99, 0.65, 0.035]} material={wood} />)}
      {[0.29, 2.1].map(y => <WoodBox key={y} position={[0.66, y, 0.068]} size={[1.18, 0.08, 0.035]} material={wood} />)}
      <mesh position={[1.15, 1.28, 0.11]} material={iron}><sphereGeometry args={[0.035, 10, 8]} /></mesh>
    </group>
  </group>
}

function DiaryOnTable({ paperBurn }: { paperBurn?: { at: number; duration: number } }) {
  const visible = useStore(s => s.entities.diary?.visible ?? true)
  return <group position={[0.85, 0, -8.7]} visible={visible}><Grounded name='diary' position={[0, 0, 0]} floor={TABLE_TOP}><Diary position={[0, 0, 0]} paperBurn={paperBurn} /></Grounded></group>
}

function IndoorRain({ low, scene }: { low: boolean; scene: EnvironmentProps['scene'] }) {
  if (scene.props?.rain?.enabled === false) return null
  return <RainSystem count={scene.props?.rain?.count || (low ? 2600 : 4800)} splashes={low ? 220 : 430} box={[22, 10, 24]} shelter={{ center: [0, -2], size: [7.4, 21.2], height: CEILING_BOTTOM - 0.03 }} wind={scene.props?.rain?.wind} />
}

function Fan() {
  const ref = useRef<THREE.Group>(null!)
  useFrame(() => { ref.current.rotation.y = clock.t * 1.2 })
  return <group ref={ref} position={[0, 2.7, -4.2]}><CeilingFan position={[0, 0, 0]} /></group>
}

function Flame() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(() => {
    ref.current.scale.y = 1 + Math.sin(clock.t * 13) * 0.08
    ref.current.rotation.z = Math.sin(clock.t * 9) * 0.06
  })
  return <group position={[0.84, 1.035, -8.68]}>
    <mesh material={periodMaterial('cloth', '#705b39')}><cylinderGeometry args={[0.06, 0.04, 0.038, 12]} /></mesh>
    <mesh ref={ref} position={[0, 0.037, 0]} scale={[0.65, 1.4, 0.65]}>
      <sphereGeometry args={[0.025, 10, 8]} /><meshBasicMaterial color='#c17b38' toneMapped={false} />
    </mesh>
  </group>
}

function Footprints() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    for (let i = 0; i < 12; i++) {
      dummy.position.set(0.08 + (i % 2 ? 0.16 : 0.02), GROUND + 0.004, 8.2 - i * 0.38)
      dummy.scale.set(0.1, 0.006, 0.21); dummy.updateMatrix(); ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [dummy])
  return <instancedMesh ref={ref} args={[undefined, undefined, 12]} material={periodMaterial('metal', '#192522')}>
    <sphereGeometry args={[0.5, 10, 6]} />
  </instancedMesh>
}

export function ChildhoodHouseEnv({ lighting, scene }: EnvironmentProps) {
  useEffect(() => { void loadSurfacePack(['wood', 'plaster']) }, [])
  const low = useStore(s => s.quality === 'low')
  const hasHorse = useStore(s => !!s.flags.entered_bedroom)
  const roomHorse = useStore(s => s.entities.horse?.visible ?? true)
  const carrying = scene.props?.horse === 'carried' || (scene.props?.horse === 'inventory' && hasHorse) || (scene.props?.horse === 'room' && !roomHorse)
  const plaster = periodMaterial('plaster', '#847d70'), dado = periodMaterial('plaster', '#615a4d'), wood = periodMaterial('wood', '#65513c')
  const roof = Array.from({ length: 30 }, (_, i) => ({ position: [-3.5 + i * 0.24, 2.92, 6.2] as [number, number, number], scale: [0.028, 0.046, 3.8] as [number, number, number] }))
  const corridorBoards = Array.from({ length: 21 }, (_, i) => ({ position: [-1.05 + i * 0.105, GROUND - 0.009, -0.6] as [number, number, number], scale: [0.1, 0.018, 11.2] as [number, number, number] }))
  return <group>
    <FogSystem color={lighting.fogColor ?? '#232b30'} density={lighting.fogDensity} />
    <hemisphereLight args={['#a1aea7', '#30251c', lighting.ambientIntensity]} />
    <ambientLight color='#9eacb8' intensity={lighting.ambientIntensity * 2.5} />
    <directionalLight position={[-6, 9, 9]} color='#8ba5b7' intensity={lighting.moon ?? 0.24} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[65, 65]} /><meshStandardMaterial map={ground(18)} roughness={0.8} /></mesh>
    <ForestEnvironment clear={clear} trees={low ? 18 : 30} bushes={low ? 24 : 44} grass={low ? 90 : 200} />
    <RoadsideNature clear={clear} heightAt={(x, z) => forestFloor(() => 0, x, z)} seed={23} density={.7} zMin={-26} zMax={26} />
    <IndoorRain low={low} scene={scene} />
    <WoodBox position={[0, 0.08, -1.5]} size={[6.8, 0.16, 18]} material={dado} />
    {[0, 1, 2].map(step => <WoodBox key={step} position={[0, 0.027 + step * 0.053, 8.1 - step * 0.36]} size={[2.4, 0.052, 0.48]} material={dado} />)}
    {[-3.34, 3.34].map(x => <group key={x}>
      <WoodBox position={[x, 1.54, -2.4]} size={[0.16, 2.75, 11.4]} material={plaster} />
      <WoodBox position={[x, 0.52, -2.4]} size={[0.175, 0.7, 11.4]} material={dado} />
    </group>)}
    <WoodBox position={[0, 2.9, 6.2]} size={[7.4, 0.09, 3.8]} material={periodMaterial('metal', '#5f594b')} />
    <Slats transforms={roof} material={periodMaterial('metal', '#645e51')} />
    {[-3.02, -1.92, 1.92, 3.02].map(x => <mesh key={x} position={[x, 1.51, 7.5]} material={wood} castShadow><cylinderGeometry args={[0.062, 0.078, 2.72, 9]} /></mesh>)}
    <WoodBox position={[0, 0.54, 7.51]} size={[3.8, 1.08, 0.16]} material={plaster} />
    <WoodBox position={[0, 1.11, 7.51]} size={[3.8, 0.07, 0.22]} material={wood} />
    {/* The front door is an actual opening, not a dark rectangle over a wall. */}
    <WoodBox position={[-2.18, 1.54, 5.1]} size={[2.4, 2.75, 0.16]} material={plaster} />
    <WoodBox position={[2.18, 1.54, 5.1]} size={[2.4, 2.75, 0.16]} material={plaster} />
    <WoodBox position={[0, 2.73, 5.1]} size={[2, 0.32, 0.16]} material={plaster} />
    <Door position={[0, GROUND, 5.06]} />
    <Door position={[0, GROUND, -6.5]} />
    <Slats transforms={corridorBoards} material={wood} />
    {[-1.14, 1.14].map(x => <group key={x}>
      <WoodBox position={[x, 1.55, -0.7]} size={[0.14, 2.77, 11.6]} material={plaster} />
      <WoodBox position={[x, 0.52, -0.7]} size={[0.165, 0.7, 11.63]} material={dado} />
    </group>)}
    <WoodBox name='ceiling' position={[0, CEILING_BOTTOM + 0.06, -2.15]} size={[8.2, 0.12, 18.5]} material={wood} />
    <FamilyPhoto id='photo' position={[-1.038, 1.62, 1.0]} rotation={[0, Math.PI / 2, 0]} fourthShadow={scene.sceneId === 'photo_shadow'} />
    <WallClock position={[1.055, 1.98, -2.05]} rotation={[0, -Math.PI / 2, 0]} />
    <WoodBox position={[0, GROUND - 0.06, -9]} size={[4.9, 0.12, 5.1]} material={wood} />
    <WoodBox position={[0, 1.56, -11.52]} size={[4.9, 2.8, 0.16]} material={plaster} />
    {[-2.43, 2.43].map(x => <WoodBox key={x} position={[x, 1.56, -9.03]} size={[0.14, 2.8, 5.0]} material={plaster} />)}
    {/* Bed frame, mattress, pillow, cupboard and a table: an ordinary child's room. */}
    {[-0.5, 0.5].map(x => [-0.99, 0.99].map(z => <WoodBox key={`${x}:${z}`} position={[-1.37 + x, 0.43, -9.2 + z]} size={[0.07, 0.54, 0.07]} material={wood} />))}
    <WoodBox position={[-1.37, 0.53, -9.2]} size={[1.18, 0.12, 2.25]} material={wood} />
    <WoodBox position={[-1.37, 0.65, -9.2]} size={[1.03, 0.15, 2.04]} material={periodMaterial('cloth', '#858a75')} />
    <WoodBox position={[-1.37, 0.78, -10.03]} size={[0.76, 0.16, 0.39]} material={periodMaterial('cloth', '#aaa78d')} />
    <WoodBox position={[-1.37, 0.82, -8.12]} size={[1.18, 0.66, 0.08]} material={wood} />
    <WoodBox position={[1.72, 1.1, -10.85]} size={[0.98, 1.87, 0.65]} material={wood} />
    {[1.39, 1.69].map(x => <WoodBox key={x} position={[x, 1.18, -10.5]} size={[0.3, 1.49, 0.035]} material={periodMaterial('wood', '#57402e')} />)}
    <mesh position={[1.58, 1.18, -10.44]} material={periodMaterial('metal', '#8a856d')}><sphereGeometry args={[0.024, 8, 6]} /></mesh>
    <WoodBox position={[0.85, 0.81, -8.7]} size={[1.05, 0.075, 0.62]} material={wood} />
    {[-0.44, 0.44].map(x => [-0.23, 0.23].map(z => <WoodBox key={`${x}:${z}`} position={[0.85 + x, 0.49, -8.7 + z]} size={[0.045, 0.62, 0.045]} material={wood} />))}
    <DiaryOnTable paperBurn={scene.props?.paperBurn} />
    <Grounded position={[0.43, 0, -8.7]} floor={TABLE_TOP}><CassettePlayer id='cassette' position={[0, 0, 0]} /></Grounded>
    <Kettle position={[-2.55, 0, 7.15]} />
    <Window />
    <Fan />
    <Flame />
    {scene.props?.footprints && <Footprints />}
    {(scene.props?.horse === 'room' || (scene.props?.horse === 'inventory' && !hasHorse)) && <Grounded position={[-0.05, 0, -7.95]} floor={GROUND} visible={roomHorse}><WoodenHorse id='horse' position={[0, 0, 0]} scale={0.58} rotationY={-0.4} /></Grounded>}
    <FlickeringLight id='porch_tube' kind='point' color='#d6f2e4' intensity={5} position={[-1.7, 2.65, 6.5]} distance={12} bulb='tube' glow={0.3} seed={4} />
    <FlickeringLight id='corridor_tube' kind='point' color='#d6f2e4' intensity={practicalIntensity([0, 2.6, 0.7], [0, 1.6, 0.7], 1.5)} position={[0, 2.6, 0.7]} distance={10} bulb='tube' glow={0.38} hum='hum' seed={3} />
    <FlickeringLight id='room_candle' kind='point' color='#ffc080' intensity={practicalIntensity([0.85, 1.17, -8.68], [0.85, 0.89, -8.7], 0.65)} position={[0.85, 1.17, -8.68]} distance={5} glow={0.2} seed={14} />
    <FlickeringLight id='window_blue' kind='point' color='#99b6c4' intensity={practicalIntensity([-1.5, 1.72, -11.3], [-0.7, 1, -10.5], 0.5)} position={[-1.5, 1.72, -11.3]} distance={8} />
    <Entity id='chudail' position={[0, GROUND, -6.8]} />
    <Actor id='aarav' carrying={carrying} steps={['house_exterior', 'road_footsteps'].includes(scene.sceneId) ? 'footstep' : 'footstep_wood'} groundAt={porchHeight} />
  </group>
}

function Window() {
  const wood = periodMaterial('wood', '#56483a')
  return <group position={[-0.65, 1.76, -11.407]}>
    <mesh><planeGeometry args={[0.9, 1.0]} /><meshStandardMaterial color='#355268' roughness={0.4} emissive='#20384a' emissiveIntensity={0.65} /></mesh>
    <WoodBox position={[0, 0.01, 0.025]} size={[0.045, 0.96, 0.035]} material={wood} />
    <WoodBox position={[0, 0.01, 0.028]} size={[0.9, 0.043, 0.035]} material={wood} />
    {[-0.45, 0.45].map(x => <WoodBox key={x} position={[x, 0, 0.025]} size={[0.065, 1.04, 0.05]} material={wood} />)}
    {[-0.5, 0.5].map(y => <WoodBox key={y} position={[0, y, 0.025]} size={[0.97, 0.055, 0.05]} material={wood} />)}
    <mesh position={[0.03, 0.59, 0.01]} rotation={[0.07, 0, 0.045]} material={periodMaterial('cloth', '#2a3335')}><planeGeometry args={[0.29, 0.31]} /></mesh>
  </group>
}
