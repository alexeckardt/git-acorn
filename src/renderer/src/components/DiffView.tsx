import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { html as diff2html } from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'
import type { DiffSource } from '../../../shared/types'
import { isMac } from '../lib/commands'
import { applyMarks, clearMarks, focusHit, getScopes } from '../lib/diffSearch'

export type DiffMode = 'line-by-line' | 'side-by-side'

interface Props {
  source: DiffSource | null
  mode: DiffMode
  onModeChange: (m: DiffMode) => void
  /** A label describing what's being shown (path). */
  title?: string
}

export default function DiffView({ source, mode, onModeChange, title }: Props) {
  const [raw, setRaw] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!source) {
      setRaw('')
      setError(null)
      return
    }
    setLoading(true)
    window.gitApi.diff(source).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (res.ok) {
        setRaw(res.data ?? '')
        setError(null)
      } else {
        setRaw('')
        setError(res.error ?? 'Failed to load diff')
      }
    })
    return () => {
      cancelled = true
    }
  }, [source ? JSON.stringify(source) : null])

  const rendered = useMemo(() => {
    if (!raw.trim()) return ''
    return diff2html(raw, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: mode,
      colorScheme: 'dark' as never
    })
  }, [raw, mode])

  const hasDiff = !loading && !error && !!raw.trim()
  const split = mode === 'side-by-side'

  // ---- find (Ctrl/Cmd+F) -------------------------------------------------
  const [findOpen, setFindOpen] = useState(false)
  // Split view searches each column independently; inline uses `single`.
  const [qSingle, setQSingle] = useState('')
  const [qLeft, setQLeft] = useState('')
  const [qRight, setQRight] = useState('')
  const [count, setCount] = useState({ single: 0, left: 0, right: 0 })
  const [cur, setCur] = useState({ single: -1, left: -1, right: -1 })

  const wrapRef = useRef<HTMLDivElement>(null)
  const hits = useRef({
    single: [] as HTMLElement[],
    left: [] as HTMLElement[],
    right: [] as HTMLElement[]
  })
  const firstFieldRef = useRef<HTMLInputElement>(null)

  // Open on Ctrl/Cmd+F when a diff is showing; focus the first field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'f' && hasDiff) {
        e.preventDefault()
        setFindOpen(true)
        setTimeout(() => firstFieldRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasDiff])

  // Re-highlight whenever the content, mode, or a query changes. The diff DOM is
  // injected via dangerouslySetInnerHTML; React leaves it alone while `rendered`
  // is unchanged, so our marks survive unrelated re-renders.
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !rendered) return
    const scopes = getScopes(wrap, split)
    if (!scopes.split) {
      clearMarks(scopes.single[0])
      const h = applyMarks(scopes.single, qSingle)
      hits.current.single = h
      setCount((c) => ({ ...c, single: h.length }))
      const i = h.length ? 0 : -1
      setCur((c) => ({ ...c, single: i }))
      if (i >= 0) focusHit(h, i)
    } else {
      scopes.left.forEach(clearMarks)
      scopes.right.forEach(clearMarks)
      const hl = applyMarks(scopes.left, qLeft)
      const hr = applyMarks(scopes.right, qRight)
      hits.current.left = hl
      hits.current.right = hr
      setCount((c) => ({ ...c, left: hl.length, right: hr.length }))
      const il = hl.length ? 0 : -1
      const ir = hr.length ? 0 : -1
      setCur((c) => ({ ...c, left: il, right: ir }))
      if (il >= 0) focusHit(hl, il)
      if (ir >= 0) focusHit(hr, ir)
    }
  }, [rendered, split, qSingle, qLeft, qRight])

  function step(scope: 'single' | 'left' | 'right', dir: 1 | -1) {
    const list = hits.current[scope]
    if (!list.length) return
    const next = (cur[scope] + dir + list.length) % list.length
    setCur((c) => ({ ...c, [scope]: next }))
    focusHit(list, next)
  }

  function closeFind() {
    setFindOpen(false)
    setQSingle('')
    setQLeft('')
    setQRight('')
  }

  function fieldKey(scope: 'single' | 'left' | 'right') {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        step(scope, e.shiftKey ? -1 : 1)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation() // don't let App's global Escape reset the view
        closeFind()
      }
    }
  }

  const field = (
    scope: 'single' | 'left' | 'right',
    value: string,
    setValue: (v: string) => void,
    placeholder: string,
    ref?: React.Ref<HTMLInputElement>
  ) => (
    <div className="diff-find-field">
      <input
        ref={ref}
        className="diff-find-input"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={fieldKey(scope)}
      />
      <span className="diff-find-count">
        {value ? `${count[scope] ? cur[scope] + 1 : 0}/${count[scope]}` : ''}
      </span>
      <button className="diff-find-nav" title="Previous (Shift+Enter)" onClick={() => step(scope, -1)}>
        ↑
      </button>
      <button className="diff-find-nav" title="Next (Enter)" onClick={() => step(scope, 1)}>
        ↓
      </button>
    </div>
  )

  return (
    <div className="diff-view">
      <div className="diff-toolbar">
        <div className="diff-title" title={title}>
          {title ?? 'Diff'}
        </div>
        <div className="segmented">
          <button
            className={mode === 'line-by-line' ? 'active' : ''}
            onClick={() => onModeChange('line-by-line')}
            title="Inline / unified"
          >
            Inline
          </button>
          <button
            className={mode === 'side-by-side' ? 'active' : ''}
            onClick={() => onModeChange('side-by-side')}
            title="Split view"
          >
            Split
          </button>
        </div>
      </div>

      {findOpen && hasDiff && (
        <div className="diff-find">
          {split ? (
            <>
              {field('left', qLeft, setQLeft, 'Find in old…', firstFieldRef)}
              {field('right', qRight, setQRight, 'Find in new…')}
            </>
          ) : (
            field('single', qSingle, setQSingle, 'Find…', firstFieldRef)
          )}
          <button className="diff-find-close" title="Close (Esc)" onClick={closeFind}>
            ✕
          </button>
        </div>
      )}

      <div className="diff-body">
        {loading && <div className="diff-empty">Loading diff…</div>}
        {!loading && error && <div className="diff-empty error">{error}</div>}
        {!loading && !error && !raw.trim() && (
          <div className="diff-empty">
            {source ? 'No textual changes (binary file or no diff).' : 'Select a file to view its changes.'}
          </div>
        )}
        {hasDiff && (
          <div ref={wrapRef} className="d2h-wrap" dangerouslySetInnerHTML={{ __html: rendered }} />
        )}
      </div>
    </div>
  )
}
