import * as THREE from 'three'
import type { RigFace } from './rig.ts'
import type { FaceAdapter } from './facial.ts'

export interface FaceDetails {
  pupils: THREE.Mesh[]
  spirals: THREE.Mesh[]
  teeth: THREE.Mesh
  tongue: THREE.Mesh
  rim: THREE.Mesh
  nose: THREE.Mesh
  cheeks: THREE.Mesh[]
  tears: THREE.Mesh[]
  sweat: THREE.Mesh[]
}

export interface FacialRig extends RigFace {
  group: THREE.Group
  materials: THREE.Material[]
  details: FaceDetails
  dispose: () => void
}

export type ExpressionName = 'guarded' | 'fear' | 'tired' | 'trust' | 'grief'
export interface Expression {
  eyes: number
  browRaise: number
  browAngle: number
  mouthOpen: number
  smile: number
  frown: number
}

export const EXPRESSIONS: Record<ExpressionName, Expression> = {
  guarded: { eyes: 0.78, browRaise: 0, browAngle: 0.04, mouthOpen: 0, smile: 0, frown: 0.08 },
  fear: { eyes: 1.15, browRaise: 0.014, browAngle: -0.24, mouthOpen: 0.14, smile: 0, frown: 0.45 },
  tired: { eyes: 0.38, browRaise: -0.007, browAngle: -0.16, mouthOpen: 0.025, smile: 0, frown: 0.18 },
  trust: { eyes: 0.88, browRaise: 0.001, browAngle: 0.08, mouthOpen: 0, smile: 0.38, frown: 0 },
  grief: { eyes: 0.56, browRaise: -0.003, browAngle: -0.2, mouthOpen: 0.04, smile: 0, frown: 0.62 },
}

function mouthGeometry() {
  const geometry = new THREE.SphereGeometry(1, 18, 10)
  const p = geometry.getAttribute('position')
  const open: number[] = [], smile: number[] = [], frown: number[] = []
  for (let i = 0; i < p.count; i++) {
    open.push(0, p.getY(i) * 2, 0)
    const corner = p.getX(i) ** 2
    smile.push(0, corner - p.getY(i) * 0.35, 0)
    frown.push(0, -corner + p.getY(i) * 0.35, 0)
  }
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(open, 3), new THREE.Float32BufferAttribute(smile, 3), new THREE.Float32BufferAttribute(frown, 3)]
  geometry.morphTargetsRelative = true
  return geometry
}

