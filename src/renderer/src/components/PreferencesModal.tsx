import { useEffect, useState } from 'react'
import { setPref, usePrefs } from '../lib/prefs'
import { PREFIXES } from '../lib/branchDisplay'
import Icon from './Icon'

interface Props {
  open: boolean
  onClose: () => void
}

export default function PreferencesModal({ open, onClose }: Props) {
  const prefs = usePrefs()
  const [prefixMenu, setPrefixMenu] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const activePrefix = PREFIXES.find((p) => p.key === prefs.defaultBranchPrefix) ?? PREFIXES[0]

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

          <div className="prefs-row">
            <div className="prefs-row-text">
              <div className="prefs-row-label">Switch to base branch when a PR closes</div>
              <div className="prefs-row-desc">
                When the PR for your current branch is merged or closed, automatically check out
                its base branch and pull — ready for the next thing.
              </div>
            </div>
            <label className="switch" title="Toggle auto-switch on PR close">
              <input
                type="checkbox"
                checked={prefs.autoSwitchOnPRClose}
                onChange={(e) => setPref('autoSwitchOnPRClose', e.target.checked)}
              />
              <span className="switch-slider" />
            </label>
          </div>

          <div className="prefs-row">
            <div className="prefs-row-text">
              <div className="prefs-row-label">Default branch prefix</div>
              <div className="prefs-row-desc">
                Pre-selected in the branch creator (⌘/Ctrl+B). You can still change it there.
              </div>
            </div>
            <div className="prefs-prefix-picker">
              <button className="prefix-picker-btn" onClick={() => setPrefixMenu((m) => !m)}>
                <Icon name={activePrefix.icon} size={15} />
                <span>{activePrefix.label}</span>
                <code className="prefix-key">{activePrefix.key || '—'}</code>
              </button>
              {prefixMenu && (
                <div className="prefix-menu prefs-prefix-menu">
                  {PREFIXES.map((p) => (
                    <button
                      key={p.key || 'none'}
                      className={`prefix-item${p.key === activePrefix.key ? ' active' : ''}`}
                      onClick={() => {
                        setPref('defaultBranchPrefix', p.key)
                        setPrefixMenu(false)
                      }}
                    >
                      <Icon name={p.icon} />
                      <span className="prefix-label">{p.label}</span>
                      <code className="prefix-key">{p.key || '—'}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
