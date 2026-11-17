import assert from 'node:assert/strict'
import fs from 'node:fs'
import { connect } from './browser-audit.mjs'

const scene = process.argv[2] || 'p1_road'
const time = Number(process.argv[3] || 14)
const output = process.argv[4] || 'threert/assets/crossing.glb'
assert(fs.existsSync('threert'), 'Run from the repository root')
assert(/^[a-z0-9_]+$/.test(scene) && Number.isFinite(time) && time >= 0, 'Valid scene id and time required')
const origin = 'http://127.0.0.1:5173/?start=part1'
const browser = await connect('kaali-threert-export', origin)
try {
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await browser.call('Runtime.enable')
  browser.on('Runtime.exceptionThrown', data => console.error('Story exception:', data.exceptionDetails))
  if (await browser.evaluate('!!document.querySelector(".gate")')) {
    await browser.until('typeof kr === "object"')
    await browser.click('.gate')
  }
  await browser.until('document.querySelector(".dev-scene")?.textContent?.includes("p1_road") && typeof r3f === "object"')
  await browser.evaluate(`kr.skip(${time})`)
  await browser.wait(700)
  assert(!fs.existsSync(output), `Choose a new output path: ${output} already exists`)
  const dir = (await import('node:path')).dirname(output)
  fs.mkdirSync(dir, { recursive: true })
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true })
  const result = await browser.evaluate(`(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js')
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js')
    const state = r3f
    const source = state.scene
    const clone = source.clone(true)
    const replacements = new Map()
    const skip = []
    clone.traverse(object => {
      if (object.isPoints || object.isLine) skip.push(object)
      if (!object.isMesh && !object.isSkinnedMesh) return
      const material = object.material
      if (material?.isShaderMaterial) {
        if (!replacements.has(material.uuid)) replacements.set(material.uuid, new THREE.MeshStandardMaterial({
          name: material.name + '-portable',
          color: material.uniforms?.uColor?.value?.isColor ? material.uniforms.uColor.value : 0x303138,
          roughness: 0.85,
          transparent: material.transparent,
          opacity: material.opacity,
          side: material.side,
        }))
        object.material = replacements.get(material.uuid)
      }
    })
    for (const object of skip) object.removeFromParent()
    const gltf = await new GLTFExporter().parseAsync(clone, { binary: true, onlyVisible: true, maxTextureSize: 1024 })
    const bytes = new Uint8Array(gltf)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'crossing.glb'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    const camera = state.camera
    const position = camera.getWorldPosition(new THREE.Vector3())
    const target = position.clone().add(camera.getWorldDirection(new THREE.Vector3()))
    const lights = []
    source.traverse(object => {
      if (!object.isLight) return
      lights.push({
        type: object.type,
        position: object.getWorldPosition(new THREE.Vector3()).toArray(),
        target: object.target ? object.target.getWorldPosition(new THREE.Vector3()).toArray() : [position.x, 0, position.z],
        color: [object.color.r, object.color.g, object.color.b],
        intensity: object.intensity,
        distance: object.distance || 0,
        angle: object.angle || Math.PI / 2,
        penumbra: object.penumbra || 0,
        decay: object.decay || 1,
      })
    })
    return {
      scene: 'p1_road', time: ${time}, model: 'assets/crossing.glb',
      camera: { position: position.toArray(), target: target.toArray(), fov: camera.fov, near: camera.near, far: camera.far },
      lights,
      fog: source.fog ? { color: [source.fog.color.r, source.fog.color.g, source.fog.color.b], density: source.fog.density || 0 } : null,
      portable: { instancing: 'KHR_mesh_gpu_instancing', skinning: 'KHR_mesh_quantization when exported', particles: false, postEffects: false },
    }
  })()`)
  assert(result, 'No scene snapshot returned')
  let download
  for (let i = 0; i < 150; i++) {
    download = [...browser.downloads.values()].at(-1)
    if (download?.state === 'completed') break
    await browser.wait(100)
  }
  assert(download?.state === 'completed', 'GLB download did not complete')
  if (download.suggestedFilename !== 'crossing.glb') fs.renameSync(`${dir}/${download.suggestedFilename}`, output)
  assert(fs.existsSync(output) && fs.statSync(output).size > 20, 'GLB export incomplete')
  fs.writeFileSync('threert/snapshot.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ ok: true, scene, time, output, size: fs.statSync(output).size, lights: result.lights.length, fog: result.fog }))
} finally {
  browser.close()
}
