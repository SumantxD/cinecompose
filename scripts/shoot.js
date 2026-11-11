// Paste/evaluate in the dev page: grabs canvas frames at given story points into captures/frames/.
// shots: [name, knot, seconds]. Dev build only (needs preserveDrawingBuffer + /__capture).
async function shoot(shots) {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  for (const [name, knot, t] of shots) {
    kr.start(knot)
    kr.skip(t)
    await frame(); await frame()
    const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.85)
    await fetch('/__capture?name=' + name + '.jpg', { method: 'POST', body: url })
  }
  return shots.length
}
