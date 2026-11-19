import { useStudio } from './studioStore'
import { getCameraPoint, shotPointCount } from '../cinematic/curve'

export function rememberCameraPoint(sceneId: string, index: number, node: number) {
  const st = useStudio.getState()
  st.set({ pointLocks: { ...st.pointLocks, [sceneId]: { index, node } } })
}

/** Camera numbers run consecutively across shots, including Bézier insertion points. */
export function cameraPointFromNumber(number: number) {
  const cfg = useStudio.getState().cfg
  let index = Math.max(1, Math.min(cfg.shots.reduce((n, shot) => n + shotPointCount(shot), 0), Math.floor(number))) - 1
  const clamped = index + 1
  for (let shot = 0; shot < cfg.shots.length; shot++) {
    const count = shotPointCount(cfg.shots[shot])
    if (index < count) return { index: shot, node: index, number: clamped }
    index -= count
  }
  return { index: 0, node: 0, number: 1 }
}

/** An explicit point selection is the lock, even if another editor takes focus afterwards. */
export function currentCameraPoint() {
  const st = useStudio.getState(), last = st.pointLocks[st.sceneId]
  if (last && st.cfg.shots[last.index]) {
    const node = Math.min(last.node, shotPointCount(st.cfg.shots[last.index]) - 1)
    let number = node + 1
    for (let i = 0; i < last.index; i++) number += shotPointCount(st.cfg.shots[i])
    return { ...last, node, number }
  }
  const total = st.cfg.shots.reduce((n, shot) => n + shotPointCount(shot), 0)
  let best = 1, distance = Infinity, start = 0, number = 1
  for (let index = 0; index < st.cfg.shots.length; index++) {
    const shot = st.cfg.shots[index]
    for (let node = 0; node < shotPointCount(shot); node++, number++) {
      const difference = Math.abs(start + getCameraPoint(shot, node).time - st.t)
      if (difference < distance) { distance = difference; best = number }
    }
    start += shot.duration
  }
  return cameraPointFromNumber(Math.min(best, total))
}

export function DirectorFrameControls({ frame, pair, step }: { frame: () => void; pair: () => void; step: (delta: number) => void }) {
  useStudio((s) => s.sel)
  useStudio((s) => s.t)
  useStudio((s) => s.cfg.shots)
  const st = useStudio.getState(), point = currentCameraPoint()
  const total = st.cfg.shots.reduce((n, shot) => n + shotPointCount(shot), 0), next = Math.min(total, point.number + 1)
  return <nav className="st-frame-tools" aria-label="Camera framing">
    <button aria-label="Previous numbered camera frame" title="Previous numbered camera frame ([)" disabled={st.exporting || point.number === 1} onClick={() => step(-1)}>‹</button>
    <button aria-label="Frame locked camera point" title="Copy the locked camera position and aim into this director view (G)" onClick={frame}>Frame {point.number}</button>
    <button aria-label="Next numbered camera frame" title="Next numbered camera frame (])" disabled={st.exporting || point.number === total} onClick={() => step(1)}>›</button>
    <button aria-label="Frame current to next camera points" title="Show current and next camera positions together (Shift+G)" disabled={st.exporting || point.number === total} onClick={pair}>{point.number} → {next}</button>
  </nav>
}
