import { useState } from 'react'
import type { RepoStatus } from '../../../shared/types'

interface Props {
  status: RepoStatus
  onCommitted: () => void
}

export default function CommitBox({ status, onCommitted }: Props) {
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stagedCount = status.staged.length
  const canCommit = summary.trim().length > 0 && stagedCount > 0 && !busy

  async function doCommit() {
    if (!canCommit) return
    setBusy(true)
    setError(null)
    const res = await window.gitApi.commit(summary.trim(), description)
    setBusy(false)
    if (res.ok) {
      setSummary('')
      setDescription('')
      onCommitted()
    } else {
      setError(res.error ?? 'Commit failed')
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      doCommit()
    }
  }

  return (
    <div className="commit-box" onKeyDown={onKeyDown}>
      <input
        className="commit-summary"
        placeholder="Summary (required)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <textarea
        className="commit-description"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      {error && <div className="commit-error">{error}</div>}
      <button className="commit-btn" disabled={!canCommit} onClick={doCommit}>
        {busy
          ? 'Committing…'
          : `Commit ${stagedCount > 0 ? `${stagedCount} file${stagedCount === 1 ? '' : 's'}` : ''}`}
        <span className="commit-branch">{status.branch}</span>
      </button>
    </div>
  )
}
