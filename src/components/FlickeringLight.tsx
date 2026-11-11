import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { clock, lightRegistry } from '../cinematic/clock'
import { hash } from '../utils/random'
import { radial } from '../utils/textures'
import { AudioManager } from '../audio/AudioManager'
import type { LightMode, Vec3 } from '../cinematic/types'

/** Brightness 0..1 for a mode at scene time t. Deterministic: same t, same flicker. */
function level(mode: LightMode, t: number, since: number, seed: number) {
  switch (mode) {
    case 'off': return 0
    case 'on': return 1
    case 'flicker': return hash(Math.floor(t * 22) + seed) > 0.45 ? 1 : 0.03
    case 'dying': {
      // A tube light's starter struggling, then holding — with the odd dropout.
      const dt = t - since
      if (dt < 1.6) return hash(Math.floor(dt * 9) + seed) > 0.55 ? 1 : 0
      const seg = Math.floor(t * 12)
      return hash(seg + seed) < 0.035 ? 0.08 : 0.9 + 0.1 * hash(seg * 3 + seed)
    }
  }
}

const coneShader = {
  vertexShader: /* glsl */ `
    varying float vH; varying vec3 vN; varying vec3 vV;
    void main() {
      vH = uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uLevel;
    varying float vH; varying vec3 vN; varying vec3 vV;
    void main() {
      float rim = pow(abs(dot(vN, vV)), 1.5);
      float a = pow(vH, 2.2) * rim * uLevel * 0.16;
      gl_FragColor = vec4(uColor * a, a);
    }`,
}

interface Props {
  id: string
  kind: 'point' | 'spot'
  color: string
  intensity: number
  position: Vec3
  target?: Vec3
  angle?: number
  distance?: number
  castShadow?: boolean
  shadowSize?: number
  bulb?: 'tube' | 'sodium'
  glow?: number
  /** Show a volumetric beam (spot only). */
  beam?: boolean
  /** Looping sound that rides this light's level, e.g. ballast hum. */
  hum?: string
  seed?: number
}

export function FlickeringLight({ id, kind, color, intensity, position, target, angle = 0.8, distance = 0, castShadow, shadowSize = 1024, bulb, glow = 1.2, beam, hum, seed = 1 }: Props) {
  const mode = useStore((s) => s.lights[id] ?? 'on')
  const since = useRef(0)
  const humOn = useRef(false)
  const light = useRef<THREE.PointLight & THREE.SpotLight>(null!)
  const bulbMat = useRef<THREE.MeshBasicMaterial>(null!)
  const glowMat = useRef<THREE.SpriteMaterial>(null!)
  const col = useMemo(() => new THREE.Color(color), [color])
  const glowTex = useMemo(radial, [])
  // Built once; uniforms mutated in place (a JSX `uniforms` prop gets copied by R3F and never updates).
  const coneMat = useMemo(() => new THREE.ShaderMaterial({ ...coneShader, uniforms: { uColor: { value: col }, uLevel: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), [col])

  const beamGeo = useMemo(() => {
    if (!beam || !target) return null
    const from = new THREE.Vector3(...position), to = new THREE.Vector3(...target)
    const h = from.distanceTo(to)
    const g = new THREE.ConeGeometry(Math.tan(angle * 0.8) * h, h, 32, 1, true)
    g.translate(0, -h / 2, 0) // tip at the lamp
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.sub(from).normalize()))
    return g
  }, [beam, target, position, angle])

  useEffect(() => {
    since.current = clock.t
  }, [mode])

  useEffect(() => {
    if (kind === 'spot' && target) {
      light.current.target.position.set(...target)
      light.current.target.updateMatrixWorld()
    }
    lightRegistry.set(id, { position: new THREE.Vector3(...position), color: col, level: 1, intensity })
    return () => {
      lightRegistry.delete(id)
      if (hum) AudioManager.ambience(hum, 0, 0.3)
      humOn.current = false
    }
  }, [id, kind, target, position, col, intensity, hum])

  useFrame(() => {
    const l = level(mode, clock.t, since.current, seed)
    light.current.intensity = intensity * l
    light.current.visible = mode !== 'off' // an off light also skips its shadow pass
    if (bulbMat.current) bulbMat.current.color.copy(col).multiplyScalar(0.15 + l * 2.2)
    if (glowMat.current) glowMat.current.opacity = l * 0.3
    coneMat.uniforms.uLevel.value = l
    const r = lightRegistry.get(id)
    if (r) r.level = l
    if (hum) {
      // ponytail: one loop per sound id, so two lights can't share a hum sound yet.
      if (mode !== 'off' && !humOn.current) {
        AudioManager.ambience(hum, 0.0001, 0.01, position)
        humOn.current = true
      }
      AudioManager.loopVolume(hum, l * 0.45)
    }
  })

  return (
    <group>
      {kind === 'spot' ? (
        <spotLight ref={light} position={position} color={col} angle={angle} penumbra={0.65} decay={2} distance={distance}
          castShadow={castShadow} shadow-mapSize={[shadowSize, shadowSize]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      ) : (
        <pointLight ref={light} position={position} color={col} decay={2} distance={distance}
          castShadow={castShadow} shadow-mapSize={[shadowSize, shadowSize]} shadow-bias={-0.001} />
      )}
      {bulb && (
        <mesh position={position} rotation={bulb === 'tube' ? [Math.PI / 2, 0, 0] : [0, 0, 0]} scale={bulb === 'sodium' ? [1, 0.45, 1] : 1}>
          {bulb === 'tube' ? <cylinderGeometry args={[0.02, 0.02, 0.62, 8]} /> : <sphereGeometry args={[0.16, 16, 8]} />}
          <meshBasicMaterial ref={bulbMat} toneMapped={false} />
        </mesh>
      )}
      {glow > 0 && (
        <sprite position={position} scale={[glow, glow, 1]}>
          <spriteMaterial ref={glowMat} map={glowTex} color={col} blending={THREE.AdditiveBlending} depthWrite={false} transparent fog={false} />
        </sprite>
      )}
      {beamGeo && (
        <mesh geometry={beamGeo} material={coneMat} position={position} renderOrder={2} />
      )}
    </group>
  )
}
