import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { clock } from '../cinematic/clock'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import { fbm, rng } from '../utils/random'
import type { Vec3 } from '../cinematic/types'
import { registerSurfaceMaterial } from './SurfaceTextures'

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  draw(canvas.getContext('2d')!, w, h)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const cache = new Map<string, THREE.MeshStandardMaterial>()
export function periodMaterial(kind: 'wood' | 'plaster' | 'paper' | 'metal' | 'cloth' | 'denim', color: string) {
  const key = `${kind}:${color}`
  if (!cache.has(key)) {
    const map = canvasTexture((ctx, w, h) => {
      const pixels = ctx.createImageData(w, h)
      const rand = rng(kind.length * 37)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, n = fbm(x / 35, y / (kind === 'wood' ? 7 : 35))
        const v = 145 + n * 95 + rand() * 12
        pixels.data[i] = v; pixels.data[i + 1] = v; pixels.data[i + 2] = v; pixels.data[i + 3] = 255
      }
      ctx.putImageData(pixels, 0, 0)
      if (kind === 'wood') {
        ctx.globalAlpha = 0.24
        for (let i = 0; i < 70; i++) {
          ctx.strokeStyle = i % 2 ? '#292929' : '#e2e2e2'; ctx.lineWidth = 0.5 + rand()
          const x = rand() * w; ctx.beginPath(); ctx.moveTo(x, 0)
          ctx.bezierCurveTo(x + rand() * 18, h * 0.3, x - rand() * 18, h * 0.7, x, h); ctx.stroke()
        }
      }
      if (kind === 'plaster') {
        const damp = ctx.createLinearGradient(0, 0, 0, h)
        damp.addColorStop(0.7, 'rgba(20,28,22,0)'); damp.addColorStop(1, 'rgba(20,28,22,0.65)')
        ctx.fillStyle = damp; ctx.fillRect(0, 0, w, h)
      }
    }, 256, 256)
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    if (kind === 'wood') map.repeat.set(1, 3)
    if (kind === 'plaster') map.repeat.set(3, 2)
    const material = new THREE.MeshStandardMaterial({ color, map, roughness: kind === 'metal' ? 0.55 : 0.9, metalness: kind === 'metal' ? 0.45 : 0 })
    cache.set(key, material)
    if (kind === 'wood' || kind === 'plaster' || kind === 'denim') registerSurfaceMaterial(kind, material)
  }
  return cache.get(key)!
}

