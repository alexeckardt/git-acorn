import { useEffect, useRef, useState } from 'react'
import type { ChangedFile } from '../../../shared/types'
import DescriptionWriter, { DescEntry } from './DescriptionWriter'
import BranchModal from './BranchModal'

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

type Step = 'prep' | 'describe' | 'name' | 'branch' | 'committing'

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'describe', label: 'Describe' },
  { key: 'name', label: 'Name' },
  { key: 'branch', label: 'Branch & PR' }
]

export default function CommitWizard({ open, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('prep')
  const [stagedFiles, setStagedFiles] = useState<ChangedFile[]>([])
  const [entries, setEntries] = useState<DescEntry[]>([])
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')

  const [currentBranch, setCurrentBranch] = useState('')
  const [defaultBr, setDefaultBr] = useState('')
  const [ghOK, setGhOK] = useState(false)
  const [hasPR, setHasPR] = useState(false)
  const [createPR, setCreatePR] = useState(false)
  const [branchModalOpen, setBranchModalOpen] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const branchBtnRef = useRef<HTMLButtonElement>(null)
  const commitBtnRef = useRef<HTMLButtonElement>(null)
  // Whether this "session" has been prepared. Kept across hide/show so closing
  // is a hide (progress preserved), not a cancel; reset after a commit.
  const startedRef = useRef(false)

  useEffect(() => {
    if (!open) return
    if (!startedRef.current) {
      startedRef.current = true
      prepareFresh()
    } else {
      // Resuming a hidden wizard — just refresh the branch info, keep progress.
      refreshBranchInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    if (step === 'name') setTimeout(() => nameRef.current?.focus(), 0)
    // Auto-select the branch section on the final step.
    if (step === 'branch') setTimeout(() => branchBtnRef.current?.focus(), 0)
  }, [step, open])

  async function prepareFresh() {
    setStep('prep')
    setEntries([])
    setSummary('')
    setDescription('')
    setCreatePR(false)
    setError(null)

    const st = await window.gitApi.status()
    let staged = st.ok && st.data ? st.data.staged : []
    if (staged.length === 0) {
      await window.gitApi.stageAll()
      const st2 = await window.gitApi.status()
      staged = st2.ok && st2.data ? st2.data.staged : []
    }
    if (staged.length === 0) {
      setError('There are no changes to commit.')
      return
    }
    setStagedFiles(staged)
    await refreshBranchInfo()
    setStep('describe')
  }

  async function refreshBranchInfo() {
    const br = await window.gitApi.branches()
    const cur = br.ok && br.data ? br.data.current : ''
    setCurrentBranch(cur)
    const def = await window.gitApi.defaultBranch()
    setDefaultBr(def.ok ? (def.data ?? '') : '')
    const gh = await window.gitApi.ghAvailable()
    setGhOK(gh.ok ? !!gh.data : false)
    const pr = await window.gitApi.branchHasPR(cur)
    setHasPR(pr.ok ? !!pr.data : false)
  }

  const candidates = [...new Set(entries.map((e) => e.text.trim()).filter(Boolean))]

  function handleDescribeFinish(ents: DescEntry[]) {
    setEntries(ents)
    const bullets = ents
      .map((e) => e.text.trim())
      .filter(Boolean)
      .map((t) => `- ${t}`)
      .join('\n')
    setDescription(bullets)
    const cands = [...new Set(ents.map((e) => e.text.trim()).filter(Boolean))]
    if (cands.length === 1) setSummary((s) => (s.trim() ? s : cands[0]))
    setStep('name')
  }

  async function afterBranchChange(created?: boolean) {
    setBranchModalOpen(false)
    const br = await window.gitApi.branches()
    const cur = br.ok && br.data ? br.data.current : currentBranch
    setCurrentBranch(cur)
    const pr = await window.gitApi.branchHasPR(cur)
    const has = pr.ok ? !!pr.data : false
    setHasPR(has)
    if (has || cur === defaultBr) {
      setCreatePR(false)
    } else if (created) {
      // Chose a brand-new branch → default to opening a PR for it.
      setCreatePR(true)
    }
    setTimeout(() => branchBtnRef.current?.focus(), 0)
  }

  const onDefault = !!currentBranch && currentBranch === defaultBr
  const canOfferPR = !!currentBranch && !onDefault && !hasPR

  async function doCommit() {
    if (!summary.trim() || busy) return
    setBusy(true)
    setError(null)
    setStep('committing')
    const res = await window.gitApi.commit(summary.trim(), description)
    if (!res.ok) {
      setBusy(false)
      setError(res.error ?? 'Commit failed')
      setStep('branch')
      return
    }
    if (createPR && canOfferPR && ghOK) {
      const pr = await window.gitApi.createPR()
      onDone()
      setBusy(false)
      if (!pr.ok) {
        setError(`Committed, but the PR could not be created: ${pr.error}`)
        setStep('branch')
        return
      }
    } else {
      onDone()
      setBusy(false)
    }
    // Committed — reset so the next open starts fresh.
    startedRef.current = false
    setEntries([])
    setSummary('')
    setDescription('')
    setCreatePR(false)
    setStep('prep')
    onClose()
  }

  function onContainerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose() // hide, keeping progress
    } else if (
      (e.metaKey || e.ctrlKey) &&
      e.key === 'Enter' &&
      (step === 'name' || step === 'branch')
    ) {
      // ⌘/Ctrl+Enter submits from the later steps (describe owns it for priming).
      e.preventDefault()
      doCommit()
    }
  }

  const activeIdx = STEP_LABELS.findIndex((s) => s.key === step)

  return (
    <div
      className="modal-overlay"
      style={{ display: open ? 'flex' : 'none' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`wizard-modal${step === 'describe' ? ' wizard-wide' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onContainerKeyDown}
      >
        <div className="wizard-header">
          <div className="wizard-steps">
            {STEP_LABELS.map((s, i) => (
              <div
                key={s.key}
                className={`wizard-step${i === activeIdx ? ' active' : ''}${
                  activeIdx > i ? ' done' : ''
                }`}
              >
                <span className="wizard-step-num">{i + 1}</span>
                {s.label}
              </div>
            ))}
          </div>
          <button className="icon-btn" title="Hide (Esc) — your descriptions are kept" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="wizard-error">{error}</div>}

        {step === 'prep' && <div className="wizard-body empty-hint">Preparing…</div>}

        {step === 'describe' && (
          <DescriptionWriter embedded files={stagedFiles} onFinish={handleDescribeFinish} />
        )}

        {step === 'name' && (
          <div className="wizard-body">
            <label className="wizard-label">Commit name</label>
            <input
              ref={nameRef}
              className="small-modal-input wizard-name"
              placeholder="Summarize this commit"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && summary.trim()) {
                  e.preventDefault()
                  setStep('branch')
                }
              }}
            />
            {candidates.length > 1 && (
              <div className="wizard-candidates">
                <div className="muted small">Pick from your changes:</div>
                {candidates.map((c) => (
                  <button
                    key={c}
                    className={`wizard-candidate${summary === c ? ' active' : ''}`}
                    onClick={() => setSummary(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {description && (
              <details className="wizard-desc-preview">
                <summary>Description ({entries.length})</summary>
                <pre>{description}</pre>
              </details>
            )}
            <div className="wizard-actions">
              <button className="tb-btn" onClick={() => setStep('describe')}>
                Back
              </button>
              <button
                className="tb-btn primary"
                disabled={!summary.trim()}
                onClick={() => setStep('branch')}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 'branch' && (
          <div className="wizard-body">
            <label className="wizard-label">Target branch</label>
            <div className="wizard-branch-row">
              <span className="wizard-branch-name">
                <span className="branch-icon">⑂</span> {currentBranch || '(detached)'}
                {onDefault && <span className="branch-badge">default</span>}
              </span>
              <button
                ref={branchBtnRef}
                className="tb-btn"
                onClick={() => setBranchModalOpen(true)}
                onKeyDown={(e) => {
                  // ↵ opens the branch picker (native click); ↓ moves to Commit.
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    commitBtnRef.current?.focus()
                  }
                }}
                title="Enter to change / create a branch, ↓ to continue"
              >
                Change / new…
              </button>
            </div>

            {canOfferPR && ghOK && (
              <label className="wizard-pr">
                <input
                  type="checkbox"
                  checked={createPR}
                  onChange={(e) => setCreatePR(e.target.checked)}
                />
                <span>
                  Push this branch and open a pull request
                  <span className="muted small"> — git push, then gh pr create --fill</span>
                </span>
              </label>
            )}
            {canOfferPR && !ghOK && (
              <div className="wizard-note">
                Install the{' '}
                <a href="https://cli.github.com" target="_blank" rel="noreferrer">
                  GitHub CLI (gh)
                </a>{' '}
                to open a pull request from here.
              </div>
            )}
            {onDefault && (
              <div className="wizard-note muted">On the default branch — committing directly.</div>
            )}
            {hasPR && !onDefault && (
              <div className="wizard-note muted">This branch already has a pull request.</div>
            )}

            <div className="wizard-summary-line">
              Commit <strong>{stagedFiles.length}</strong> file
              {stagedFiles.length === 1 ? '' : 's'} to <strong>{currentBranch}</strong>
              {createPR && canOfferPR && ghOK ? ', then push and open a PR' : ''}.
            </div>

            <div className="wizard-actions">
              <button className="tb-btn" onClick={() => setStep('name')}>
                Back
              </button>
              <button
                ref={commitBtnRef}
                className="tb-btn primary"
                disabled={!summary.trim()}
                onClick={doCommit}
                title="⌘/Ctrl+Enter"
              >
                Commit
              </button>
            </div>
          </div>
        )}

        {step === 'committing' && <div className="wizard-body empty-hint">Committing…</div>}

        {branchModalOpen && (
          <BranchModal
            open={branchModalOpen}
            onClose={() => setBranchModalOpen(false)}
            onDone={afterBranchChange}
          />
        )}
      </div>
    </div>
  )
}
