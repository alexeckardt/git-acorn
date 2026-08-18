import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ChangedFile,
  Commit,
  CommitDetail,
  DiffSource,
  RepoInfo,
  RepoStatus
} from '../../shared/types'
import TitleBar from './components/TitleBar'
import ChangesPanel from './components/ChangesPanel'
import CommitInfoPanel from './components/CommitInfoPanel'
import CommitGraph from './components/CommitGraph'
import DiffView, { DiffMode } from './components/DiffView'
import TerminalModal from './components/TerminalModal'

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

  const refresh = useCallback(async () => {
    setRefreshing(true)
    // Floor the spinner at ~450ms so the animation reads as a deliberate action.
    const minSpin = new Promise((r) => setTimeout(r, 450))
    try {
      await Promise.all([loadStatus(), loadLog(fileFilter), minSpin])
    } finally {
      setRefreshing(false)
    }
  }, [loadStatus, loadLog, fileFilter])

  // Initial: restore any already-open repo.
  useEffect(() => {
    window.gitApi.currentRepo().then((res) => {
      if (res.ok && res.data) setRepo(res.data)
    })
  }, [])

  // Toggle the terminal from the View menu / ⌘`.
  useEffect(() => {
    return window.termApi.onToggle(() => setTerminalVisible((v) => !v))
  }, [])

  // Reload everything when the repo or file filter changes.
  useEffect(() => {
    if (repo) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, fileFilter])

  // Auto-refresh whenever the user returns to the app (window focus / tab back).
  useEffect(() => {
    if (!repo) return
    const onFocus = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [repo, refresh])

  // ---- actions -----------------------------------------------------------

  async function openRepo() {
    const res = await window.gitApi.openRepoDialog()
    if (res.ok && res.data) {
      setRepo(res.data)
      resetSelection()
      setFileFilter(null)
    } else if (res.error && res.error !== 'Cancelled') {
      alert(res.error)
    }
  }

  function resetSelection() {
    setSelectedCommit(null)
    setCommitDetail(null)
    setDiffSource(null)
    setDiffTitle('')
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
          onOpen={openRepo}
          onRefresh={() => {}}
        />
        <div className="welcome">
          <div className="welcome-card">
            <div className="welcome-acorn">🌰</div>
            <h1>git-acorn</h1>
            <p>A small, streamlined git client for solo projects.</p>
            <button className="tb-btn primary big" onClick={openRepo}>
              Open a repository
            </button>
          </div>
        </div>
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
        onOpen={openRepo}
        onRefresh={refresh}
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
                selected={selectedCommit === null ? 'working' : selectedCommit}
                onSelectCommit={selectCommit}
                onSelectWorking={backToWorking}
                fileFilter={fileFilter}
                onClearFilter={() => setFileFilter(null)}
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
    </div>
  )
}
