// Types shared across the main, preload, and renderer processes.

export type FileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted'
  | 'unknown'

export interface ChangedFile {
  /** Path relative to the repo root. For renames, the new path. */
  path: string
  /** Original path for renames, otherwise undefined. */
  origPath?: string
  status: FileStatus
  staged: boolean
}

export interface RepoStatus {
  branch: string
  /** Upstream tracking branch, if any (e.g. "origin/main"). */
  upstream?: string
  ahead: number
  behind: number
  staged: ChangedFile[]
  unstaged: ChangedFile[]
}

export interface CommitRef {
  name: string
  /** local branch | remote branch | tag | HEAD */
  type: 'head' | 'branch' | 'remote' | 'tag'
}

export interface Commit {
  hash: string
  shortHash: string
  parents: string[]
  author: string
  authorEmail: string
  /** Unix timestamp (seconds). */
  date: number
  subject: string
  body: string
  refs: CommitRef[]
}

export interface CommitFileChange {
  path: string
  origPath?: string
  status: FileStatus
  additions: number
  deletions: number
}

export interface CommitDetail {
  commit: Commit
  files: CommitFileChange[]
}

export type DiffSource =
  | { kind: 'workingUnstaged'; path: string }
  | { kind: 'workingStaged'; path: string }
  | { kind: 'commit'; hash: string; path: string }

export interface RepoInfo {
  path: string
  name: string
}

export interface GitResult<T> {
  ok: boolean
  data?: T
  error?: string
}

/** The API surface exposed to the renderer via the preload bridge. */
export interface GitApi {
  openRepoDialog: () => Promise<GitResult<RepoInfo>>
  setRepo: (path: string) => Promise<GitResult<RepoInfo>>
  currentRepo: () => Promise<GitResult<RepoInfo | null>>
  status: () => Promise<GitResult<RepoStatus>>
  log: (opts?: { limit?: number; filePath?: string }) => Promise<GitResult<Commit[]>>
  commitDetail: (hash: string) => Promise<GitResult<CommitDetail>>
  diff: (source: DiffSource) => Promise<GitResult<string>>
  stage: (paths: string[]) => Promise<GitResult<void>>
  unstage: (paths: string[]) => Promise<GitResult<void>>
  stageAll: () => Promise<GitResult<void>>
  unstageAll: () => Promise<GitResult<void>>
  discard: (paths: string[]) => Promise<GitResult<void>>
  commit: (summary: string, description: string) => Promise<GitResult<void>>
  /** Append the paths to the repo's committed .gitignore. */
  addToGitignore: (paths: string[]) => Promise<GitResult<void>>
  /**
   * Hide the paths from the changes list without touching .gitignore:
   * untracked files go into .git/info/exclude, tracked files get
   * `git update-index --skip-worktree`.
   */
  hideLocally: (paths: string[]) => Promise<GitResult<void>>
}
