// Evaluate in the dev page (after tapping to begin): renders a whole playthrough frame by frame from the
// game canvas into captures/frames/pt_00001.jpg… (dev /__capture endpoint), deterministic at `fps`.
// Then: ffmpeg -framerate 15 -i captures/frames/pt_%05d.jpg -pix_fmt yuv420p captures/playthrough.mp4
// Note: captions and the fade overlay are DOM, so they're not in these frames (picture only).
async function renderPlaythrough({ knot, picks = [], fps = 15, maxSeconds = 240, holdOnChoice = 1.5 }) {
  const { useStore } = await import('/src/state/store.ts')
  kr.start(knot)
  kr.setPaused(true)
  const raf = () => new Promise((r) => requestAnimationFrame(r))
  let frame = 0, held = 0
  for (; frame < maxSeconds * fps; frame++) {
    const s = useStore.getState()
    if (s.phase === 'ended' || s.phase === 'dead') break
    if (s.phase === 'choice' && (held += 1 / fps) >= holdOnChoice) { kr.choose(s.choices[picks.shift() ?? 0].index); held = 0 }
    kr.step(1 / fps)
    await raf()
    const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.82)
    await fetch(`/__capture?name=pt_${String(frame).padStart(5, '0')}.jpg`, { method: 'POST', body: url })
  }
  kr.setPaused(false)
  return frame
}
