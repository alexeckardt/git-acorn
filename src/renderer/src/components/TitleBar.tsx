import type { RepoInfo, RepoStatus } from '../../../shared/types'

interface Props {
  repo: RepoInfo | null
  status: RepoStatus | null
  onOpen: () => void
  onRefresh: () => void
}

export default function TitleBar({ repo, status, onOpen, onRefresh }: Props) {
  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <span className="brand">🌰 git-acorn</span>
        {repo && <span className="repo-name">{repo.name}</span>}
      </div>
      <div className="titlebar-right">
        {status && (
          <span className="branch-pill" title={status.upstream}>
            <span className="branch-icon">⑂</span>
            {status.branch}
            {status.ahead > 0 && <span className="ab">↑{status.ahead}</span>}
            {status.behind > 0 && <span className="ab">↓{status.behind}</span>}
          </span>
        )}
        {repo && (
          <button className="tb-btn" onClick={onRefresh} title="Refresh">
            ⟳
          </button>
        )}
        <button className="tb-btn primary" onClick={onOpen}>
          Open repo…
        </button>
      </div>
    </div>
  )
}
