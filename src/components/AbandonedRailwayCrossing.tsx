import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { signboard, stripes } from '../utils/textures'
import { clock } from '../cinematic/clock'
import { fbm, rng } from '../utils/random'
import type { Vec3 } from '../cinematic/types'

// Track runs along x at z = 0. Road crosses along z. Indian broad gauge.
// Stack: formation (raised ground) → ballast → sleepers → rails. The road ramps up to rail-top.
export const GAUGE = 1.676
const FORMATION = 0.3
const BALLAST_TOP = 0.48
const SLEEPER_Y = 0.5
const RAIL_TOP = 0.7
const ROAD_GAP = 3.4
const ss = THREE.MathUtils.smoothstep

/** Road surface offset: climbs to meet the rails. */
export const roadRamp = (_x: number, z: number) => (RAIL_TOP - 0.035) * (1 - ss(Math.abs(z), 2.0, 10))

/** Ground offset: the track formation, plus the road's own embankment near the road. */
export const groundLevel = (x: number, z: number) =>
  Math.max(FORMATION * (1 - ss(Math.abs(z), 2.6, 8)), roadRamp(x, z) * (1 - ss(Math.abs(x), 3, 7)))

function useSign(lines: Parameters<typeof signboard>[0], bg: string, fg: string, w?: number, h?: number) {
  const [t, setT] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    signboard(lines, bg, fg, w, h).then(setT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return t
}

function Track() {
  const ballast = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(-2.5, 0), new THREE.Vector2(-1.7, BALLAST_TOP - FORMATION + 0.05), new THREE.Vector2(1.7, BALLAST_TOP - FORMATION + 0.05), new THREE.Vector2(2.5, 0)])
    const seg = (x0: number, x1: number) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, steps: 40 })
      g.rotateY(Math.PI / 2)
      g.translate(x0, FORMATION - 0.05, 0)
      return g
    }
    return [seg(-80, -ROAD_GAP), seg(ROAD_GAP, 80)]
  }, [])
  const ballastTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const x = c.getContext('2d')!
    const r = rng(17)
    x.fillStyle = '#2b2925'
    x.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2600; i++) {
      const v = 30 + r() * 50
      x.fillStyle = `rgb(${v},${v * 0.96},${v * 0.9})`
      x.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2 + r() * 3)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 20)
    return t
  }, [])

  const sleepers = useMemo(() => {
    const o = new THREE.Object3D()
    const r = rng(23)
    const out: THREE.Matrix4[] = []
    for (let x = -80; x < 80; x += 0.65) {
      if (Math.abs(x) < ROAD_GAP) continue
      o.position.set(x, SLEEPER_Y, 0)
      o.rotation.set(0, (r() - 0.5) * 0.04, 0)
      o.updateMatrix()
      out.push(o.matrix.clone())
    }
    return out
  }, [])

  return (
    <group>
      {ballast.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial map={ballastTex} roughness={1} />
        </mesh>
      ))}
      <instancedMesh args={[undefined, undefined, sleepers.length]} receiveShadow castShadow
        ref={(im) => { if (im) { sleepers.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true } }}>
        <boxGeometry args={[0.25, 0.12, 2.75]} />
        <meshStandardMaterial color="#5b5852" roughness={0.95} />
      </instancedMesh>
      {/* Concrete crossing panel, level with the rail heads. */}
      <mesh position={[0, RAIL_TOP - 0.15, 0]} receiveShadow>
        <boxGeometry args={[ROAD_GAP * 2, 0.3, 3.6]} />
        <meshStandardMaterial color="#45433f" roughness={0.75} />
      </mesh>
      {[-GAUGE / 2, GAUGE / 2].map((z) => (
        <group key={z}>
          <mesh position={[0, RAIL_TOP - 0.07, z]} castShadow receiveShadow>
            <boxGeometry args={[160, 0.14, 0.07]} />
            <meshStandardMaterial color="#3a2a1e" roughness={0.7} metalness={0.5} />
          </mesh>
          {/* Polished running surface — catches every lamp. */}
          <mesh position={[0, RAIL_TOP + 0.002, z]}>
            <boxGeometry args={[160, 0.006, 0.065]} />
            <meshStandardMaterial color="#9a958e" roughness={0.18} metalness={1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** A lowered boom barrier. Pivot post at `pivot`; boom extends toward -x * dir. */
function Barrier({ pivot, dir, length = 7, raised = 0 }: { pivot: Vec3; dir: 1 | -1; length?: number; raised?: number }) {
  const boomTex = useMemo(() => stripes('#d8d2c4', '#8e2a22', 14), [])
  return (
    <group position={pivot}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.16, 1.2, 0.16]} />
        <meshStandardMaterial color="#1c1c1a" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[dir * 0.5, 1.06, 0]} castShadow>
        <boxGeometry args={[0.55, 0.32, 0.26]} />
        <meshStandardMaterial color="#5d5a52" roughness={0.9} />
      </mesh>
      <group position={[0, 1.06, 0]} rotation-z={-dir * raised}>
      <mesh position={[-dir * length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2 + dir * 0.012]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, length, 10]} />
        <meshStandardMaterial map={boomTex} roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Hanging STOP disc (only on a lowered boom — it would hang wrong on a raised one). */}
      {!raised && <group position={[-dir * length * 0.78, -0.26, 0]}>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.22, 4]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.015, 20]} />
          <meshStandardMaterial color="#7a231d" roughness={0.6} />
        </mesh>
      </group>}
      </group>
    </group>
  )
}

