import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useRenderSettings } from '../../cinematic/rendering'
import type { ForestSettings } from '../../cinematic/types'
import type { EnvironmentProps } from '../registry'
import { ModelInstances } from '../../components/ModelInstances'
import { FogSystem } from '../../components/FogSystem'
import { GroundMist } from '../../components/GroundMist'
import { RainSystem } from '../../components/RainSystem'
import { DEFAULT_RELIEF, SOIL_SINK, forestHeightAt, forestLayout, pathX } from './layout'
import { rng } from '../../utils/random'

const DEFAULTS: ForestSettings = { seed: 47, density: .86, textureScale: 42, normalStrength: .85, relief: DEFAULT_RELIEF, wetness: .38, wind: .6, mist: .075, puddles: true }

function Moon() {
  const halo = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!, gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(162,186,205,.22)'); gradient.addColorStop(.45, 'rgba(124,162,188,.055)'); gradient.addColorStop(1, 'rgba(124,162,188,0)')
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64)
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])
  useEffect(() => () => halo.dispose(), [halo])
  return <group name="moon" position={[-24, 47, -102]}>
    <sprite scale={[10, 10, 1]}><spriteMaterial map={halo} transparent depthWrite={false} fog={false} /></sprite>
    <mesh><sphereGeometry args={[1.15, 32, 20]} /><meshBasicMaterial color="#a9bcc7" fog={false} /></mesh>
  </group>
}

function Terrain({ settings }: { settings: ForestSettings }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(150, 170, 150, 170)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute, colors = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) - 18
      p.setZ(i, z)
      p.setY(i, forestHeightAt(x, z, settings.seed, settings.relief))
      const clearing = 1 - THREE.MathUtils.smoothstep(Math.abs(x - pathX(z)), 1.2, 4.3)
      const c = new THREE.Color('#ffffff').lerp(new THREE.Color('#827765'), clearing * .52)
      c.toArray(colors, i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [settings.seed, settings.relief])
  useEffect(() => () => geometry.dispose(), [geometry])
  const textures = useTexture({
    map: '/textures/forest_ground_04/color.webp', normalMap: '/textures/forest_ground_04/normal.webp',
    roughnessMap: '/textures/forest_ground_04/roughness.webp', aoMap: '/textures/forest_ground_04/ao.webp',
  })
  useMemo(() => Object.entries(textures).forEach(([name, texture]) => {
    texture.colorSpace = name === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.setScalar(settings.textureScale)
    texture.anisotropy = 8
  }), [textures, settings.textureScale])
  return <mesh name="forest-ground" geometry={geometry} receiveShadow>
    <meshStandardMaterial {...textures} vertexColors color="#836146" roughness={1 - settings.wetness * .56} normalScale={[settings.normalStrength, settings.normalStrength]} envMapIntensity={.55} />
  </mesh>
}

