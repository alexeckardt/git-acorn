import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ChangedFile,
  Commit,
  CommitDetail,
  DiffSource,
  PullRequest,
  RepoInfo,
  RepoStatus
} from '../../shared/types'
import TitleBar from './components/TitleBar'
import ChangesPanel from './components/ChangesPanel'
import CommitInfoPanel from './components/CommitInfoPanel'
import CommitGraph from './components/CommitGraph'
import DiffView, { DiffMode } from './components/DiffView'
import TerminalModal from './components/TerminalModal'
import BranchModal from './components/BranchModal'
import PreferencesModal from './components/PreferencesModal'
import SwitchRepoModal from './components/SwitchRepoModal'
import CritterOverlay from './components/CritterOverlay'
import { installShortcuts, registerCommand, runCommand } from './lib/commands'
import { addRecentRepo, getRecentRepos, removeRecentRepo } from './lib/recentRepos'
import { getPrefs } from './lib/prefs'

export default function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // null selectedCommit => working-tree mode.
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [diffSource, setDiffSource] = useState<DiffSource | null>(null)
  const [diffTitle, setDiffTitle] = useState<string>('')
  const [diffMode, setDiffMode] = useState<DiffMode>('side-by-side')

  const [fileFilter, setFileFilter] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [graphHeight, setGraphHeight] = useState(360)
  const [terminalVisible, setTerminalVisible] = useState(false)
  const [newBranchOpen, setNewBranchOpen] = useState(false)
  // When set, the branch modal creates a branch rooted at this commit hash.
  const [branchStartPoint, setBranchStartPoint] = useState<string | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [switchRepoOpen, setSwitchRepoOpen] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const [prs, setPrs] = useState<PullRequest[]>([])
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [mergeConflictBranch, setMergeConflictBranch] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  // ---- data loading ------------------------------------------------------

  const loadStatus = useCallback(async () => {
    const res = await window.gitApi.status()
    if (res.ok && res.data) setStatus(res.data)
  }, [])

  const loadLog = useCallback(async (filter: string | null) => {
    const res = await window.gitApi.log(filter ? { filePath: filter } : {})
    if (res.ok && res.data) {
      setCommits(res.data)
      setLoadError(null)
    } else {
      setCommits([])
      setLoadError(res.error ?? null)
    }
  }, [])

  const loadPRs = useCallback(async () => {
    const res = await window.gitApi.listPRs()
    // Only update on success — on failure keep the last list so a gh hiccup
    // doesn't read as "all PRs closed".
    if (res.ok && res.data) setPrs(res.data)
  }, [])

  const refresh = useCallback(
    async (fetchFirst = false) => {
      setRefreshing(true)
      // Floor the spinner at ~450ms so the animation reads as a deliberate action.
      const minSpin = new Promise((r) => setTimeout(r, 450))
      try {
        // Fetch first so ahead/behind (and the Sync button) are current.
        if (fetchFirst) await window.gitApi.fetch().catch(() => {})
        await Promise.all([loadStatus(), loadLog(fileFilter), loadPRs(), minSpin])
      } finally {
        setRefreshing(false)
        // Reshuffle the little pixel-art critter to a new spot on each refresh.
        window.dispatchEvent(new Event('critter:refresh'))
      }
    },
    [loadStatus, loadLog, loadPRs, fileFilter]
  )

  // On startup, restore the current repo, or the most recent that still opens.
  useEffect(() => {
    ;(async () => {
      const cur = await window.gitApi.currentRepo()
      if (cur.ok && cur.data) {
        setRepo(cur.data)
        addRecentRepo(cur.data)
        return
      }
      for (const entry of getRecentRepos()) {
        const res = await window.gitApi.setRepo(entry.path)
        if (res.ok && res.data) {
          setRepo(res.data)
          addRecentRepo(res.data)
          return
        }
        removeRecentRepo(entry.path) // stale (moved/deleted)
      }
    })()
  }, [])

  // Install keyboard shortcuts and receive native-menu command dispatches.
  useEffect(() => {
    const uninstall = installShortcuts()
    const offMenu = window.menuApi.onCommand(runCommand)
    return () => {
      uninstall()
      offMenu()
    }
  }, [])

  // Escape returns the view to its base state — but only when nothing modal is
  // up. Modals and context menus handle their own Escape (to close themselves);
  // detect them by their live overlay/menu elements in the DOM so we don't need
  // to enumerate every child modal's open state here. getClientRects() is empty
  // for a display:none overlay (e.g. the always-mounted commit wizard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const blocked = Array.from(
        document.querySelectorAll('.modal-overlay, .term-overlay, .context-menu')
      ).some((el) => el.getClientRects().length > 0)
      if (blocked) return
      resetToBaseView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Register the commands App owns (re-registered when `refresh` changes).
  useEffect(() => {
    const unsubs = [
      registerCommand('open-repo', () => openSwitchRepo()),
      registerCommand('refresh', () => refresh(true)),
      registerCommand('new-branch', openNewBranch),
      registerCommand('toggle-terminal', () => setTerminalVisible((v) => !v)),
      registerCommand('preferences', () => setPreferencesOpen(true))
    ]
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // Reload everything when the repo or file filter changes (fetch so the Sync
  // button reflects the remote right away).
  useEffect(() => {
    if (repo) refresh(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, fileFilter])

  // Auto-refresh (and fetch) whenever the user returns to the app — that's when
  // a PR merged on GitHub gets noticed and the auto-switch can kick in.
  useEffect(() => {
    if (!repo) return
    const onFocus = () => refresh(true)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(true)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [repo, refresh])

  // When the current branch's open PR disappears (merged/closed), switch to its
  // base branch and pull — controlled by the autoSwitchOnPRClose preference.
  const prevOpenPRs = useRef<Map<string, string>>(new Map())
  const prevBranch = useRef<string | undefined>(undefined)
  useEffect(() => {
    const cur = status?.branch
    const nowOpen = new Map(
      prs.filter((p) => p.state === 'OPEN').map((p) => [p.branch, p.base])
    )
    const clean = !!status && status.staged.length === 0 && status.unstaged.length === 0
    if (
      cur &&
      cur === prevBranch.current && // only if we stayed on the same branch
      clean && // don't yank the user away from uncommitted work
      prevOpenPRs.current.has(cur) &&
      !nowOpen.has(cur) &&
      getPrefs().autoSwitchOnPRClose
    ) {
      const base = prevOpenPRs.current.get(cur)
      if (base) handlePRClosed(base)
    }
    prevOpenPRs.current = nowOpen
    prevBranch.current = cur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prs, status])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4500)
  }

  async function handlePRClosed(base: string) {
    const sw = await window.gitApi.switchBranch(base)
    if (!sw.ok) return
    const pl = await window.gitApi.pull()
    await refresh(true)
    if (pl.ok && pl.data?.conflict) {
      setMergeConflictBranch(`origin/${base}`)
    } else {
      showToast(`PR closed — switched to ${base} and pulled.`)
    }
  }

  // ---- actions -----------------------------------------------------------

  function handleRepoOpened(info: RepoInfo) {
    setRepo(info)
    addRecentRepo(info)
    resetSelection()
    setFileFilter(null)
    setSwitchRepoOpen(false)
    setSwitchError(null)
  }

  async function openRepoFromDialog() {
    const res = await window.gitApi.openRepoDialog()
    if (res.ok && res.data) {
      handleRepoOpened(res.data)
    } else if (res.error && res.error !== 'Cancelled') {
      if (switchRepoOpen) setSwitchError(res.error)
      else alert(res.error)
    }
  }

  async function switchToRepo(path: string) {
    const res = await window.gitApi.setRepo(path)
    if (res.ok && res.data) {
      handleRepoOpened(res.data)
    } else {
      removeRecentRepo(path) // couldn't open — drop it from the list
      setSwitchError(res.error ?? 'Could not open that repository')
    }
  }

  function openSwitchRepo() {
    setSwitchError(null)
    setSwitchRepoOpen(true)
  }

  function resetSelection() {
    setSelectedCommit(null)
    setCommitDetail(null)
    setDiffSource(null)
    setDiffTitle('')
  }

  // Return to the base view: clear the selected commit, the file-history filter,
  // and (via the event) the graph-local branch search / tips-only filters.
  function resetToBaseView() {
    resetSelection()
    setFileFilter(null)
    window.dispatchEvent(new Event('view:reset'))
  }

  // ---- branch operations (from the graph's right-click menu) --------------

  async function checkoutBranch(name: string) {
    const res = await window.gitApi.switchBranch(name)
    if (res.ok) refresh()
    else alert(res.error)
  }

  async function checkoutCommit(hash: string) {
    const short = hash.slice(0, 7)
    if (
      !confirm(
        `Check out commit ${short}?\n\n` +
          `This detaches HEAD onto the commit — you won't be on a branch. ` +
          `Create a branch here first if you want to keep new work.`
      )
    )
      return
    const res = await window.gitApi.checkoutCommit(hash)
    if (res.ok) refresh()
    else alert(res.error)
  }

  function createBranchAt(hash: string) {
    setBranchStartPoint(hash)
    setNewBranchOpen(true)
  }

  // Plain "new branch" — off the current HEAD, so clear any lingering start point.
  function openNewBranch() {
    setBranchStartPoint(null)
    setNewBranchOpen(true)
  }

  function closeBranchModal() {
    setNewBranchOpen(false)
    setBranchStartPoint(null)
  }

  async function checkoutRemoteBranch(remoteRef: string) {
    const res = await window.gitApi.checkoutRemote(remoteRef)
    if (res.ok) refresh()
    else alert(res.error)
  }

  async function updateLocalToRemote(remoteRef: string) {
    // Strip the remote name (origin/feat/x -> feat/x) to find the local branch.
    const local = remoteRef.replace(/^[^/]+\//, '')
    const isCurrent = status?.branch === local
    const dirty = !!status && (status.staged.length > 0 || status.unstaged.length > 0)

    let stash = false
    if (isCurrent && dirty) {
      // A hard reset would throw the changes away — refuse, but offer to keep
      // them by stashing first (recoverable with `git stash pop`).
      if (
        !confirm(
          `"${local}" has uncommitted changes, which updating to ${remoteRef} would discard.\n\n` +
            `Stash the changes and continue? You can restore them later with "git stash pop".`
        )
      )
        return
      stash = true
    } else if (
      !confirm(
        `Update the local branch to match ${remoteRef}?\n\n` +
          `This discards any local commits on that branch that aren't on the remote.`
      )
    ) {
      return
    }

    const res = await window.gitApi.updateLocalToRemote(remoteRef, stash)
    if (res.ok) {
      if (stash) showToast(`Stashed your changes and updated ${local} to match ${remoteRef}.`)
      refresh(true)
    } else {
      alert(res.error)
    }
  }

  async function checkoutRemoteAndPull(remoteRef: string) {
    const res = await window.gitApi.checkoutRemoteAndPull(remoteRef)
    await refresh(true)
    if (res.ok && res.data?.conflict) {
      setMergeConflictBranch(remoteRef)
    } else if (!res.ok) {
      alert(res.error)
    }
  }

  function startRenameBranch(name: string) {
    setRenameTarget(name)
    setRenameValue(name)
  }

  async function submitRenameBranch() {
    if (!renameTarget || !renameValue.trim()) return
    const res = await window.gitApi.renameBranch(renameTarget, renameValue.trim())
    setRenameTarget(null)
    if (res.ok) refresh()
    else alert(res.error)
  }

  async function deleteBranch(name: string) {
    if (!confirm(`Delete branch "${name}"?`)) return
    let res = await window.gitApi.deleteBranch(name, false)
    if (!res.ok) {
      // Not fully merged — offer a force delete.
      if (confirm(`"${name}" isn't fully merged. Delete it anyway?`)) {
        res = await window.gitApi.deleteBranch(name, true)
      } else {
        return
      }
    }
    if (res.ok) refresh()
    else alert(res.error)
  }

  async function mergeBranch(name: string) {
    const res = await window.gitApi.mergeBranch(name)
    refresh()
    if (res.ok && res.data?.conflict) {
      setMergeConflictBranch(name)
    } else if (!res.ok) {
      alert(res.error)
    }
  }

  function openPR(url: string) {
    window.gitApi.openExternal(url)
  }

  async function doSync() {
    if (syncing) return
    setSyncing(true)
    const res = await window.gitApi.sync()
    setSyncing(false)
    await refresh(true)
    if (res.ok && res.data?.conflict) {
      setMergeConflictBranch(`origin/${status?.branch ?? ''}`)
    } else if (!res.ok) {
      alert(res.error)
    }
  }

  async function createPRForBranch(name: string) {
    const res = await window.gitApi.createPR(name)
    if (res.ok && res.data) {
      window.gitApi.openExternal(res.data)
      refresh()
    } else {
      alert(res.error ?? 'Could not create the pull request')
    }
  }

  async function mergePullRequest(pr: PullRequest) {
    const res = await window.gitApi.mergePR(pr.branch)
    if (res.ok) {
      showToast(`Merged PR #${pr.number} into ${pr.base}`)
      refresh(true)
    } else if (
      // The pre-check passed but the merge still failed (e.g. branch
      // protection) — offer to finish it on GitHub.
      window.confirm(
        `Couldn't merge PR #${pr.number}:\n\n${res.error}\n\nOpen it on GitHub instead?`
      )
    ) {
      window.gitApi.openExternal(pr.url)
    }
  }

  function selectWorkingFile(file: ChangedFile) {
    setSelectedCommit(null)
    setDiffSource({
      kind: file.staged ? 'workingStaged' : 'workingUnstaged',
      path: file.path
    })
    setDiffTitle(`${file.path}${file.staged ? '  ·  staged' : ''}`)
  }

  const selectCommit = useCallback(async (hash: string) => {
    setSelectedCommit(hash)
    setDiffSource(null)
    setDiffTitle('')
    setDetailLoading(true)
    const res = await window.gitApi.commitDetail(hash)
    setDetailLoading(false)
    if (res.ok && res.data) {
      setCommitDetail(res.data)
      const first = res.data.files[0]
      if (first) {
        setDiffSource({ kind: 'commit', hash, path: first.path })
        setDiffTitle(first.path)
      }
    }
  }, [])

  function selectCommitFile(path: string) {
    if (!selectedCommit) return
    setDiffSource({ kind: 'commit', hash: selectedCommit, path })
    setDiffTitle(path)
  }

  function backToWorking() {
    resetSelection()
  }

  function openFileHistory(path: string) {
    setFileFilter(path)
    resetSelection()
  }

  // ---- divider drag ------------------------------------------------------

  const draggingRef = useRef(false)
  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    draggingRef.current = true
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const container = document.querySelector('.right-pane') as HTMLElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const h = ev.clientY - rect.top
      setGraphHeight(Math.max(140, Math.min(rect.height - 160, h)))
    }
    const onUp = () => {
      draggingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ---- render ------------------------------------------------------------

  if (!repo) {
    return (
      <div className="app">
        <TitleBar
          repo={null}
          status={null}
          refreshing={false}
          syncing={false}
          onSwitchRepo={openSwitchRepo}
          onSwitchBranch={openNewBranch}
          onRefresh={() => {}}
          onSync={() => {}}
        />
        <div className="welcome">
          <div className="welcome-card">
            <div className="welcome-acorn">🌰</div>
            <h1>git-acorn</h1>
            <p>A small, streamlined git client for solo projects.</p>
            <button className="tb-btn primary big" onClick={openRepoFromDialog}>
              Open a repository
            </button>
          </div>
        </div>
        <PreferencesModal open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
        <SwitchRepoModal
          open={switchRepoOpen}
          currentPath={null}
          error={switchError}
          onClose={() => setSwitchRepoOpen(false)}
          onPick={switchToRepo}
          onOpenNew={openRepoFromDialog}
        />
        <CritterOverlay />
      </div>
    )
  }

  const workingSel =
    selectedCommit === null && diffSource && diffSource.kind !== 'commit'
      ? { path: diffSource.path, staged: diffSource.kind === 'workingStaged' }
      : null

  const commitFileSel =
    selectedCommit !== null && diffSource && diffSource.kind === 'commit'
      ? diffSource.path
      : null

  return (
    <div className="app">
      <TitleBar
        repo={repo}
        status={status}
        refreshing={refreshing}
        syncing={syncing}
        onSwitchRepo={openSwitchRepo}
        onSwitchBranch={openNewBranch}
        onRefresh={() => refresh(true)}
        onSync={doSync}
      />
      <div className="body">
        <aside className="sidebar">
          {selectedCommit === null ? (
            status ? (
              <ChangesPanel
                status={status}
                selected={workingSel}
                onSelectFile={selectWorkingFile}
                onRefresh={refresh}
                onFileHistory={openFileHistory}
                onSync={doSync}
                syncing={syncing}
              />
            ) : (
              <div className="empty-hint">Loading…</div>
            )
          ) : (
            <CommitInfoPanel
              detail={commitDetail}
              loading={detailLoading}
              selectedPath={commitFileSel}
              onSelectFile={selectCommitFile}
              onFileHistory={openFileHistory}
              onBack={backToWorking}
            />
          )}
        </aside>

        <main className="right-pane">
          <div className="graph-container" style={{ height: graphHeight }}>
            {loadError ? (
              <div className="empty-hint big error">{loadError}</div>
            ) : (
              <CommitGraph
                commits={commits}
                status={status}
                prs={prs}
                selected={selectedCommit === null ? 'working' : selectedCommit}
                onSelectCommit={selectCommit}
                onSelectWorking={backToWorking}
                fileFilter={fileFilter}
                onClearFilter={() => setFileFilter(null)}
                onCheckoutBranch={checkoutBranch}
                onCheckoutCommit={checkoutCommit}
                onCreateBranchAt={createBranchAt}
                onCheckoutRemote={checkoutRemoteBranch}
                onUpdateLocalToRemote={updateLocalToRemote}
                onCheckoutRemoteAndPull={checkoutRemoteAndPull}
                onRenameBranch={startRenameBranch}
                onDeleteBranch={deleteBranch}
                onMergeBranch={mergeBranch}
                onCreatePR={createPRForBranch}
                onOpenPR={openPR}
                onMergePR={mergePullRequest}
              />
            )}
          </div>
          <div className="divider" onMouseDown={startDrag} />
          <div className="diff-container">
            <DiffView
              source={diffSource}
              mode={diffMode}
              onModeChange={setDiffMode}
              title={diffTitle}
            />
          </div>
        </main>
      </div>
      <TerminalModal
        visible={terminalVisible}
        onHide={() => setTerminalVisible(false)}
        repoName={repo.name}
      />
      <BranchModal
        open={newBranchOpen}
        onClose={closeBranchModal}
        onDone={refresh}
        startPoint={branchStartPoint ?? undefined}
      />
      <PreferencesModal open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
      <SwitchRepoModal
        open={switchRepoOpen}
        currentPath={repo.path}
        error={switchError}
        onClose={() => setSwitchRepoOpen(false)}
        onPick={switchToRepo}
        onOpenNew={openRepoFromDialog}
      />

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      {renameTarget !== null && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setRenameTarget(null)}
        >
          <div className="small-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="small-modal-title">Rename branch</div>
            <input
              className="small-modal-input"
              autoFocus
              value={renameValue}
              spellCheck={false}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRenameBranch()
                else if (e.key === 'Escape') setRenameTarget(null)
              }}
            />
            <div className="small-modal-actions">
              <button className="tb-btn" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button
                className="tb-btn primary"
                disabled={!renameValue.trim()}
                onClick={submitRenameBranch}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {mergeConflictBranch !== null && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setMergeConflictBranch(null)}
        >
          <div className="small-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="small-modal-title">Merge conflict</div>
            <div className="prefs-row-desc">
              Merging <strong>{mergeConflictBranch}</strong> hit conflicts. Open the repository in
              your code editor to resolve them, then commit the merge.
            </div>
            <div className="small-modal-actions">
              <button className="tb-btn" onClick={() => setMergeConflictBranch(null)}>
                Later
              </button>
              <button
                className="tb-btn primary"
                onClick={() => {
                  window.gitApi.openInEditor()
                  setMergeConflictBranch(null)
                }}
              >
                Open in editor
              </button>
            </div>
          </div>
        </div>
      )}

      <CritterOverlay />
    </div>
  )
}