/** One instanced mesh for repeated slats, ribs, bars or roof pieces. */
export function Slats({ transforms, material, geometry }: { transforms: { position: Vec3; scale: Vec3; rotation?: Vec3 }[]; material: THREE.Material; geometry?: THREE.BufferGeometry }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    transforms.forEach((t, i) => {
      dummy.position.set(...t.position); dummy.scale.set(...t.scale)
      dummy.rotation.set(...(t.rotation ?? [0, 0, 0])); dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [transforms, dummy])
  return <instancedMesh ref={ref} args={[undefined, undefined, transforms.length]} geometry={geometry} material={material} castShadow receiveShadow>
    <boxGeometry args={[1, 1, 1]} />
  </instancedMesh>
}

export function WoodBox({ position, size, rotation, name, material = periodMaterial('wood', '#69503b') }: { position: Vec3; size: Vec3; rotation?: Vec3; name?: string; material?: THREE.Material }) {
  return <mesh name={name} position={position} rotation={rotation} material={material} castShadow receiveShadow>
    <boxGeometry args={size} />
  </mesh>
}

export function Mirror({ position, rotation }: { position: Vec3; rotation?: Vec3 }) {
  return <group position={position} rotation={rotation}>
    <WoodBox position={[0, 0, 0]} size={[0.82, 1.25, 0.055]} material={periodMaterial('wood', '#3e3028')} />
    <mesh position={[0, 0, 0.035]}>
      <planeGeometry args={[0.72, 1.15]} />
      <meshPhysicalMaterial color="#87928f" roughness={0.28} metalness={0.45} transparent opacity={0.48} />
    </mesh>
    <mesh position={[-0.19, 0.21, 0.037]} rotation-z={0.16}>
      <planeGeometry args={[0.065, 0.83]} />
      <meshBasicMaterial color="#bcc7bb" transparent opacity={0.055} depthWrite={false} />
    </mesh>
  </group>
}

export function OldRadio({ position }: { position: Vec3 }) {
  const plastic = periodMaterial('wood', '#544935'), metal = periodMaterial('metal', '#747367')
  return <group position={position}>
    <WoodBox position={[0, 0.17, 0]} size={[0.58, 0.34, 0.22]} material={plastic} />
    <mesh position={[-0.12, 0.2, 0.119]} rotation-x={Math.PI / 2} material={metal}>
      <cylinderGeometry args={[0.105, 0.105, 0.025, 24]} />
    </mesh>
    <mesh position={[-0.12, 0.2, 0.135]}>
      <planeGeometry args={[0.13, 0.13]} />
      <meshStandardMaterial color="#20231d" roughness={0.8} wireframe />
    </mesh>
    <WoodBox position={[0.145, 0.23, 0.116]} size={[0.17, 0.055, 0.008]} material={periodMaterial('paper', '#d0c6a0')} />
    {[0, 1].map(i => <mesh key={i} position={[0.15, 0.12 + i * 0.07, 0.134]} rotation-x={Math.PI / 2} material={metal}>
      <cylinderGeometry args={[0.022, 0.022, 0.03, 12]} />
    </mesh>)}
    <mesh position={[0.18, 0.61, -0.04]} rotation-z={-0.23} material={metal}>
      <cylinderGeometry args={[0.006, 0.006, 0.62, 6]} />
    </mesh>
    <mesh position={[0.06, -0.038, 0.02]} rotation-x={Math.PI / 2}>
      <torusGeometry args={[0.13, 0.009, 5, 20, Math.PI * 1.65]} />
      <meshStandardMaterial color="#151612" />
    </mesh>
    {/* The cord ends at the counter; nothing reaches the wall. */}
    <WoodBox position={[0.19, -0.027, 0.035]} size={[0.045, 0.025, 0.026]} material={metal} />
  </group>
}

function tapeLabel() {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#c3b797'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#343129'; ctx.textAlign = 'center'; ctx.font = 'bold 45px serif'
    ctx.fillText('MEERA', w / 2, 145); ctx.font = '29px serif'; ctx.fillText('17 / 08 / 1992', w / 2, 235)
    ctx.strokeStyle = '#716956'; ctx.lineWidth = 3; ctx.strokeRect(22, 26, w - 44, h - 52)
  })
}