function Puddles({ layout, seed, wetness }: { layout: ReturnType<typeof forestLayout>; seed: number; wetness: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = [], random = rng(seed + 1771)
    for (const puddle of layout.puddles) {
      const ring = Array.from({ length: 24 }, (_, i) => {
        const at = i / 24 * Math.PI * 2, radius = puddle.radius * (.82 + random() * .18)
        return [puddle.x + Math.cos(at + puddle.rotation) * radius * 1.65, puddle.y, puddle.z + Math.sin(at + puddle.rotation) * radius] as [number, number, number]
      })
      for (let i = 0; i < 24; i++) positions.push(puddle.x, puddle.y, puddle.z, ...ring[(i + 1) % 24], ...ring[i])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [layout.puddles, seed])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="forest-puddles" geometry={geometry} receiveShadow>
    <meshPhysicalMaterial color="#394d4c" roughness={.9 - wetness * .83} metalness={.1} clearcoat={.8} clearcoatRoughness={.12} envMapIntensity={1.1} />
  </mesh>
}

/** Source-derived alpha impostors are confined to the distant forest, not the hero frame. */
function Treeline({ seed, relief }: { seed: number; relief?: number }) {
  const texture = useTexture('/models/forest/tree_small_02_billboard.webp')
  useMemo(() => { texture.colorSpace = THREE.SRGBColorSpace }, [texture])
  const trees = useMemo(() => {
    const random = rng(seed + 741)
    return Array.from({ length: 38 }, (_, i) => {
      const x = -56 + (i % 19) * 6.2 + (random() - .5) * 5, z = -72 - Math.floor(i / 19) * 18 - random() * 8, height = 7 + random() * 11
      return { x, y: forestHeightAt(x, z, seed, relief) + height / 2, z, height }
    })
  }, [seed, relief])
  return <group name="distant-treeline">
    {trees.map((tree, i) => <mesh key={i} position={[tree.x, tree.y, tree.z]}>
      <planeGeometry args={[tree.height * .7, tree.height]} />
      <meshBasicMaterial map={texture} alphaTest={.3}     color="#293f45" fog />
    </mesh>)}
  </group>
}

/** Reference forest. This environment is opt-in and reads all authored settings from scene JSON. */
export function ReferenceForestEnv({ lighting, scene }: EnvironmentProps) {
  const settings = scene.props?.forest ?? DEFAULTS
  const low = useRenderSettings()?.profile === 'performance'
  const layout = useMemo(() => forestLayout(settings, low), [settings, low])
  const size = useThree((s) => s.size)
  const portrait = size.width < size.height
  const lantern = useMemo(() => {
    const z = 8, x = pathX(z) - .9
    return { x, z, y: forestHeightAt(x, z, settings.seed, settings.relief) - SOIL_SINK }
  }, [settings.seed, settings.relief])
  const lamp: [number, number, number] = [lantern.x, lantern.y + .96, lantern.z]
  return <group name="reference-forest">
    <FogSystem color={lighting.fogColor ?? '#172a31'} density={lighting.fogDensity} skyDome={!scene.rendering?.environment?.background}
      sheets={[{ z: 1, y: .7, w: 28, h: 1.7, opacity: settings.mist * .8 }, { z: -17, y: 2.2, w: 62, h: 5.5, opacity: settings.mist }, { z: -39, y: 3, w: 86, h: 7, opacity: settings.mist * .85 }]}
      glowPos={lamp} glowColor="#aa7c38" />
    <Moon />
    <Terrain settings={settings} />
    <Treeline seed={settings.seed} relief={settings.relief} />
    <ModelInstances id="tree_small_02_detail" placements={layout.trees.slice(0, 5)} wind={settings.wind} />
    <ModelInstances id="fern_02" placements={low ? layout.ferns.slice(0, 42) : layout.ferns} wind={settings.wind} castShadow={false} />
    <ModelInstances id="tree_small_02" placements={layout.trees.slice(5)} wind={settings.wind} castShadow={false} />
    {layout.props.map((asset) => <ModelInstances key={asset.id} id={asset.id} placements={asset.placements} />)}
    <ModelInstances id="tree_stump_01" placements={[{ ...lantern, height: .64, rotation: 1.2 }]} />
    <ModelInstances id="brass_diya_lantern" placements={[{ ...lantern, y: lantern.y + .64, height: .42, rotation: -.5 }]} />
    {settings.puddles && <Puddles layout={layout} seed={settings.seed} wetness={settings.wetness} />}
    <GroundMist config={{ center: [0, 0, -12], width: 24, length: 54, height: .3, opacity: settings.mist }} surfaceAt={(x, z) => forestHeightAt(x, z, settings.seed, settings.relief)} lamps={[lamp]} layers={2} />
    <hemisphereLight args={['#91b9d3', '#353a2b', lighting.ambientIntensity * 1.35]} />
    <directionalLight castShadow color="#c3dcff" intensity={lighting.moon ?? 2.2} position={[-24, 46, -96]}
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-33} shadow-camera-right={33} shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-far={100} shadow-bias={-.0002} shadow-normalBias={.035} />
    <pointLight name="diya" position={lamp} color="#ffa452" intensity={12} distance={10} decay={2} shadow-mapSize={[512, 512]} shadow-bias={-.001} />
    <mesh position={lamp} scale={.028}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#dfac61" /></mesh>
    <RainSystem count={scene.props?.rain?.enabled === false ? 0 : scene.props?.rain?.count ?? 1300} wind={scene.props?.rain?.wind ?? [.4, .05]} box={portrait ? [29, 16, 54] : [65, 20, 80]} ground="0.0" />
  </group>
}
