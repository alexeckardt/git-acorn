import { useEffect, useMemo, useState } from 'react'
import { html as diff2html } from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'
import type { DiffSource } from '../../../shared/types'

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
      <div className="diff-body">
        {loading && <div className="diff-empty">Loading diff…</div>}
        {!loading && error && <div className="diff-empty error">{error}</div>}
        {!loading && !error && !raw.trim() && (
          <div className="diff-empty">
            {source ? 'No textual changes (binary file or no diff).' : 'Select a file to view its changes.'}
          </div>
        )}
        {!loading && !error && raw.trim() && (
          <div className="d2h-wrap" dangerouslySetInnerHTML={{ __html: rendered }} />
        )}
      </div>
    </div>
  )
}
