import type { CommitDetail } from '../../../shared/types'
import { colorFromString, fullDate, initials, splitPath, statusBadge } from '../lib/util'

interface Props {
  detail: CommitDetail | null
  loading: boolean
  selectedPath: string | null
  onSelectFile: (path: string) => void
  onFileHistory: (path: string) => void
  onBack: () => void
}

export default function CommitInfoPanel({
  detail,
  loading,
  selectedPath,
  onSelectFile,
  onFileHistory,
  onBack
}: Props) {
  if (loading || !detail) {
    return (
      <div className="commit-info">
        <button className="card-btn back-btn" onClick={onBack}>
          ← Back to changes
        </button>
        <div className="empty-hint">Loading commit…</div>
      </div>
    )
  }

  const c = detail.commit
  const totalAdd = detail.files.reduce((n, f) => n + f.additions, 0)
  const totalDel = detail.files.reduce((n, f) => n + f.deletions, 0)

  return (
    <div className="commit-info">
      <button className="card-btn back-btn" onClick={onBack}>
        ← Back to changes
      </button>

      <div className="commit-meta">
        <div className="commit-subject">{c.subject}</div>
        {c.body && <pre className="commit-body">{c.body}</pre>}
        <div className="commit-author-line">
          <span className="avatar" style={{ background: colorFromString(c.authorEmail) }}>
            {initials(c.author)}
          </span>
          <div>
            <div className="author-name">{c.author}</div>
            <div className="muted small">{fullDate(c.date)}</div>
          </div>
        </div>
        <div className="commit-hashes">
          <code>{c.shortHash}</code>
          {c.parents.length > 1 && <span className="merge-tag">merge</span>}
        </div>
      </div>

      <header className="section-head">
        <span>
          Files <span className="count">{detail.files.length}</span>
        </span>
        <span className="diffstat">
          <span className="add">+{totalAdd}</span> <span className="del">−{totalDel}</span>
        </span>
      </header>
      <div className="file-list">
        {detail.files.map((f) => {
          const badge = statusBadge(f.status)
          const { dir, name } = splitPath(f.path)
          return (
            <div
              key={f.path}
              className={`file-row${selectedPath === f.path ? ' selected' : ''}`}
              onClick={() => onSelectFile(f.path)}
              title={f.path}
            >
              <span className={`status-badge ${badge.cls}`}>{badge.letter}</span>
              <span className="file-path">
                {dir && <span className="file-dir">{dir}</span>}
                <span className="file-name">{name}</span>
              </span>
              <span className="file-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="icon-btn"
                  title="View file history"
                  onClick={() => onFileHistory(f.path)}
                >
                  🕘
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
