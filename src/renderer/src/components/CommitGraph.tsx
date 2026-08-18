import { useEffect, useMemo, useRef, useState } from 'react'
import type { Commit, PullRequest, RepoStatus } from '../../../shared/types'
import { computeGraph, laneColor } from '../lib/graph'
import { colorFromString, initials, relativeTime } from '../lib/util'
import ContextMenu, { MenuItem } from './ContextMenu'
import BranchLabel from './BranchLabel'
import Icon from './Icon'

const ROW_H = 46
const COL_W = 20
const NODE_R = 5
const LEFT_PAD = 16

interface Props {
  commits: Commit[]
  status: RepoStatus | null
  prs: PullRequest[]
  selected: string | 'working' | null
  onSelectCommit: (hash: string) => void
  onSelectWorking: () => void
  fileFilter: string | null
  onClearFilter: () => void
  onCheckoutBranch: (name: string) => void
  onRenameBranch: (name: string) => void
  onDeleteBranch: (name: string) => void
  onMergeBranch: (name: string) => void
  onOpenPR: (url: string) => void
}

export default function CommitGraph({
  commits,
  status,
  prs,
  selected,
  onSelectCommit,
  onSelectWorking,
  fileFilter,
  onClearFilter,
  onCheckoutBranch,
  onRenameBranch,
  onDeleteBranch,
  onMergeBranch,
  onOpenPR
}: Props) {
  const [search, setSearch] = useState('')
  const [tipsOnly, setTipsOnly] = useState(false)
  const [branchMenu, setBranchMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(
    null
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentBranch = status?.branch ?? ''
  const prByBranch = useMemo(() => {
    const m = new Map<string, PullRequest>()
    for (const p of prs) m.set(p.branch, p)
    return m
  }, [prs])

  // "Tips only" keeps just the commits a branch/tag/remote ref points at.
  const displayCommits = useMemo(
    () =>
      tipsOnly
        ? commits.filter((c) =>
            c.refs.some((r) => r.type === 'branch' || r.type === 'remote' || r.type === 'tag')
          )
        : commits,
    [commits, tipsOnly]
  )

  // Commits reachable from HEAD render in full colour; everything "above" the
  // current checkout (not an ancestor of HEAD) is greyed.
  const { reachable, hasHead } = useMemo(() => {
    const byHash = new Map(commits.map((c) => [c.hash, c]))
    const head = commits.find((c) => c.refs.some((r) => r.type === 'head'))
    const set = new Set<string>()
    if (!head) return { reachable: set, hasHead: false }
    const stack = [head.hash]
    while (stack.length) {
      const h = stack.pop()!
      if (set.has(h)) continue
      set.add(h)
      const c = byHash.get(h)
      if (c) for (const p of c.parents) if (byHash.has(p)) stack.push(p)
    }
    return { reachable: set, hasHead: true }
  }, [commits])
  const isDim = (hash: string) => hasHead && !reachable.has(hash)

  const layout = useMemo(() => computeGraph(displayCommits), [displayCommits])
  const graphWidth = LEFT_PAD * 2 + (layout.maxCol + 1) * COL_W
  const cx = (col: number) => LEFT_PAD + col * COL_W
  const cy = (row: number) => row * ROW_H + ROW_H / 2

  const changeCount =
    status && !fileFilter ? status.staged.length + status.unstaged.length : 0
  const showWorking = changeCount > 0

  const edges = useMemo(() => {
    const out: { d: string; color: string; key: string }[] = []
    displayCommits.forEach((c) => {
      const cc = layout.colByHash.get(c.hash)!
      const cr = layout.rowByHash.get(c.hash)!
      c.parents.forEach((p) => {
        const pc = layout.colByHash.get(p)
        const pr = layout.rowByHash.get(p)
        if (pc === undefined || pr === undefined) return
        const x1 = cx(cc)
        const y1 = cy(cr)
        const x2 = cx(pc)
        const y2 = cy(pr)
        const d =
          x1 === x2
            ? `M${x1},${y1} L${x2},${y2}`
            : `M${x1},${y1} C${x1},${y1 + ROW_H * 0.5} ${x2},${y1 + ROW_H * 0.5} ${x2},${
                y1 + ROW_H
              } L${x2},${y2}`
        out.push({
          d,
          color: isDim(c.hash) ? 'var(--border-strong)' : laneColor(Math.max(cc, pc)),
          key: `${c.hash}-${p}`
        })
      })
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayCommits, layout, reachable, hasHead])

  // Scroll to the first branch matching the search.
  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q || !scrollRef.current) return
    const idx = displayCommits.findIndex((c) =>
      c.refs.some(
        (r) => (r.type === 'branch' || r.type === 'remote') && r.name.toLowerCase().includes(q)
      )
    )
    if (idx >= 0) scrollRef.current.scrollTop = Math.max(0, idx * ROW_H - 60)
  }, [search, displayCommits])

  function branchMenuItems(name: string, isLocal: boolean): MenuItem[] {
    const items: MenuItem[] = []
    if (name !== currentBranch) {
      items.push({ label: 'Checkout branch', onClick: () => onCheckoutBranch(name) })
    }
    if (isLocal) {
      items.push({ label: 'Rename branch…', onClick: () => onRenameBranch(name) })
      items.push({ label: 'Delete branch…', danger: true, onClick: () => onDeleteBranch(name) })
      if (name !== currentBranch && currentBranch) {
        items.push({
          label: `Merge into ${currentBranch}…`,
          onClick: () => onMergeBranch(name)
        })
      }
    }
    items.push({
      label: 'Copy branch name',
      divider: items.length > 0,
      onClick: () => navigator.clipboard.writeText(name)
    })
    return items
  }

  function openBranchMenu(e: React.MouseEvent, name: string, isLocal: boolean) {
    e.preventDefault()
    e.stopPropagation()
    setBranchMenu({ x: e.clientX, y: e.clientY, items: branchMenuItems(name, isLocal) })
  }

  const searchHit = (name: string) =>
    !!search.trim() && name.toLowerCase().includes(search.trim().toLowerCase())

  return (
    <div className="graph-pane">
      <div className="graph-toolbar">
        <input
          className="graph-search"
          placeholder="Search branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          spellCheck={false}
        />
        <div className="segmented graph-view-toggle">
          <button className={!tipsOnly ? 'active' : ''} onClick={() => setTipsOnly(false)}>
            All
          </button>
          <button
            className={tipsOnly ? 'active' : ''}
            onClick={() => setTipsOnly(true)}
            title="Show only branch tips"
          >
            Tips
          </button>
        </div>
      </div>

      {fileFilter && (
        <div className="filter-banner">
          <span>
            History of <code>{fileFilter}</code>
            <span className="muted"> · {commits.length} commits</span>
          </span>
          <button className="text-btn" onClick={onClearFilter}>
            ✕ Clear
          </button>
        </div>
      )}

      <div className="graph-scroll" ref={scrollRef}>
        {showWorking && (
          <div
            className={`working-row${selected === 'working' ? ' selected' : ''}`}
            onClick={onSelectWorking}
            style={{ height: ROW_H }}
          >
            <Icon name="pencil" size={15} className="working-icon" />
            <span className="working-label">Uncommitted changes</span>
            <span className="count-pill">{changeCount}</span>
          </div>
        )}

        <div className="graph-body" style={{ height: displayCommits.length * ROW_H }}>
          <svg
            className="graph-edges"
            width={graphWidth}
            height={displayCommits.length * ROW_H}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {edges.map((e) => (
              <path key={e.key} d={e.d} stroke={e.color} strokeWidth={2} fill="none" />
            ))}
            {displayCommits.map((c) => {
              const col = layout.colByHash.get(c.hash)!
              const row = layout.rowByHash.get(c.hash)!
              return (
                <circle
                  key={c.hash}
                  cx={cx(col)}
                  cy={cy(row)}
                  r={NODE_R}
                  fill={isDim(c.hash) ? 'var(--text-faint)' : laneColor(col)}
                  stroke="var(--bg-2)"
                  strokeWidth={2}
                />
              )
            })}
          </svg>

          {displayCommits.map((c) => {
            const row = layout.rowByHash.get(c.hash)!
            return (
              <div
                key={c.hash}
                className={`commit-row${selected === c.hash ? ' selected' : ''}${
                  isDim(c.hash) ? ' dim' : ''
                }`}
                style={{ top: row * ROW_H, height: ROW_H, paddingLeft: graphWidth }}
                onClick={() => onSelectCommit(c.hash)}
              >
                <div className="commit-line">
                  {c.refs.map((r) => {
                    const isBranch = r.type === 'branch' || r.type === 'remote'
                    const isCurrent = r.type === 'branch' && r.name === currentBranch
                    const pr = isBranch ? prByBranch.get(r.name) : undefined
                    return (
                      <span key={`${r.type}-${r.name}`} className="ref-group">
                        <span
                          className={`ref-chip ref-${r.type}${
                            searchHit(r.name) ? ' search-hit' : ''
                          }${isCurrent ? ' current' : ''}`}
                          onContextMenu={
                            isBranch
                              ? (e) => openBranchMenu(e, r.name, r.type === 'branch')
                              : undefined
                          }
                        >
                          {isBranch ? <BranchLabel name={r.name} /> : r.name}
                        </span>
                        {pr && (
                          <span
                            className="pr-chip"
                            title={`PR #${pr.number}: ${pr.title} — double-click to open`}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              onOpenPR(pr.url)
                            }}
                          >
                            <span className="pr-tick" />#{pr.number}
                          </span>
                        )}
                      </span>
                    )
                  })}
                  <span className="commit-subject-row">{c.subject}</span>
                </div>
                <div className="commit-side">
                  <span className="avatar sm" style={{ background: colorFromString(c.authorEmail) }}>
                    {initials(c.author)}
                  </span>
                  <span className="muted small">{relativeTime(c.date)}</span>
                  <code className="short-hash">{c.shortHash}</code>
                </div>
              </div>
            )
          })}
        </div>

        {displayCommits.length === 0 && !fileFilter && (
          <div className="empty-hint big">No commits yet.</div>
        )}
      </div>

      {branchMenu && (
        <ContextMenu
          x={branchMenu.x}
          y={branchMenu.y}
          items={branchMenu.items}
          onClose={() => setBranchMenu(null)}
        />
      )}
    </div>
  )
}