/** Gateman's cabin (gumti): lime-washed brick, maroon dado, half-open door onto darkness. */
function GateCabin({ position }: { position: Vec3 }) {
  const board = useSign(
    [
      { text: 'समपार फाटक सं. 47', font: '58px "Tiro Devanagari Hindi"', y: 0.37 },
      { text: 'L.C. GATE No. 47', font: 'bold 50px sans-serif', y: 0.7 },
    ],
    '#c9a43c', '#141210',
  )
  const W = 2.6, H = 2.5, D = 2.4
  return (
    <group position={position}>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#a8986c" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[W + 0.02, 0.84, D + 0.02]} />
        <meshStandardMaterial color="#4a2a22" roughness={0.9} />
      </mesh>
      <mesh position={[0.15, H + 0.08, 0]} castShadow>
        <boxGeometry args={[W + 0.7, 0.14, D + 0.6]} />
        <meshStandardMaterial color="#56534c" roughness={1} />
      </mesh>
      {/* Doorway facing the road: kept black — something could be standing in it. */}
      <mesh position={[W / 2 + 0.005, 1.0, 0.3]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.85, 1.95]} />
        <meshBasicMaterial color="#020202" />
      </mesh>
      <mesh position={[W / 2 + 0.36, 1.0, 0.75]} rotation-y={Math.PI / 2 + 1.1}>
        <boxGeometry args={[0.85, 1.95, 0.04]} />
        <meshStandardMaterial color="#2f3a33" roughness={0.8} />
      </mesh>
      {/* Barred window toward the camera. */}
      <mesh position={[0.3, 1.45, D / 2 + 0.005]}>
        <planeGeometry args={[0.7, 0.6]} />
        <meshBasicMaterial color="#030303" />
      </mesh>
      {[-0.2, -0.05, 0.1, 0.25, 0.4, 0.55].map((x) => (
        <mesh key={x} position={[x + 0.05, 1.45, D / 2 + 0.02]}>
          <cylinderGeometry args={[0.008, 0.008, 0.6, 4]} />
          <meshStandardMaterial color="#222" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      {board && (
        <mesh position={[-0.55, 2.05, D / 2 + 0.01]}>
          <planeGeometry args={[1.1, 0.55]} />
          <meshStandardMaterial map={board} roughness={0.8} />
        </mesh>
      )}
      {/* Tube-light bracket over the door. */}
      <mesh position={[W / 2 + 0.06, 2.4, 0.3]}>
        <boxGeometry args={[0.06, 0.05, 0.7]} />
        <meshStandardMaterial color="#cfcac0" roughness={0.6} />
      </mesh>
    </group>
  )
}

function WarningSign({ position }: { position: Vec3 }) {
  const t = useSign(
    [
      { text: 'आगे रेलवे फाटक', font: '64px "Tiro Devanagari Hindi"', y: 0.38 },
      { text: 'RAILWAY CROSSING AHEAD', font: 'bold 36px sans-serif', y: 0.72 },
    ],
    '#c79a2e', '#121110',
  )
  return (
    <group position={position} rotation-y={-0.25}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 2.2, 6]} />
        <meshStandardMaterial color="#3a3a38" metalness={0.5} roughness={0.6} />
      </mesh>
      {t && (
        <mesh position={[0, 2.0, 0.04]} rotation-z={0.04} castShadow>
          <planeGeometry args={[1.0, 0.5]} />
          <meshStandardMaterial map={t} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

/** Concrete (PSC) poles with sagging wires that move in the wind. */
function PowerLine({ poles }: { poles: Vec3[] }) {
  const lines = useRef<THREE.Line[]>([])
  const SEG = 16
  const offsets = [-0.45, 0, 0.45]
  const geos = useMemo(
    () => poles.slice(1).flatMap(() => offsets.map(() => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3))
      return g
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [poles],
  )
  useFrame(() => {
    let k = 0
    for (let i = 1; i < poles.length; i++) {
      const a = poles[i - 1], b = poles[i]
      for (let w = 0; w < offsets.length; w++, k++) {
        const pos = geos[k].attributes.position as THREE.BufferAttribute
        const sway = Math.sin(clock.t * 0.8 + i + w * 0.6) * 0.12 + (fbm(clock.t * 0.3, i + w) - 0.5) * 0.15
        for (let s = 0; s <= SEG; s++) {
          const u = s / SEG
          const sag = Math.sin(u * Math.PI)
          pos.setXYZ(s, a[0] + (b[0] - a[0]) * u + offsets[w] + sway * sag, a[1] + (b[1] - a[1]) * u - sag * 0.9 + 7.6, a[2] + (b[2] - a[2]) * u + sway * sag * 0.3)
        }
        pos.needsUpdate = true
      }
    }
  })
  return (
    <group>
      {poles.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 3.9, 0]} castShadow>
            <boxGeometry args={[0.2, 7.8, 0.14]} />
            <meshStandardMaterial color="#6e6b64" roughness={0.95} />
          </mesh>
          <mesh position={[0, 7.65, 0]}>
            <boxGeometry args={[1.25, 0.08, 0.08]} />
            <meshStandardMaterial color="#2a2a28" metalness={0.5} />
          </mesh>
        </group>
      ))}
      {geos.map((g, i) => (
        // @ts-expect-error — R3F's <line> is THREE.Line, not the SVG element.
        <line key={i} ref={(l: THREE.Line) => (lines.current[i] = l)} geometry={g} frustumCulled={false}>
          <lineBasicMaterial color="#050607" />
        </line>
      ))}
    </group>
  )
}

/** Railway colour-light signal: dim red aspect in the distance. */
function Signal({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 4.8, 8]} />
        <meshStandardMaterial color="#2b2b29" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 4.9, 0]}>
        <boxGeometry args={[0.32, 0.7, 0.2]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 5.08, 0.105]}>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color={[1.4, 0.12, 0.06]} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function AbandonedRailwayCrossing() {
  const roadPoles = useMemo<Vec3[]>(() => [-90, -62, -34, -6, 22, 50].map((z) => [-4.3, 0, z]), [])
  return (
    <group>
      <Track />
      {/* Near boom jammed half-open for years; the far one is down. */}
      <Barrier pivot={[3.7, groundLevel(3.7, 3.7), 3.7]} dir={1} raised={1.15} />
      <Barrier pivot={[-3.7, groundLevel(-3.7, -3.7), -3.7]} dir={-1} />
      <GateCabin position={[-7.2, groundLevel(-7.2, 5.4) - 0.1, 5.4]} />
      <WarningSign position={[3.6, 0, 16]} />
      <PowerLine poles={roadPoles} />
      <Signal position={[16, BALLAST_TOP - 0.1, -3]} />
    </group>
  )
}