export function createFacialFeatures(): FacialRig {
  const group = new THREE.Group()
  group.name = 'facialFeatures'
  const white = new THREE.MeshStandardMaterial({ color: '#d0c9ba', roughness: 0.72 })
  const dark = new THREE.MeshStandardMaterial({ color: '#19181a', roughness: 0.68 })
  const hair = new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.82 })
  const lips = new THREE.MeshStandardMaterial({ color: '#58392c', roughness: 0.86 })
  const skin = new THREE.MeshStandardMaterial({ color: '#594033', roughness: 0.82 })
  const teeth = new THREE.MeshStandardMaterial({ color: '#d8cdb9', roughness: 0.68, transparent: true })
  const tongue = new THREE.MeshStandardMaterial({ color: '#a46b71', roughness: 0.85, transparent: true })
  const tears = new THREE.MeshStandardMaterial({ color: '#87bbcc', roughness: 0.22, transparent: true, depthWrite: false })
  const sweat = new THREE.MeshStandardMaterial({ color: '#a8c1c7', roughness: 0.25, transparent: true })
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: '#301b20', roughness: 0.86 })
  const materials = [white, dark, hair, lips, skin, teeth, tongue, tears, sweat, mouthMaterial]

  const eyeGeometry = new THREE.SphereGeometry(0.014, 16, 10)
  const pupilGeometry = new THREE.CircleGeometry(0.0045, 14)
  const pupils: THREE.Mesh[] = [], spirals: THREE.Mesh[] = [] = []
  const spiralGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 27 }, (_, index) => {
    const angle = index / 26 * Math.PI * 3.5, radius = .0003 + index / 26 * .0038
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
  })), 36, .00035, 4, false)
  const eyes = [-1, 1].map(side => {
    const mesh = new THREE.Mesh(eyeGeometry, white)
    mesh.name = side < 0 ? 'rightEye' : 'leftEye'
    mesh.position.set(side * 0.029, 0.075, 0.0925)
    mesh.scale.set(1, .7, .16)
    const pupil = new THREE.Mesh(pupilGeometry, dark)
    pupil.name = side < 0 ? 'rightPupil' : 'leftPupil'
    pupil.position.z = .0145
    mesh.add(pupil)
    const spiral = new THREE.Mesh(spiralGeometry, dark)
    spiral.name = side < 0 ? 'rightSpiral' : 'leftSpiral'
    spiral.position.z = .001
    spiral.visible = false
    pupil.add(spiral)
    pupils.push(pupil); spirals.push(spiral)
    group.add(mesh)
    return mesh
  }) as unknown as [THREE.Mesh, THREE.Mesh]

  const browGeometry = new THREE.CapsuleGeometry(.002, .026, 3, 8)
  browGeometry.rotateZ(Math.PI / 2)
  const brows = [-1, 1].map(side => {
    const mesh = new THREE.Mesh(browGeometry, hair)
    mesh.name = side < 0 ? 'rightBrow' : 'leftBrow'
    mesh.position.set(side * 0.029, 0.09, 0.092)
    group.add(mesh)
    return mesh
  }) as unknown as [THREE.Mesh, THREE.Mesh]

  const nose = new THREE.Mesh(new THREE.SphereGeometry(.008, 10, 7), skin)
  nose.name = 'nose'
  nose.scale.set(.7, .85, .9)
  nose.position.set(0, .056, .098)
  group.add(nose)
  const mouth = new THREE.Mesh(mouthGeometry(), mouthMaterial)
  mouth.name = 'mouth'
  mouth.position.set(0, 0.018, 0.093)
  mouth.scale.set(0.027, 0.003, 0.0025)
  mouth.morphTargetDictionary = { mouthOpen: 0, smile: 1, frown: 2 }
  mouth.morphTargetInfluences = [0, 0, 0]
  group.add(mouth)

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, .13, 6, 24), lips)
  rim.position.set(0, .018, .096)
  rim.scale.set(.026, .005, .0015)
  rim.name = 'mouthRim'
  group.add(rim)
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(1.42, .3, .55), teeth)
  tooth.name = 'teeth'
  tooth.position.set(0, .27, .78)
  mouth.add(tooth)
  const tongueMesh = new THREE.Mesh(new THREE.SphereGeometry(.52, 12, 7), tongue)
  tongueMesh.name = 'tongue'
  tongueMesh.position.set(0, -.4, .78)
  tongueMesh.scale.set(1, .3, .45)
  mouth.add(tongueMesh)
  const cheeks = [-1, 1].map(side => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.012, 10, 7), skin)
    mesh.name = side < 0 ? 'rightCheek' : 'leftCheek'
    mesh.position.set(side * .064, .044, .074)
    mesh.scale.set(1, .8, .45)
    mesh.visible = false; group.add(mesh)
    return mesh
  })
  const tearsMeshes = [-1, 1].map(side => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.003, 8, 6), tears)
    mesh.name = side < 0 ? 'rightTear' : 'leftTear'
    mesh.scale.set(1, 2.7, .65)
    mesh.visible = false; group.add(mesh)
    return mesh
  })
  const sweatMesh = new THREE.Mesh(new THREE.SphereGeometry(.0035, 8, 6), sweat)
  sweatMesh.name = 'sweatDrop'
  sweatMesh.scale.set(1, 1.65, .6)
  sweatMesh.visible = false; group.add(sweatMesh)

  const face: FacialRig = {
    group, materials, eyes, brows, mouth,
    details: { pupils, spirals, teeth: tooth, tongue: tongueMesh, rim, nose, cheeks, tears: tearsMeshes, sweat: [sweatMesh] },
    eyeRest: eyes.map(mesh => mesh.position.clone()), browRest: brows.map(mesh => mesh.position.clone()),
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(materials)
      group.traverse(node => {
        if (node instanceof THREE.Mesh || node instanceof THREE.Line) geometries.add(node.geometry)
        const material = (node as THREE.Mesh).material
        if (material) for (const value of Array.isArray(material) ? material : [material]) mats.add(value)
      })
      geometries.forEach(geometry => geometry.dispose())
      mats.forEach(material => material.dispose())
    },
  }
  applyExpression(face, 'guarded')
  return face
}

