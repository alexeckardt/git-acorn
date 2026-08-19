import type { RepoInfo, RepoStatus } from '../../../shared/types'
import { isMac } from '../lib/commands'
import Icon from './Icon'

interface Props {
  repo: RepoInfo | null
  status: RepoStatus | null
  refreshing: boolean
  syncing: boolean
  onSwitchRepo: () => void
  onSwitchBranch: () => void
  onRefresh: () => void
  onSync: () => void
}

export default function TitleBar({
  repo,
  status,
  refreshing,
  syncing,
  onSwitchRepo,
  onSwitchBranch,
  onRefresh,
  onSync
}: Props) {
  const branchShortcut = `${isMac ? '⌘' : 'Ctrl+'}B`
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  const canSync = !!status && (ahead > 0 || behind > 0)

  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <span className="brand">🌰 git-acorn</span>
        {repo && <span className="repo-name">{repo.name}</span>}
      </div>
      <div className="titlebar-right">
        {status && (
          <button
            className="branch-pill"
            onClick={onSwitchBranch}
            title={`Switch branch (${branchShortcut})`}
          >
            <Icon name="git-branch" size={13} className="branch-icon" />
            {status.branch}
          </button>
        )}

        {canSync && (
          <button
            className="sync-btn"
            onClick={onSync}
            disabled={syncing}
            title="Pull then push to origin"
          >
            {syncing ? (
              <span className="ring-spinner light" aria-hidden="true" />
            ) : (
              <Icon name="sync" size={15} />
            )}
            <span>Sync</span>
            {ahead > 0 && <span className="sync-count">↑{ahead}</span>}
            {behind > 0 && <span className="sync-count">↓{behind}</span>}
          </button>
        )}

        {repo && (
          <button
            className="refresh-icon"
            onClick={onRefresh}
            title="Fetch from origin & refresh"
            aria-label="Fetch & refresh"
            disabled={refreshing}
          >
            {refreshing ? (
              <span className="ring-spinner" aria-hidden="true" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 12a9 9 0 1 1-2.64-6.36M21 4v4.5h-4.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
        <button className="tb-btn primary" onClick={onSwitchRepo}>
          {repo ? 'Switch repo' : 'Open repo…'}
        </button>
      </div>
    </div>
  )
}
