import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Plain DOM labels avoid both an extra React root and HTML children entering R3F's scene graph. */
export function ScreenOverlay({ label, className, title, onClick, button, passThrough }: { label: string; className?: string; title?: string; onClick?: () => void; button?: boolean; passThrough?: boolean }) {
  const anchor = useRef<THREE.Group>(null)
  const { gl, camera, size } = useThree()
  const element = useMemo(() => {
    const container = document.createElement('div')
    Object.assign(container.style, {
      position: 'fixed', left: '0', top: '0', zIndex: '3', display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '0', height: '0', pointerEvents: passThrough ? 'none' : 'auto',
    })
    const child = document.createElement(button ? 'button' : 'span')
    if (button) { child.setAttribute('type', 'button'); (child as HTMLButtonElement).disabled = !onClick }
    container.appendChild(child)
    return { container, child }
  }, [button, passThrough])
  useEffect(() => {
    const { container, child } = element
    document.body.appendChild(container)
    if (!onClick) return () => void container.remove()
    const down = (event: Event) => event.stopPropagation()
    const click = (event: Event) => { event.stopPropagation(); onClick() }
    child.addEventListener('pointerdown', down)
    child.addEventListener('click', click)
    return () => { child.removeEventListener('pointerdown', down); child.removeEventListener('click', click); container.remove() }
  }, [element, gl, onClick])
  useEffect(() => {
    element.child.className = className ?? ''
    element.child.textContent = label
    element.child.title = title ?? ''
  }, [element, className, label, title])
  const position = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const point = anchor.current?.getWorldPosition(position).project(camera)
    if (!point) return
    element.container.style.transform = `translate(-50%,-50%) translate(${size.left + (point.x * 0.5 + 0.5) * size.width}px,${size.top + (-point.y * 0.5 + 0.5) * size.height}px)`
    element.container.style.visibility = point.z > 1 || point.z < -1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1 ? 'hidden' : ''
  })
  return <group ref={anchor} />
}
