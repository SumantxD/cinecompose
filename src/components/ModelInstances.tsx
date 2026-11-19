import { Suspense, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../cinematic/clock'
import { SCENE_MODELS, type SceneModelId } from '../assets/manifest'

export interface ModelPlacement {
  x: number
  z: number
  y: number
  /** Target height in metres; the downloaded source scale never leaks into the set. */
  height: number
  rotation: number
}

const matrix = new THREE.Matrix4()
const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3()
const axis = new THREE.Vector3(0, 1, 0)

/** One InstancedMesh per source material. Geometry and textures stay in the GLTF cache. */
function Instances({ id, placements, wind = 0, castShadow = true }: { id: SceneModelId; placements: ModelPlacement[]; wind?: number; castShadow?: boolean }) {
  const { scene } = useGLTF(SCENE_MODELS[id].file, false, true)
  const prepared = useMemo(() => {
    scene.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(scene)
    const sourceHeight = Math.max(.001, bounds.max.y - bounds.min.y)
    const parts: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; local: THREE.Matrix4 }[] = []
    scene.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh) return
      const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
      const material = source.clone()
      material.transparent = false
      material.depthWrite = true
      const leaf = /leaf|leaves|fern|grass/i.test(source.name)
      if (source.map?.channel === 0 && leaf) material.alphaTest = .38
      if (material.alphaTest > 0) material.side = THREE.DoubleSide
      if (leaf) { material.roughness = Math.max(.92, material.roughness); material.normalScale.multiplyScalar(.5); material.metalness = 0 }
      material.envMapIntensity = .45
      if (/leaf|leaves|fern|grass/i.test(source.name)) {
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uWindTime = uniforms.uWindTime
          shader.uniforms.uWindStrength = uniforms.uWindStrength
          shader.vertexShader = `uniform float uWindTime; uniform float uWindStrength;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
            float phase = instanceMatrix[3].x * .31 + instanceMatrix[3].z * .23;
            float tip = clamp(position.y / 5., 0., 1.);
            transformed.x += sin(uWindTime * .63 + phase) * tip * tip * .23 * uWindStrength;
            transformed.z += cos(uWindTime * .47 + phase) * tip * tip * .11 * uWindStrength;`)
        }
        material.customProgramCacheKey = () => 'forest-leaf-wind-v1'
      }
      parts.push({ geometry: mesh.geometry, material, local: mesh.matrixWorld.clone() })
    })
    return { parts, sourceHeight, minY: bounds.min.y }
  }, [scene, id])
  const uniforms = useMemo(() => ({ uWindTime: { value: 0 }, uWindStrength: { value: wind } }), [])
  useFrame(() => { uniforms.uWindTime.value = clock.t; uniforms.uWindStrength.value = wind })
  useEffect(() => () => prepared.parts.forEach((part) => part.material.dispose()), [prepared])
  const matrices = useMemo(() => placements.map((p) => {
    const unit = p.height / prepared.sourceHeight
    position.set(p.x, p.y - prepared.minY * unit, p.z)
    rotation.setFromAxisAngle(axis, p.rotation)
    scale.setScalar(unit)
    return new THREE.Matrix4().compose(position, rotation, scale)
  }), [placements, prepared])
  return <group name={`asset-${id}`}>
    {prepared.parts.map((part, index) => <instancedMesh key={index} args={[part.geometry, part.material, matrices.length]} castShadow={castShadow} receiveShadow
      ref={(mesh) => {
        if (!mesh) return
        matrices.forEach((root, i) => { matrix.multiplyMatrices(root, part.local); mesh.setMatrixAt(i, matrix) })
        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingBox()
        mesh.computeBoundingSphere()
      }} />)}
  </group>
}

/** Async failure stays at the asset boundary; it never removes the lit terrain or the character editor. */
export function ModelInstances({ id, placements, wind = 0, castShadow = true }: { id: SceneModelId; placements: ModelPlacement[]; wind?: number; castShadow?: boolean }) {
  return <Suspense fallback={null}>{placements.length ? <Instances id={id} placements={placements} wind={wind} castShadow={castShadow} /> : null}</Suspense>
}