export function CassetteTape({ position, rotationY = 0 }: { position: Vec3; rotationY?: number }) {
  const label = useMemo(tapeLabel, [])
  const body = periodMaterial('metal', '#37332c')
  return <group name='cassette' position={position} rotation-y={rotationY}>
    <WoodBox position={[0, 0.009, 0]} size={[0.106, 0.018, 0.067]} material={body} />
    <WoodBox position={[0, 0.019, 0]} size={[0.072, 0.005, 0.047]} material={periodMaterial('metal', '#151a19')} />
    <mesh position={[0, 0.022, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[0.083, 0.051]} /><meshStandardMaterial map={label} transparent opacity={0.64} roughness={0.94} />
    </mesh>
    {[-0.025, 0.025].map(x => <mesh key={x} position={[x, 0.025, 0.004]} material={body}>
      <cylinderGeometry args={[0.012, 0.012, 0.008, 12]} />
    </mesh>)}
  </group>
}

export function CassettePlayer({ id, position }: { id?: string; position: Vec3 }) {
  const label = useMemo(tapeLabel, [])
  const plastic = periodMaterial('metal', '#332f2b')
  return <group name={id} position={position} rotation-y={-0.13}>
    <WoodBox position={[0, 0.042, 0]} size={[0.43, 0.084, 0.31]} material={plastic} />
    <WoodBox position={[0, 0.106, -0.012]} size={[0.245, 0.018, 0.185]} material={periodMaterial('metal', '#151b1c')} />
    {[-0.065, 0.065].map(x => <mesh key={x} position={[x, 0.125, 0.009]} material={periodMaterial('metal', '#756a55')}>
      <cylinderGeometry args={[0.035, 0.035, 0.012, 16]} />
    </mesh>)}
    <mesh position={[0, 0.126, -0.045]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[0.17, 0.075]} />
      <meshStandardMaterial map={label} roughness={0.85} />
    </mesh>
    {[-0.15, -0.05, 0.05, 0.15].map(x => <WoodBox key={x} position={[x, 0.046, 0.185]} size={[0.055, 0.04, 0.065]} material={periodMaterial('metal', '#767169')} />)}
  </group>
}

export function Kettle({ position }: { position: Vec3 }) {
  const tin = periodMaterial('metal', '#7a7c6c')
  return <group position={position}>
    <mesh position={[0, 0.14, 0]} material={tin} castShadow>
      <latheGeometry args={[[[0.09, 0], [0.14, 0.05], [0.145, 0.17], [0.09, 0.24], [0.085, 0.27]].map(([x, y]) => new THREE.Vector2(x, y)), 24]} />
    </mesh>
    <mesh position={[0, 0.275, 0]} material={tin}><cylinderGeometry args={[0.097, 0.09, 0.018, 16]} /></mesh>
    <mesh position={[0, 0.303, 0]} material={tin}><sphereGeometry args={[0.022, 8, 6]} /></mesh>
    <mesh position={[0.157, 0.195, 0]} rotation-z={-0.92} material={tin}><cylinderGeometry args={[0.026, 0.048, 0.16, 12, 1, true]} /></mesh>
    <mesh position={[0, 0.22, 0]} rotation-y={Math.PI / 2}>
      <torusGeometry args={[0.115, 0.009, 6, 24, Math.PI]} />
      <meshStandardMaterial color="#252924" roughness={0.7} />
    </mesh>
  </group>
}

export function WoodenHorse({ id, position, scale = 1, rotationY = 0 }: { id?: string; position: Vec3; scale?: number; rotationY?: number }) {
  const wood = periodMaterial('wood', '#9b744d')
  const runner = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.29, 0.08, 0), new THREE.Vector3(-0.2, 0.016, 0), new THREE.Vector3(0.13, 0, 0), new THREE.Vector3(0.29, 0.07, 0),
  ]), 24, 0.013, 6, false), [])
  return <group name={id} position={position} scale={scale} rotation-y={rotationY}>
    {[-0.09, 0.09].map(z => <mesh key={z} geometry={runner} position-z={z} material={wood} />)}
    {[-0.12, 0.12].map(x => [-0.07, 0.07].map(z => <mesh key={`${x}:${z}`} position={[x, 0.12, z]} rotation-z={x * 0.5} material={wood}>
      <cylinderGeometry args={[0.014, 0.018, 0.17, 8]} />
    </mesh>))}
    <mesh position={[0, 0.23, 0]} rotation-z={Math.PI / 2} material={wood} castShadow>
      <capsuleGeometry args={[0.067, 0.19, 5, 10]} />
    </mesh>
    <mesh position={[0.12, 0.3, 0]} rotation-z={-0.45} material={wood}><cylinderGeometry args={[0.032, 0.045, 0.16, 10]} /></mesh>
    <mesh position={[0.175, 0.365, 0]} scale={[1.2, 0.85, 0.75]} material={wood}><sphereGeometry args={[0.056, 12, 8]} /></mesh>
    <mesh position={[0.2, 0.366, 0]} material={wood}><capsuleGeometry args={[0.023, 0.04, 4, 8]} /></mesh>
    {[-0.024, 0.024].map(z => <mesh key={z} position={[0.145, 0.419, z]} rotation-z={-0.18} material={wood}><coneGeometry args={[0.013, 0.06, 7]} /></mesh>)}
    <mesh position={[0.176, 0.38, 0.046]}><sphereGeometry args={[0.005, 6, 6]} /><meshStandardMaterial color="#1b1510" /></mesh>
    <mesh position={[-0.17, 0.24, 0]} rotation-y={Math.PI / 2} material={periodMaterial('cloth', '#473425')}><torusGeometry args={[0.06, 0.014, 5, 16, Math.PI * 0.8]} /></mesh>
  </group>
}

