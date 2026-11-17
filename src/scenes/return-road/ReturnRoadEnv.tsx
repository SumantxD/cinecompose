import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RailwayCrossingEnv } from '../railway-crossing/RailwayCrossingEnv'
import { railwaySurfaceHeight } from '../../components/AbandonedRailwayCrossing'
import { Actor } from '../../components/Actor'
import { CassetteTape, Slats, WoodenHorse, periodMaterial } from '../../components/DomesticProps'
import { clock } from '../../cinematic/clock'
import type { Cue } from '../../cinematic/types'
import type { EnvironmentProps } from '../registry'
import { useStore } from '../../state/store'
import type { Vec3 } from '../../cinematic/types'
import { Grounded } from '../../components/Placement'

type TrainCue = Extract<Cue, { action: 'train' }>

function Wagon({ cars }: { cars: number }) {
  const steel = periodMaterial('metal', '#424d49'), dark = periodMaterial('metal', '#303733')
  const wheelGeometry = useMemo(() => new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), [])
  const bodies = Array.from({ length: cars }, (_, i) => ({ position: [-i * 11.1, 2.25, 0] as Vec3, scale: [9.8, 2.2, 3.1] as Vec3 }))
  const ribs = Array.from({ length: cars }, (_, car) => Array.from({ length: 32 }, (_, i) => ({
    position: [car * -11.1 - 4.5 + (i % 16) * 0.6, 2.25, i < 16 ? -1.57 : 1.57] as Vec3,
    scale: [0.055, 1.94, 0.035] as Vec3,
  }))).flat()
  const wheels = Array.from({ length: cars }, (_, car) => Array.from({ length: 8 }, (_, i) => ({
    position: [car * -11.1 + (i < 4 ? -3.3 : 3.3) - 0.72 + (i % 4) * 0.48, 1.03, i % 2 ? -1.05 : 1.05] as Vec3,
    rotation: [Math.PI / 2, 0, 0] as Vec3,
    scale: [1, 1, 1] as Vec3,
  }))).flat()
  return <group>
    <Slats transforms={bodies} material={steel} />
    <Slats transforms={ribs} material={dark} />
    <Slats transforms={wheels} geometry={wheelGeometry} material={dark} />
    {Array.from({ length: cars }, (_, i) => <group key={i} position-x={-i * 11.1}>
      {[-3.3, 3.3].map(x => <mesh key={x} position={[x, 1.05, 0]} material={dark}><boxGeometry args={[1.75, 0.24, 2.55]} /></mesh>)}
      <mesh position={[5.05, 1.12, 0]} material={dark}><boxGeometry args={[1.25, 0.15, 0.2]} /></mesh>
    </group>)}
    <mesh position={[4.965, 2.26, 0]}><boxGeometry args={[0.04, 1.9, 2.86]} /><meshStandardMaterial color='#39423d' roughness={0.72} metalness={0.35} /></mesh>
    <mesh position={[5.02, 2.19, 0]} rotation-z={Math.PI / 2}>
      <cylinderGeometry args={[0.14, 0.14, 0.045, 16]} /><meshBasicMaterial color='#d9c6a2' toneMapped={false} />
    </mesh>
    <pointLight position={[5.1, 2.19, 0]} color='#dbc59d' intensity={90} distance={19} />
    {[-0.85, 0.85].map(z => <mesh key={z} position={[4.99, 2.43, z]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.73, 0.45]} /><meshStandardMaterial color='#1d2e37' roughness={0.18} metalness={0.28} />
    </mesh>)}
  </group>
}

function FreightTrain({ cue }: { cue?: TrainCue }) {
  const root = useRef<THREE.Group>(null!)
  useFrame(() => {
    if (!cue) return
    const progress = (clock.t - cue.at) / cue.duration
    root.current.visible = progress >= 0 && progress <= 1
    root.current.position.set(...cue.from).lerp(new THREE.Vector3(...cue.to), THREE.MathUtils.clamp(progress, 0, 1))
  })
  return <group ref={root} name={cue?.target} visible={false}><Wagon cars={3} /></group>
}

function Artefacts({ cassette, horse }: { cassette: boolean; horse: boolean }) {
  const tape = useStore(s => s.entities.cassette)
  const toy = useStore(s => s.entities.horse)
  return <>
    {cassette && tape?.visible && <CassetteTape position={tape.position ?? [0.4, railwaySurfaceHeight(0.4, 0) + 0.004, 0]} />}
    {horse && toy?.visible && <Grounded position={[toy.position?.[0] ?? 0.7, 0, toy.position?.[2] ?? 0]} floor={railwaySurfaceHeight(toy.position?.[0] ?? 0.7, toy.position?.[2] ?? 0)}>
      <WoodenHorse id='horse' position={[0, 0, 0]} scale={0.58} rotationY={0.5} />
    </Grounded>}
  </>
}

const MEERA: Vec3 = [0.5, railwaySurfaceHeight(0.5, -5.8), -5.8]
const MEERA_LOOK = { jacket: '#496165', trousers: '#463b33', skin: '#765948', hair: '#121111' }

export function ReturnRoadEnv({ lighting, scene }: EnvironmentProps) {
  const train = scene.cues.find((cue): cue is TrainCue => cue.action === 'train')
  const remembering = scene.props?.horse === 'meera' || scene.props?.horse === 'absent'
  return <RailwayCrossingEnv lighting={lighting} scene={scene} groundedActors softFill nearIntensity={300}>
    <FreightTrain cue={train} />
    <Artefacts cassette={!!scene.props?.cassette} horse={scene.props?.horse === 'carried'} />
    {remembering && <>
      <Actor id='meera' position={MEERA} look={MEERA_LOOK} height={1.16} carrying={scene.props?.horse === 'meera'} groundAt={railwaySurfaceHeight} />
    </>}
  </RailwayCrossingEnv>
}
