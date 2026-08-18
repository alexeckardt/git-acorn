import { useEffect, useRef, useState } from 'react'
import type { RepoStatus } from '../../../shared/types'
import DescriptionWriter, { DescEntry } from './DescriptionWriter'
import { registerCommand } from '../lib/commands'
import { usePrefs } from '../lib/prefs'

interface Props {
  status: RepoStatus
  onCommitted: () => void
}

export default function CommitBox({ status, onCommitted }: Props) {
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showWriter, setShowWriter] = useState(false)
  // 'commit' → commit once the flow finishes; 'manual' → just fill the description.
  const [writerMode, setWriterMode] = useState<'commit' | 'manual'>('manual')
  // Configured in Preferences.
  const { autoDescribe } = usePrefs()

  const stagedCount = status.staged.length
  const canCommit = summary.trim().length > 0 && stagedCount > 0 && !busy

  // The describer works on the files being committed (staged), or — when nothing
  // is staged yet — on the working changes, so it isn't blocked by staging.
  const describeFiles = stagedCount > 0 ? status.staged : status.unstaged

  function openWriter(mode: 'commit' | 'manual') {
    if (describeFiles.length === 0) return
    setWriterMode(mode)
    setShowWriter(true)
  }

  // Expose commit / describe as app commands (menu + ⌘. shortcut). Refs keep the
  // handlers current without re-registering on every render.
  const doCommitRef = useRef<() => void>(() => {})
  const openWriterRef = useRef<() => void>(() => {})
  doCommitRef.current = () => doCommit()
  openWriterRef.current = () => openWriter('manual')
  useEffect(() => {
    const unsubs = [
      registerCommand('commit', () => doCommitRef.current()),
      registerCommand('describe-changes', () => openWriterRef.current())
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  async function performCommit(desc: string) {
    setBusy(true)
    setError(null)
    const res = await window.gitApi.commit(summary.trim(), desc)
    setBusy(false)
    if (res.ok) {
      setSummary('')
      setDescription('')
      onCommitted()
    } else {
      setError(res.error ?? 'Commit failed')
    }
  }

  function doCommit() {
    if (!canCommit) return
    if (!description.trim() && autoDescribe && stagedCount > 0) {
      openWriter('commit')
      return
    }
    performCommit(description)
  }

  function handleWriterFinish(entries: DescEntry[], completed: boolean) {
    setShowWriter(false)
    const bullets = entries
      .filter((e) => e.text.trim())
      .map((e) => `- ${e.text.trim()}`)
      .join('\n')
    const newDesc = bullets
      ? description.trim()
        ? `${description.trimEnd()}\n${bullets}`
        : bullets
      : description
    if (bullets) setDescription(newDesc)
    if (writerMode === 'commit' && completed) {
      performCommit(newDesc)
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

      <div className="commit-tools">
        <button
          className="text-btn"
          onClick={() => openWriter('manual')}
          disabled={describeFiles.length === 0}
          title="Describe changes file-by-file (⌘.)"
        >
          ✎ Describe changes
        </button>
      </div>

      {error && <div className="commit-error">{error}</div>}
      <button className="commit-btn" disabled={!canCommit} onClick={doCommit}>
        {busy
          ? 'Committing…'
          : `Commit ${stagedCount > 0 ? `${stagedCount} file${stagedCount === 1 ? '' : 's'}` : ''}`}
        <span className="commit-branch">{status.branch}</span>
      </button>

      {showWriter && describeFiles.length > 0 && (
        <DescriptionWriter files={describeFiles} onFinish={handleWriterFinish} />
      )}
    </div>
  )
}
