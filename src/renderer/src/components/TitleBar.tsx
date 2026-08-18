import type { RepoInfo, RepoStatus } from '../../../shared/types'

interface Props {
  repo: RepoInfo | null
  status: RepoStatus | null
  refreshing: boolean
  onOpen: () => void
  onRefresh: () => void
}

export default function TitleBar({ repo, status, refreshing, onOpen, onRefresh }: Props) {
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
          <button
            className={`refresh-icon${refreshing ? ' spinning' : ''}`}
            onClick={onRefresh}
            title="Refresh (auto-refreshes when you return to the app)"
            aria-label="Refresh"
            disabled={refreshing}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 12a9 9 0 1 1-2.64-6.36M21 4v4.5h-4.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <button className="tb-btn primary" onClick={onOpen}>
          Open repo…
        </button>
      </div>
    </div>
  )
}
