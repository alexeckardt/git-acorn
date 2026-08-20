import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  /** Render a divider above this item. */
  divider?: boolean
  /** Muted, non-interactive row (e.g. a status hint). */
  disabled?: boolean
}

export interface SwatchRow {
  /** Solid colours to show as pickable dots. */
  colors: string[]
  /** Currently applied index, or null when none is set. */
  active: number | null
  /** Pick an index, or null to clear. */
  onPick: (index: number | null) => void
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
  /** Optional colour picker rendered above the items. */
  swatches?: SwatchRow
}

export default function ContextMenu({ x, y, items, onClose, swatches }: Props) {
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
      {swatches && (
        <div className="menu-swatches">
          <button
            className={`swatch swatch-none${swatches.active === null ? ' active' : ''}`}
            title="No colour"
            onClick={() => {
              swatches.onPick(null)
              onClose()
            }}
          />
          {swatches.colors.map((c, i) => (
            <button
              key={c}
              className={`swatch${swatches.active === i ? ' active' : ''}`}
              style={{ background: c }}
              title={`Colour ${i + 1}`}
              onClick={() => {
                swatches.onPick(i)
                onClose()
              }}
            />
          ))}
        </div>
      )}
      {swatches && items.length > 0 && <div className="menu-divider" />}
      {items.map((it, i) => (
        <div key={i}>
          {it.divider && <div className="menu-divider" />}
          <button
            className={`menu-item${it.danger ? ' danger' : ''}${it.disabled ? ' disabled' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return
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
