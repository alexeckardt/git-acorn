import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Commit to tag; null when the modal is closed. */
  hash: string | null
  onClose: () => void
  /** Called after a tag is created (and optionally pushed). */
  onDone: (pushed: boolean, name: string) => void
}

// Create a tag on a commit — the in-app way to cut a new version. An optional
// message makes it an annotated tag, and "Push to origin" sends it to the remote
// (which is what triggers the release workflow).
export default function TagModal({ hash, onClose, onDone }: Props) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [push, setPush] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (hash === null) return
    setName('')
    setMessage('')
    setPush(true)
    setBusy(false)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [hash])

  if (hash === null) return null

  async function submit() {
    const tag = name.trim()
    if (!tag || busy) return
    setBusy(true)
    setError(null)

    const created = await window.gitApi.createTag(tag, hash ?? undefined, message.trim() || undefined)
    if (!created.ok) {
      setBusy(false)
      setError(created.error ?? 'Could not create the tag')
      return
    }

    if (push) {
      const pushed = await window.gitApi.pushTag(tag)
      if (!pushed.ok) {
        setBusy(false)
        // The tag exists locally even though the push failed — say so.
        setError(`Tag created locally, but pushing failed: ${pushed.error ?? 'unknown error'}`)
        return
      }
    }

    setBusy(false)
    onDone(push, tag)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="small-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="small-modal-title">Create tag at {hash.slice(0, 7)}</div>

        <input
          ref={inputRef}
          className="small-modal-input"
          value={name}
          placeholder="v1.0.0"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <input
          className="small-modal-input"
          value={message}
          placeholder="Message (optional — makes an annotated tag)"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onKeyDown}
        />

        <label className="tag-push-row">
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
          <span>Push to origin (triggers a release)</span>
        </label>

        {error && <div className="small-modal-error">{error}</div>}

        <div className="small-modal-actions">
          <button className="tb-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="tb-btn primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : push ? 'Create & push' : 'Create tag'}
          </button>
        </div>
      </div>
    </div>
  )
}