function photoTexture(extraShadow: boolean) {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#82745b'; ctx.fillRect(0, 0, w, h)
    const grain = rng(28)
    for (let i = 0; i < 5500; i++) {
      ctx.fillStyle = grain() > 0.5 ? 'rgba(214,197,155,0.09)' : 'rgba(25,23,17,0.08)'
      ctx.fillRect(grain() * w, grain() * h, 1.5, 1.5)
    }
    if (extraShadow) {
      ctx.fillStyle = 'rgba(34,25,26,0.45)'
      ctx.ellipse(w * 0.88, h * 0.31, 23, 30, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.moveTo(w * 0.79, h * 0.83); ctx.lineTo(w * 0.83, h * 0.4); ctx.lineTo(w * 0.93, h * 0.4); ctx.lineTo(w, h * 0.83); ctx.fill()
    }
    const people = [[0.28, 0.46, 0.5], [0.64, 0.43, 0.53], [0.46, 0.61, 0.3]]
    for (const [x, y, bh] of people) {
      ctx.fillStyle = '#3d3930'; ctx.beginPath(); ctx.ellipse(w * x, h * y, w * 0.075, h * 0.105, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#514c3d'; ctx.fillRect(w * (x - 0.09), h * (y + 0.08), w * 0.18, h * bh)
    }
    // Meera's face was scratched out. The other figures are featureless in the tiny print.
    ctx.strokeStyle = '#a29270'; ctx.lineWidth = 5
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(w * 0.38 + i * 7, h * 0.54); ctx.lineTo(w * 0.35 + i * 9, h * 0.72); ctx.stroke() }
  }, 384, 512)
}

export function FamilyPhoto({ id, position, rotation, fourthShadow = false }: { id?: string; position: Vec3; rotation?: Vec3; fourthShadow?: boolean }) {
  const texture = useMemo(() => photoTexture(fourthShadow), [fourthShadow])
  return <group name={id} position={position} rotation={rotation}>
    <WoodBox position={[0, 0, 0]} size={[0.58, 0.79, 0.04]} material={periodMaterial('wood', '#48382b')} />
    <mesh position={[0, 0, 0.025]}><planeGeometry args={[0.49, 0.68]} /><meshStandardMaterial map={texture} roughness={0.96} /></mesh>
  </group>
}

export function Diary({ position, paperBurn }: { position: Vec3; paperBurn?: { at: number; duration: number } }) {
  const cover = periodMaterial('cloth', '#504837')
  const paper = useMemo(() => canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#c8bb98'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#44392b'; ctx.textAlign = 'left'
    ctx.font = 'bold 21px serif'; ctx.fillText('17 August 1992', 29, 55)
    ctx.font = 'italic 20px serif'
    const left = ['The girl from the crossing', 'came again. She asked', 'for shelter.', '', 'I told her to leave.']
    const right = ['Meera heard her crying.', 'You watched from', 'the window.', '', 'I locked our door.', '', 'Meera opened ours.']
    for (const [column, lines] of [left, right].entries()) lines.forEach((line, i) => ctx.fillText(line, 29 + column * 256, 98 + i * 34))
    ctx.strokeStyle = '#827455'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(256, 23); ctx.lineTo(256, h - 23); ctx.stroke()
  }, 512, 512), [])
  const burnUniform = useMemo(() => ({ value: 0 }), [])
  const pages = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.98, side: THREE.DoubleSide })
    material.onBeforeCompile = shader => {
      shader.uniforms.uBurn = burnUniform
      shader.vertexShader = `uniform float uBurn;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
        float burnEdge = vMapUv.x * 0.7 + (1.0 - vMapUv.y);
        transformed.z += clamp(uBurn * 1.85 - burnEdge, 0.0, 1.0) * (0.012 + 0.024 * sin(vMapUv.y * 3.14159));`)
      shader.fragmentShader = `uniform float uBurn;\n${shader.fragmentShader}`.replace('#include <map_fragment>', `#include <map_fragment>
        float burnEdge = vMapUv.x * 0.7 + (1.0 - vMapUv.y);
        float burnFront = uBurn * 1.85 - burnEdge;
        if (burnFront > 0.11) discard;
        float charred = uBurn <= 0.0 ? 0.0 : smoothstep(-0.025, 0.035, burnFront);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.018, 0.012), charred);`)
    }
    material.customProgramCacheKey = () => 'kaali-diary-burn-v1'
    return material
  }, [paper, burnUniform])
  useFrame(() => {
    const valid = paperBurn && [paperBurn.at, paperBurn.duration].every(Number.isFinite) && paperBurn.duration > 0
    burnUniform.value = valid ? THREE.MathUtils.clamp((clock.t - paperBurn.at) / paperBurn.duration, 0, 1) : 0
  })
  return <group position={position} rotation-y={0.15}>
    <WoodBox position={[0, 0.0045, 0]} size={[0.29, 0.009, 0.37]} material={cover} />
    {[0, 1, 2, 3].map(i => <WoodBox key={i} position={[(i - 1.5) * 0.002, 0.011 + i * 0.002, 0]} size={[0.272, 0.002, 0.352]} material={periodMaterial('paper', '#b9ad8f')} />)}
    <WoodBox position={[0, 0.019, 0]} size={[0.008, 0.013, 0.35]} material={cover} />
    <mesh position={[0, 0.021, 0]} rotation-x={-Math.PI / 2} material={pages}><planeGeometry args={[0.27, 0.35, 12, 16]} /></mesh>
  </group>
}