export function applyExpression(face: FacialRig, name: ExpressionName) {
  const pose = EXPRESSIONS[name]
  face.eyes.forEach(eye => { eye.scale.y = .7 * pose.eyes })
  face.brows.forEach((brow, index) => {
    brow.position.copy(face.browRest[index])
    brow.position.y += pose.browRaise
    brow.rotation.z = (index === 0 ? -1 : 1) * pose.browAngle * 1.6
  })
  face.mouth.morphTargetInfluences = [pose.mouthOpen, pose.smile, pose.frown]
}

const eyeWhite = new THREE.Color('#d0c9ba'), bloodshot = new THREE.Color('#c48982')

export function createProceduralFaceAdapter(face: FacialRig): FaceAdapter {
  const d = face.details, white = face.eyes[0].material as THREE.MeshStandardMaterial
  return {
    kind: 'procedural',
    apply(pose, time: number) {
      const asymmetry = [1 - pose.eyeAsymmetry * .35, 1 + pose.eyeAsymmetry * .35]
      face.eyes.forEach((eye, index) => {
        const side = index === 0 ? -1 : 1
        eye.scale.set(pose.eyeWide * (1 + pose.eyeAsymmetry * side * .08), .7 * pose.eyeOpen * asymmetry[index], .35)
        eye.position.copy(face.eyeRest[index])
        eye.position.x += Math.sin(time * 1.9 + index) * .0015 * pose.distort
        const pupil = d.pupils[index]
        pupil.position.x = (pose.pupilX - side * pose.pupilAsymmetry * .5) * .0035
        pupil.position.y = pose.pupilY * .0035 + pose.distort * Math.sin(time * 3.7 + index) * .0007
        pupil.scale.setScalar(pose.pupilDilate)
        d.spirals[index].visible = pose.pupilSpiral > .05
        pupil.visible = pose.pupilSpiral < .9
        d.spirals[index].rotation.z = time * .85 * pose.pupilSpiral
        const brow = face.brows[index]
        brow.position.copy(face.browRest[index])
        brow.position.y += pose.browRaise * .012 + side * pose.browAsymmetry * .007
        brow.position.z = .087
        brow.rotation.z = side * pose.browAngle * .32 + side * pose.browAsymmetry * .12
      })
      white.color.copy(eyeWhite).lerp(bloodshot, pose.bloodshot * .6)
      const open = pose.mouthOpen, width = 1 + pose.mouthWidth * .28 - pose.mouthRound * .15
      face.mouth.morphTargetInfluences = [open * 1.2, pose.smile, pose.frown]
      face.mouth.scale.set(.027 * width, .003 * (1 + pose.mouthRound * .45) * (1 + pose.smileAsymmetry * .1), .0025)
      face.mouth.rotation.z = pose.smileAsymmetry * .13
      d.rim.visible = open > .08 || pose.smile > .12 || pose.frown > .12
      d.rim.position.y = .018
      d.rim.scale.set(.026 * width, .003 + open * .01, .001)
      d.rim.rotation.z = face.mouth.rotation.z
      d.teeth.visible = pose.teeth > .03
      ;(d.teeth.material as THREE.MeshStandardMaterial).opacity = Math.min(1, pose.teeth)
      d.tongue.visible = pose.tongue > .03 && open > .06
      ;(d.tongue.material as THREE.MeshStandardMaterial).opacity = pose.tongue
      d.tongue.position.y = -.4 - pose.tongue * .16
      d.nose.position.y = .056 + pose.nose * .002
      d.nose.scale.set(.7 + pose.nose * .12, .85 - pose.nose * .15, .9)
      d.cheeks.forEach((cheek, index) => {
        cheek.visible = pose.cheeks > .03
        const side = index === 0 ? -1 : 1
        cheek.position.x = side * (.064 + pose.cheeks * .006)
        cheek.scale.set(1 + pose.cheeks * .2, .8 + pose.cheeks * .12, .45)
      })
      d.tears.forEach((drop, index) => {
        const side = index === 0 ? -1 : 1, age = (time * .48 + index * .28) % 1
        drop.position.set(side * .031, .065 - age * .043 * pose.tears, .096)
        drop.visible = pose.tears > .05
        drop.scale.set(1 + pose.tears * .35, 2.5 + pose.tears * .6, .65)
        ;(drop.material as THREE.Material).opacity = pose.tears * Math.sin(age * Math.PI)
      })
      const bead = d.sweat[0]
      const age = (time * .32) % 1
      bead.position.set(.065, .102 - age * .021, .063)
      bead.visible = pose.sweat > .05
      ;(bead.material as THREE.Material).opacity = pose.sweat * Math.sin(age * Math.PI)
    },
  }
}
