import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

// A small "About" card — the app icon, name, and current version — opened by
// clicking the brand in the title bar.
export default function AboutModal({ open, onClose }: Props) {
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (!open) return
    window.gitApi.appVersion().then(setVersion)
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="about-modal" onMouseDown={(e) => e.stopPropagation()}>
        <img className="about-icon" src="/icon.png" alt="" />
        <div className="about-name">git-acorn</div>
        <div className="about-version">{version ? `Version ${version}` : ' '}</div>
        <div className="about-tagline">A small, streamlined git client for solo developers.</div>
        <div className="about-actions">
          <button className="tb-btn" onClick={() => window.updateApi.check()}>
            Check for updates
          </button>
          <button className="tb-btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
