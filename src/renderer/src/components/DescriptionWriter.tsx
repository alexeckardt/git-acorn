import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangedFile } from '../../../shared/types'
import DiffView, { DiffMode } from './DiffView'
import { splitPath, statusBadge } from '../lib/util'

export interface DescEntry {
  path: string
  text: string
}

interface Props {
  files: ChangedFile[]
  /** completed=true when the flow reached the end / Done; false on Esc / cancel. */
  onFinish: (entries: DescEntry[], completed: boolean) => void
  /** Render inline (no overlay/header) for embedding in the commit wizard. */
  embedded?: boolean
}

export default function DescriptionWriter({ files, onFinish, embedded }: Props) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [entries, setEntries] = useState<DescEntry[]>([])
  const [mode, setMode] = useState<DiffMode>('line-by-line')
  const [primed, setPrimed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Clamp in case the file list shrinks (e.g. a background refresh) mid-flow.
  const safeIndex = Math.min(index, files.length - 1)
  const current = files[safeIndex]
  const isLast = safeIndex === files.length - 1

  useEffect(() => {
    inputRef.current?.focus()
  }, [index])

  /** Entries including whatever is currently typed (not yet saved). */
  function merged(): DescEntry[] {
    const t = text.trim()
    if (!t) return entries
    return [...entries.filter((e) => e.path !== current.path), { path: current.path, text: t }]
  }

  function advance() {
    const m = merged()
    setEntries(m)
    setText('')
    if (!isLast) setIndex(safeIndex + 1)
    else onFinish(m, true)
  }

  function skip() {
    setText('')
    if (!isLast) setIndex(safeIndex + 1)
    else onFinish(entries, true)
  }

  /** Ctrl/Cmd+Enter: prime the textbox, then fast-forward to finish. */
  function prime() {
    const m = merged()
    setEntries(m)
    setPrimed(true)
    setTimeout(() => onFinish(m, true), 480)
  }

  // Esc closes when standalone (the wizard owns Esc when embedded).
  useEffect(() => {
    if (embedded) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFinish(merged(), false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, entries, index, embedded])

  const diffSource = useMemo(
    () =>
      ({
        kind: current.staged ? ('workingStaged' as const) : ('workingUnstaged' as const),
        path: current.path
      }),
    [current.path, current.staged]
  )

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      prime()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      advance()
    }
  }

  const body = (
    <div className="desc-body">
      <div className="desc-main">
        
        <DiffView source={diffSource} mode={mode} onModeChange={setMode} title={current.path} />
        
        <div className="desc-input-row">
          <input
            ref={inputRef}
            className={`desc-input${primed ? ' primed' : ''}`}
            placeholder={`What changed in ${splitPath(current.path).name}?  ·  Enter next${
              embedded ? ', ⌘↵ to finish' : ', Esc to close'
            }`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <button className="tb-btn" onClick={skip} title="Skip this file">
            Skip
          </button>
          <button className="tb-btn primary" onClick={advance}>
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>

      <aside className="desc-list">
        <header className="section-head">
          <span>
            Changelog <span className="count">{entries.length}</span>
          </span>
        </header>
        <div className="desc-list-items">
          {files.map((f, i) => {
            const entry = entries.find((e) => e.path === f.path)
            const badge = statusBadge(f.status)
            const { name } = splitPath(f.path)
            return (
              <div
                key={f.path}
                className={`desc-list-item${i === safeIndex ? ' current' : ''}`}
                onClick={() => setIndex(i)}
                title={f.path}
              >
                <div className="desc-item-file">
                  <span className={`status-badge ${badge.cls}`}>{badge.letter}</span>
                  <span className="file-name">{name}</span>
                </div>
                <div className={`desc-item-text${entry ? '' : ' empty'}`}>
                  {entry ? entry.text : i === safeIndex ? 'describing…' : 'not described'}
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )

  if (embedded) {
    return <div className="desc-embedded">{body}</div>
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onFinish(merged(), false)}
    >
      <div className="desc-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="desc-header">
          <div className="desc-title-row">
            <strong>Describe changes</strong>
            <span className="muted">
              file {safeIndex + 1} of {files.length}
            </span>
          </div>
          <button className="icon-btn" title="Close (Esc)" onClick={() => onFinish(merged(), false)}>
            ✕
          </button>
        </header>
        {body}
      </div>
    </div>
  )
}
