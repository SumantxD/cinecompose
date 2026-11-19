import { useEffect, useRef } from 'react'
import { cceFrame } from '../cce/runtime'

/** Seekable flash/black/editorial layer; mounts once and reads the same clock state as export. */
export function ChoreographyOverlay() {
  const black = useRef<HTMLDivElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const update = () => {
      if (black.current) black.current.style.opacity = String(cceFrame.blackout)
      if (flash.current) flash.current.style.opacity = String(cceFrame.flash)
      if (text.current) {
        text.current.textContent = cceFrame.text ?? ''
        text.current.style.opacity = cceFrame.text ? '1' : '0'
      }
      raf = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div className="cce-overlay" aria-hidden="true">
    <div ref={black} className="cce-black" />
    <div ref={text} className="cce-editorial-text" />
    <div ref={flash} className="cce-flash" />
  </div>
}
