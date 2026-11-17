import { Environment, Lightformer } from '@react-three/drei'

/**
 * Image-based "global illumination" for night exteriors: a code-built environment map (no downloads) —
 * dim cloud dome, a brighter band where the cloud catches far-off town light, warm patches toward the
 * sodium lamps. Fills shadows softly from every direction and gives wet surfaces something to reflect.
 * `intensity` comes from scene lighting (`gi`); tune with the Studio.
 */
export function NightSky({ intensity = 1, color = '#0d1219' }: { intensity?: number; color?: string }) {
  return (
    <Environment frames={1} resolution={128} environmentIntensity={intensity}>
      <color attach="background" args={[color]} />
      <Lightformer form="rect" intensity={0.9} color="#5d7290" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#6f7f96" position={[0, 2, -30]} scale={[80, 6, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#52627a" position={[0, 2, 30]} rotation-y={Math.PI} scale={[80, 5, 1]} />
      <Lightformer form="circle" intensity={2.5} color="#ff9a40" position={[3, 6, -12]} scale={3} />
      <Lightformer form="circle" intensity={2} color="#ff9a40" position={[-3, 6, 10]} scale={3} />
      <Lightformer form="rect" intensity={0.35} color="#3a3028" position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
    </Environment>
  )
}
