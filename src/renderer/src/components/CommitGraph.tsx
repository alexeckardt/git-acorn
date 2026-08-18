import { useMemo } from 'react'
import type { Commit, RepoStatus } from '../../../shared/types'
import { computeGraph, laneColor } from '../lib/graph'
import { colorFromString, initials, relativeTime } from '../lib/util'

const ROW_H = 46
const COL_W = 20
const NODE_R = 5
const LEFT_PAD = 16

interface Props {
  commits: Commit[]
  status: RepoStatus | null
  /** Selected commit hash, or 'working' for the uncommitted-changes row. */
  selected: string | 'working' | null
  onSelectCommit: (hash: string) => void
  onSelectWorking: () => void
  fileFilter: string | null
  onClearFilter: () => void
}

export default function CommitGraph({
  commits,
  status,
  selected,
  onSelectCommit,
  onSelectWorking,
  fileFilter,
  onClearFilter
}: Props) {
  const layout = useMemo(() => computeGraph(commits), [commits])
  const graphWidth = LEFT_PAD * 2 + (layout.maxCol + 1) * COL_W
  const cx = (col: number) => LEFT_PAD + col * COL_W
  const cy = (row: number) => row * ROW_H + ROW_H / 2

  const changeCount =
    status && !fileFilter ? status.staged.length + status.unstaged.length : 0
  const showWorking = changeCount > 0

  const edges = useMemo(() => {
    const out: { d: string; color: string; key: string }[] = []
    commits.forEach((c) => {
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
        let d: string
        if (x1 === x2) {
          d = `M${x1},${y1} L${x2},${y2}`
        } else {
          // Shift columns within the first row gap, then run straight down.
          const yb = y1 + ROW_H
          d = `M${x1},${y1} C${x1},${y1 + ROW_H * 0.5} ${x2},${yb - ROW_H * 0.5} ${x2},${yb} L${x2},${y2}`
        }
        // Colour the edge by the busier (higher) lane it belongs to.
        out.push({ d, color: laneColor(Math.max(cc, pc)), key: `${c.hash}-${p}` })
      })
    })
    return out
  }, [commits, layout])

  return (
    <div className="graph-pane">
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

      <div className="graph-scroll">
        {showWorking && (
          <div
            className={`working-row${selected === 'working' ? ' selected' : ''}`}
            onClick={onSelectWorking}
            style={{ height: ROW_H }}
          >
            <span className="working-node" />
            <span className="working-label">Uncommitted changes</span>
            <span className="count-pill">{changeCount}</span>
          </div>
        )}

        <div className="graph-body" style={{ height: commits.length * ROW_H }}>
          <svg
            className="graph-edges"
            width={graphWidth}
            height={commits.length * ROW_H}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {edges.map((e) => (
              <path key={e.key} d={e.d} stroke={e.color} strokeWidth={2} fill="none" />
            ))}
            {commits.map((c) => {
              const col = layout.colByHash.get(c.hash)!
              const row = layout.rowByHash.get(c.hash)!
              return (
                <circle
                  key={c.hash}
                  cx={cx(col)}
                  cy={cy(row)}
                  r={NODE_R}
                  fill={laneColor(col)}
                  stroke="var(--bg-2)"
                  strokeWidth={2}
                />
              )
            })}
          </svg>

          {commits.map((c) => {
            const row = layout.rowByHash.get(c.hash)!
            return (
              <div
                key={c.hash}
                className={`commit-row${selected === c.hash ? ' selected' : ''}`}
                style={{ top: row * ROW_H, height: ROW_H, paddingLeft: graphWidth }}
                onClick={() => onSelectCommit(c.hash)}
              >
                <div className="commit-line">
                  {c.refs.map((r) => (
                    <span key={r.name} className={`ref-chip ref-${r.type}`}>
                      {r.name}
                    </span>
                  ))}
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

        {commits.length === 0 && !fileFilter && (
          <div className="empty-hint big">No commits yet.</div>
        )}
      </div>
    </div>
  )
}
