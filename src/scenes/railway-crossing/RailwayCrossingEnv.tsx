import type { ReactNode } from 'react'
import { AbandonedRailwayCrossing, groundLevel, railwaySurfaceHeight, roadRamp } from '../../components/AbandonedRailwayCrossing'
import { VillageRoad, Milestone } from '../../components/VillageRoad'
import { ForestEnvironment } from '../../components/ForestEnvironment'
import { FlickeringLight } from '../../components/FlickeringLight'
import { RainSystem } from '../../components/RainSystem'
import { FogSystem } from '../../components/FogSystem'
import { Entity } from '../../components/Entity'
import { NightSky } from '../../components/NightSky'
import { GroundMist } from '../../components/GroundMist'
import { Actor, DRIVER_LOOK } from '../../components/Actor'
import { Taxi } from '../../components/Taxi'
import { useStore } from '../../state/store'
import type { SceneConfig, Vec3 } from '../../cinematic/types'

// LC Gate 47, outside Sonpahari. Light ids used by cues: gate_tube, sodium_far, sodium_near, sodium_deep.
// Cue targets: chudail (Entity), aarav + driver (Actor), taxi (Taxi). All hidden until a cue shows them.

const clear = (x: number, z: number) => Math.abs(z) > 7 && !(x > -11 && x < -3 && z > 1 && z < 10)

const TUBE: Vec3 = [-5.8, 2.36, 5.7]
const SODIUM: Vec3 = [2.3, 6.3, -12]
const SODIUM_TARGET: Vec3 = [0.3, 0, -5]
// Near-side lamp faces the village: with it behind you, your shadow (and hers) falls up the road ahead.
const NEAR: Vec3 = [-2.3, 6.2, 9]
const NEAR_TARGET: Vec3 = [0.3, 0, 22]
const DEEP: Vec3 = [-2.2, 6.1, -48]
const DEEP_TARGET: Vec3 = [0, 0, -44]
const MIST_LIGHTS = [SODIUM, NEAR, DEEP]
const SHEETS = [
  { z: -17, y: 2.6, w: 70, h: 7, opacity: 0.22 },
  { z: -27, y: 3, w: 90, h: 9, opacity: 0.3 },
  { z: -42, y: 3.5, w: 120, h: 11, opacity: 0.38 },
  { z: 9, y: 1.2, w: 40, h: 3, opacity: 0.12 },
]

function LampPost({ base, head }: { base: Vec3; head: Vec3 }) {
  const dx = head[0] - base[0]
  return (
    <group>
      <mesh position={[base[0], base[1] + head[1] / 2, base[2]]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, head[1] + 0.2, 8]} />
        <meshStandardMaterial color="#2d2d2b" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[base[0] + dx / 2, head[1] + 0.15, base[2]]} rotation-z={Math.PI / 2 - 0.12}>
        <cylinderGeometry args={[0.035, 0.035, Math.abs(dx) + 0.2, 6]} />
        <meshStandardMaterial color="#2d2d2b" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  )
}

export function RailwayCrossingEnv({ lighting, scene, children, groundedActors = true, softFill = false, nearIntensity = 900 }: { lighting: SceneConfig['lighting']; scene?: SceneConfig; children?: ReactNode; groundedActors?: boolean; softFill?: boolean; nearIntensity?: number }) {
  const low = useStore((s) => s.quality === 'low')
  return (
    <group>
      <FogSystem color={lighting.fogColor ?? '#232d39'} density={lighting.fogDensity} sheets={SHEETS} glowPos={SODIUM} glowColor="#ff9a40" />
      <NightSky intensity={lighting.gi ?? 0.6} />
      <hemisphereLight args={['#3a4a5e', '#0a0c0e', lighting.ambientIntensity]} />
      {softFill && <ambientLight color='#9eacb8' intensity={lighting.ambientIntensity * 2.2} />}
      {/* Moonlight through cloud: cool key from behind the crossing — rims silhouettes, keeps the night readable. */}
      <directionalLight position={[-20, 30, -40]} intensity={lighting.moon ?? 0.5} color="#7f93b4" />

      {scene?.props?.groundMist && <GroundMist config={scene.props.groundMist} surfaceAt={railwaySurfaceHeight} lamps={MIST_LIGHTS} layers={low ? 2 : 3} />}
      <ForestEnvironment clear={clear} terrain={groundLevel} trees={low ? 260 : 420} bushes={low ? 260 : 500} grass={low ? 1200 : 2600} />
      <VillageRoad terrain={roadRamp} />
      <AbandonedRailwayCrossing />
      <Milestone position={[-3.0, groundLevel(-3.0, 21), 21]} rotationY={0.35} place="सोनपहाड़ी" km="3" />

      <LampPost base={[3.7, 0, -12]} head={SODIUM} />
      <LampPost base={[-3.7, 0, -48]} head={DEEP} />
      <LampPost base={[-3.7, 0, 9]} head={NEAR} />
      <FlickeringLight id="sodium_far" kind="spot" color="#ff9a40" intensity={280} position={SODIUM} target={SODIUM_TARGET}
        angle={0.75} castShadow shadowSize={low ? 512 : 1024} bulb="sodium" glow={1.3} beam seed={3} />
      <FlickeringLight id="sodium_near" kind="spot" color="#ff9a40" intensity={nearIntensity} position={NEAR} target={NEAR_TARGET}
        angle={0.8} castShadow shadowSize={low ? 512 : 1024} bulb="sodium" glow={1.2} seed={7} />
      <FlickeringLight id="sodium_deep" kind="spot" color="#ff9440" intensity={90} position={DEEP} target={DEEP_TARGET}
        angle={0.7} bulb="sodium" glow={1.1} beam seed={9} />
      <FlickeringLight id="gate_tube" kind="point" color="#d6f2e4" intensity={30} position={TUBE} distance={18}
        bulb="tube" glow={0.9} hum="hum" seed={5} />

      <Entity id="chudail" position={[0.7, 0, -9.5]} surfaceAt={groundedActors ? railwaySurfaceHeight : undefined} />
      <Actor id="aarav" groundAt={groundedActors ? railwaySurfaceHeight : undefined} />
      <Actor id="driver" groundAt={groundedActors ? railwaySurfaceHeight : undefined} look={DRIVER_LOOK} height={1.7} />
      <Taxi id="taxi" lowShadows={low} />
      {/* splash height follows the road's ramp up to the rails (same formula as roadRamp) */}
      {scene?.props?.rain?.enabled !== false && <RainSystem count={scene?.props?.rain?.count || (low ? 5000 : 9000)} wind={scene?.props?.rain?.wind} splashes={low ? 400 : 700} ground="0.665 * (1.0 - smoothstep(2.0, 10.0, abs(p.z)))" />}
      {children}
    </group>
  )
}
