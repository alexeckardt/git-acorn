import { useEffect, useState } from 'react'
import { setPref, usePrefs } from '../lib/prefs'
import { PREFIXES } from '../lib/branchDisplay'
import { LANE_COLORS } from '../lib/graph'
import { isMac } from '../lib/commands'
import Icon from './Icon'

const FILE_MANAGER = isMac
  ? 'Finder'
  : /win/i.test(navigator.userAgent)
    ? 'File Explorer'
    : 'file manager'

interface Props {
  open: boolean
  onClose: () => void
}

export default function PreferencesModal({ open, onClose }: Props) {
  const prefs = usePrefs()
  const [prefixMenu, setPrefixMenu] = useState(false)
  const [ignoreDraft, setIgnoreDraft] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)

  async function openRepoFolder() {
    setFolderError(null)
    const res = await window.gitApi.openRepoFolder()
    if (!res.ok) setFolderError(res.error ?? `Could not open the repository folder.`)
  }

  function addIgnore(raw: string) {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...prefs.describeIgnore]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    setPref('describeIgnore', next)
    setIgnoreDraft('')
  }

  function removeIgnore(pattern: string) {
    setPref(
      'describeIgnore',
      prefs.describeIgnore.filter((p) => p !== pattern)
    )
  }

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

          <div className="prefs-row prefs-row-stack">
            <div className="prefs-row-text">
              <div className="prefs-row-label">Skip describing these files</div>
              <div className="prefs-row-desc">
                Files matching these patterns don't need a description in the writer or wizard.
                Use an extension like <code>.png</code>, a glob like <code>*.lock</code>, or part of
                a path like <code>dist/</code>.
              </div>
            </div>
            <div className="ignore-field">
              <div className="ignore-chips">
                {prefs.describeIgnore.length === 0 && (
                  <span className="muted small">No patterns yet.</span>
                )}
                {prefs.describeIgnore.map((p) => (
                  <span key={p} className="ignore-chip">
                    <code>{p}</code>
                    <button
                      className="ignore-chip-x"
                      title={`Remove ${p}`}
                      onClick={() => removeIgnore(p)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="ignore-add">
                <input
                  className="small-modal-input"
                  placeholder="e.g. .png, *.lock, dist/"
                  value={ignoreDraft}
                  onChange={(e) => setIgnoreDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addIgnore(ignoreDraft)
                    }
                  }}
                />
                <button
                  className="tb-btn"
                  disabled={!ignoreDraft.trim()}
                  onClick={() => addIgnore(ignoreDraft)}
                >
                  Add
                </button>
              </div>
              {prefs.describeIgnore.length > 0 && (
                <div className="ignore-mode">
                  <span className="muted small">When a file matches:</span>
                  <div className="segmented prefs-segmented">
                    <button
                      className={prefs.describeIgnoreMode === 'skip' ? 'active' : ''}
                      onClick={() => setPref('describeIgnoreMode', 'skip')}
                    >
                      Skip it
                    </button>
                    <button
                      className={prefs.describeIgnoreMode === 'last' ? 'active' : ''}
                      onClick={() => setPref('describeIgnoreMode', 'last')}
                    >
                      Describe last
                    </button>
                  </div>
                </div>
              )}
            </div>
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
              <div className="prefs-row-label">Branch graph colours</div>
              <div className="prefs-row-desc">
                The palette for lanes in the graph and branch pills. It repeats when there are
                more branches than colours.
              </div>
            </div>
            <div className="lane-colors">
              {prefs.laneColors.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  className="lane-color"
                  value={c}
                  title={`Lane colour ${i + 1}`}
                  onChange={(e) => {
                    const next = [...prefs.laneColors]
                    next[i] = e.target.value
                    setPref('laneColors', next)
                  }}
                />
              ))}
              <button
                className="text-btn lane-reset"
                onClick={() => setPref('laneColors', [...LANE_COLORS])}
              >
                Reset
              </button>
            </div>
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

          <div className="prefs-row">
            <div className="prefs-row-text">
              <div className="prefs-row-label">Repository folder</div>
              <div className="prefs-row-desc">
                Open the current repository in {FILE_MANAGER}.
                {folderError && <span className="prefs-inline-error"> {folderError}</span>}
              </div>
            </div>
            <button className="tb-btn" onClick={openRepoFolder}>
              Show in {FILE_MANAGER}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
