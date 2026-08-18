import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  /** Render a divider above this item. */
  divider?: boolean
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Keep the menu on-screen.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (x + r.width > window.innerWidth) nx = window.innerWidth - r.width - 6
    if (y + r.height > window.innerHeight) ny = window.innerHeight - r.height - 6
    setPos({ x: Math.max(6, nx), y: Math.max(6, ny) })
  }, [x, y])

  // Close on outside click or Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: pos.y, left: pos.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => (
        <div key={i}>
          {it.divider && <div className="menu-divider" />}
          <button
            className={`menu-item${it.danger ? ' danger' : ''}`}
            onClick={() => {
              it.onClick()
              onClose()
            }}
          >
            {it.label}
          </button>
        </div>
      ))}
    </div>
  )
}
