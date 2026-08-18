import { useEffect, useRef, useState } from 'react'
import { useRecentRepos } from '../lib/recentRepos'

interface Props {
  open: boolean
  currentPath: string | null
  error: string | null
  onClose: () => void
  onPick: (path: string) => void
  onOpenNew: () => void
}

export default function SwitchRepoModal({
  open,
  currentPath,
  error,
  onClose,
  onPick,
  onOpenNew
}: Props) {
  const repos = useRecentRepos()
  const [highlight, setHighlight] = useState(0)

  const listRef = useRef<HTMLDivElement>(null)
  const openNewRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const idx = repos.findIndex((r) => r.path === currentPath)
    setHighlight(idx >= 0 ? idx : 0)
    // Focus the list so arrow keys work immediately (or the open button if empty).
    setTimeout(() => {
      if (repos.length) listRef.current?.focus()
      else openNewRef.current?.focus()
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  // Tab cycles among the three zones: list → open-new → close (and wraps).
  function cycleFocus(shift: boolean) {
    const zones = [
      repos.length ? listRef.current : null,
      openNewRef.current,
      closeRef.current
    ].filter((el): el is HTMLDivElement | HTMLButtonElement => el !== null)
    if (zones.length === 0) return
    const active = document.activeElement as HTMLElement | null
    const idx = zones.findIndex((z) => z === active)
    const next = (idx + (shift ? -1 : 1) + zones.length) % zones.length
    zones[next].focus()
  }

  function onContainerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      cycleFocus(e.shiftKey)
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(repos.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = repos[highlight]
      if (r) onPick(r.path)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="switch-repo-modal" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onContainerKeyDown}>
        <div className="switch-repo-header">
          <div className="small-modal-title">Switch repository</div>
          <button ref={closeRef} className="icon-btn" title="Close (Esc)" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          className="repo-list"
          ref={listRef}
          tabIndex={0}
          role="listbox"
          aria-label="Recent repositories"
          onKeyDown={onListKeyDown}
        >
          {repos.length === 0 && <div className="empty-hint">No recent repositories yet</div>}
          {repos.map((r, i) => (
            <div
              key={r.path}
              role="option"
              aria-selected={i === highlight}
              className={`repo-item${i === highlight ? ' active' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => onPick(r.path)}
              title={r.path}
            >
              <div className="repo-item-name">
                {r.name}
                {r.path === currentPath && <span className="repo-current-badge">current</span>}
              </div>
              <div className="repo-item-path">{r.path}</div>
            </div>
          ))}
        </div>

        {error && <div className="small-modal-error">{error}</div>}

        <button ref={openNewRef} className="tb-btn open-new-btn" onClick={onOpenNew}>
          ＋ Open another repository…
        </button>
      </div>
    </div>
  )
}
