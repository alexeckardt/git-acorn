import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NewBranchModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  async function create() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    const res = await window.gitApi.createBranch(trimmed)
    setBusy(false)
    if (res.ok) {
      onCreated()
      onClose()
    } else {
      setError(res.error ?? 'Could not create branch')
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="small-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="small-modal-title">New branch</div>
        <input
          ref={inputRef}
          className="small-modal-input"
          placeholder="branch-name"
          value={name}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              create()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        {error && <div className="small-modal-error">{error}</div>}
        <div className="small-modal-actions">
          <button className="tb-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="tb-btn primary" disabled={!name.trim() || busy} onClick={create}>
            {busy ? 'Creating…' : 'Create & switch'}
          </button>
        </div>
      </div>
    </div>
  )
}
