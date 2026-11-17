import { useEffect } from 'react'
import type { SceneConfig, Vec3 } from '../../cinematic/types'
import { loadSurfacePack } from '../../components/SurfaceTextures'
import { Grounded } from '../../components/Placement'
import { FogSystem } from '../../components/FogSystem'
import { RainSystem } from '../../components/RainSystem'
import { FlickeringLight } from '../../components/FlickeringLight'
import { ForestEnvironment } from '../../components/ForestEnvironment'
import { Entity } from '../../components/Entity'
import { Actor } from '../../components/Actor'
import { useStore } from '../../state/store'
import { OldRadio, CassettePlayer, Kettle, Mirror, Slats, WallCalendar, WoodBox, periodMaterial } from '../../components/DomesticProps'
import { ground } from '../../utils/textures'
import { practicalIntensity } from '../../cinematic/lighting'

// Light ids: stall_tube, mirror_sodium, dawn. Entities: aarav, her_reflection.
const clear = (x: number, z: number) => Math.abs(z) > 7 && !(x > -4 && x < 4 && z > -4 && z < 7)

function ShelterRain({ low }: { low: boolean }) {
  return <RainSystem count={low ? 2200 : 4200} splashes={low ? 250 : 450} box={[16, 9, 18]} shelter={{ center: [0, 0], size: [4.8, 4.7], height: 2.55 }} />
}

function Chair({ position, rotationY = 0 }: { position: Vec3; rotationY?: number }) {
  const wood = periodMaterial('wood', '#63523d')
  return <group position={position} rotation-y={rotationY}>
    <WoodBox position={[0, 0.48, 0]} size={[0.58, 0.065, 0.48]} material={wood} />
    <WoodBox position={[0, 0.82, 0.2]} size={[0.58, 0.3, 0.045]} material={wood} rotation={[-0.08, 0, 0]} />
    {[-1, 1].map(x => [-1, 1].map(z => <WoodBox key={`${x}:${z}`} position={[x * 0.23, 0.24, z * 0.18]} size={[0.038, 0.48, 0.038]} material={wood} />))}
  </group>
}

export function TeaStallEnv({ lighting }: { lighting: SceneConfig['lighting']; scene: SceneConfig }) {
  useEffect(() => { void loadSurfacePack(['wood', 'plaster']) }, [])
  const low = useStore(s => s.quality === 'low')
  const wood = periodMaterial('wood', '#66523d'), plaster = periodMaterial('plaster', '#849187'), tin = periodMaterial('metal', '#5b6561')
  const counter = Array.from({ length: 15 }, (_, i) => ({ position: [-1.68 + i * 0.24, 0.6, -0.2] as Vec3, scale: [0.231, 0.86, 0.045] as Vec3 }))
  const roof = Array.from({ length: 23 }, (_, i) => ({ position: [-2.2 + i * 0.2, 2.58, 0] as Vec3, scale: [0.022, 0.035, 4.7] as Vec3 }))
  return <group>
    <FogSystem color={lighting.fogColor ?? '#242c32'} density={lighting.fogDensity} />
    <hemisphereLight args={['#83928f', '#211c16', lighting.ambientIntensity]} />
    <ambientLight color='#9eacb8' intensity={lighting.ambientIntensity * 2.5} />
    <directionalLight position={[-7, 10, 5]} color='#9baabc' intensity={lighting.moon ?? 0.3} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[70, 70]} /><meshStandardMaterial map={ground(11)} roughness={0.76} />
    </mesh>
    <ForestEnvironment clear={clear} trees={28} bushes={45} grass={180} />
    <ShelterRain low={low} />
    <WoodBox position={[0, 2.55, 0]} size={[4.8, 0.08, 4.7]} material={tin} />
    <Slats transforms={roof} material={tin} />
    <WoodBox position={[0, 1.26, -2.0]} size={[4.7, 2.5, 0.15]} material={plaster} />
    <WoodBox position={[0, 0.38, -1.91]} size={[4.7, 0.76, 0.025]} material={periodMaterial('plaster', '#594a40')} />
    <WoodBox position={[-2.18, 1.2, 0.1]} size={[0.12, 2.4, 4.4]} material={tin} />
    <WoodBox position={[2.18, 1.2, 0.1]} size={[0.12, 2.4, 4.4]} material={tin} />
    {[-2.04, 2.04].map(x => [-1.85, 2].map(z => <mesh key={`${x}:${z}`} position={[x, 1.28, z]} material={wood} castShadow>
      <cylinderGeometry args={[0.055, 0.068, 2.56, 9]} />
    </mesh>))}
    <WoodBox position={[-0.14, 0.58, -0.59]} size={[3.4, 0.84, 0.74]} material={wood} />
    <Slats transforms={counter} material={wood} />
    <WoodBox position={[-0.14, 1.05, -0.59]} size={[3.65, 0.095, 0.86]} material={wood} />
    <Grounded position={[0.76, 0, -0.72]} floor={1.0975}><OldRadio position={[0, 0, 0]} /></Grounded>
    <Grounded position={[-0.53, 0, -0.59]} floor={1.0975}><CassettePlayer id='cassette' position={[0, 0, 0]} /></Grounded>
    <Grounded position={[-1.6, 0, -0.56]} floor={1.0975}><Kettle position={[0, 0, 0]} /></Grounded>
    <Mirror position={[0.92, 1.5, -1.9]} />
    <WallCalendar position={[-0.96, 1.54, -1.909]} />
    <Chair position={[-1.24, 0, 1.24]} rotationY={0.28} />
    <Chair position={[1.42, 0, 1.42]} rotationY={-0.35} />
    <WoodBox position={[0, 0.055, 0]} size={[4.3, 0.11, 4.3]} material={periodMaterial('plaster', '#53584c')} />
    <FlickeringLight id='stall_tube' kind='point' color='#d6f2e4' intensity={practicalIntensity([-0.25, 2.35, -0.7], [0, 1.45, -1.7], 0.8)} position={[-0.25, 2.35, -0.7]} distance={12} bulb='tube' glow={0.75} hum='hum' seed={6} />
    <FlickeringLight id='mirror_sodium' kind='point' color='#cd9b68' intensity={practicalIntensity([1.72, 1.94, -1.48], [0.92, 1.45, -1.9], 0.55)} position={[1.72, 1.94, -1.48]} distance={5} glow={0.2} />
    <FlickeringLight id='dawn' kind='point' color='#c2d0d6' intensity={70} position={[0, 2, 5]} distance={18} />
    <Entity id='her_reflection' position={[0.92, 0.88, -1.86]} reflection />
    <Actor id='aarav' />
  </group>
}