export function WallCalendar({ position, rotation }: { position: Vec3; rotation?: Vec3 }) {
  const texture = useMemo(() => canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#c8c0a3'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#7d4d3f'; ctx.fillRect(0, 0, w, 86)
    ctx.fillStyle = '#e2d7b4'; ctx.font = '38px serif'; ctx.textAlign = 'center'; ctx.fillText('अगस्त  1992', w / 2, 58)
    ctx.fillStyle = '#3a3b2d'; ctx.font = '28px serif'
    for (let i = 0; i < 31; i++) ctx.fillText(String(i + 1), 48 + (i % 7) * 69, 152 + Math.floor(i / 7) * 65)
    ctx.strokeStyle = '#825c47'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(48 + 2 * 69, 140, 27, 34, 0, 0, Math.PI * 2); ctx.stroke()
  }), [])
  return <mesh position={position} rotation={rotation}><planeGeometry args={[0.42, 0.55]} /><meshStandardMaterial map={texture} roughness={1} /></mesh>
}

export function WallClock({ position, rotation }: { position: Vec3; rotation?: Vec3 }) {
  return <group position={position} rotation={rotation}>
    <mesh rotation-x={Math.PI / 2} material={periodMaterial('metal', '#797873')}><cylinderGeometry args={[0.16, 0.16, 0.035, 32]} /></mesh>
    <mesh position-z={0.021}><circleGeometry args={[0.138, 32]} /><meshStandardMaterial color="#b5ae99" roughness={0.9} /></mesh>
    <WoodBox position={[-0.032, 0.029, 0.025]} size={[0.017, 0.105, 0.005]} rotation={[0, 0, 0.66]} material={periodMaterial('metal', '#30312e')} />
    <WoodBox position={[0.054, 0.024, 0.028]} size={[0.009, 0.14, 0.005]} rotation={[0, 0, 1.42]} material={periodMaterial('metal', '#30312e')} />
  </group>
}

export function CeilingFan({ position, children }: { position: Vec3; children?: ReactNode }) {
  return <group position={position}>
    <mesh material={periodMaterial('metal', '#6a665c')}><cylinderGeometry args={[0.095, 0.095, 0.13, 16]} /></mesh>
    <mesh position={[0, 0.14, 0]} material={periodMaterial('metal', '#6a665c')}><cylinderGeometry args={[0.015, 0.015, 0.19, 8]} /></mesh>
    {[0, 1, 2].map(i => <group key={i} rotation-y={i * Math.PI * 2 / 3}>
      <WoodBox position={[0.36, 0, 0]} size={[0.55, 0.018, 0.13]} material={periodMaterial('metal', '#62635c')} />
    </group>)}
    {children}
  </group>
}
