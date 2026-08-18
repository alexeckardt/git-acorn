import { useEffect } from 'react'
import { setPref, usePrefs } from '../lib/prefs'

interface Props {
  open: boolean
  onClose: () => void
}

export default function PreferencesModal({ open, onClose }: Props) {
  const prefs = usePrefs()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="prefs-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="prefs-header">
          <div className="small-modal-title">Preferences</div>
          <button className="icon-btn" title="Close (Esc)" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="prefs-body">
          <div className="prefs-row">
            <div className="prefs-row-text">
              <div className="prefs-row-label">Commit workflow</div>
              <div className="prefs-row-desc">
                What the Commit button and ⌘/Ctrl+Enter do.
              </div>
            </div>
            <div className="segmented prefs-segmented">
              <button
                className={prefs.commitWorkflow === 'desktop' ? 'active' : ''}
                onClick={() => setPref('commitWorkflow', 'desktop')}
              >
                GitHub Desktop
              </button>
              <button
                className={prefs.commitWorkflow === 'wizard' ? 'active' : ''}
                onClick={() => setPref('commitWorkflow', 'wizard')}
              >
                Commit Wizard
              </button>
            </div>
          </div>

          <div className="prefs-row">
            <div className="prefs-row-text">
              <div className="prefs-row-label">Describe changes on commit</div>
              <div className="prefs-row-desc">
                When you commit with an empty description, walk through each file to build a
                changelog first.
              </div>
            </div>
            <label className="switch" title="Toggle auto-describe on commit">
              <input
                type="checkbox"
                checked={prefs.autoDescribe}
                onChange={(e) => setPref('autoDescribe', e.target.checked)}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
