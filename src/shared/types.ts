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

export interface PullRequest {
  number: number
  url: string
  /** The PR's head branch (headRefName). */
  branch: string
  /** The PR's base branch (baseRefName). */
  base: string
  title: string
  state: string
}

export interface MergeResult {
  conflict: boolean
  message: string
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
  /** Create a new branch and switch to it (carries over uncommitted changes). */
  createBranch: (name: string) => Promise<GitResult<void>>
  /** List local branches and the current branch. */
  branches: () => Promise<GitResult<{ current: string; all: string[] }>>
  /** Switch to an existing branch (carries over uncommitted changes). */
  switchBranch: (name: string) => Promise<GitResult<void>>
  /** The repo's default branch (remote HEAD, else local main/master). */
  defaultBranch: () => Promise<GitResult<string>>
  /** Whether the GitHub CLI is installed. */
  ghAvailable: () => Promise<GitResult<boolean>>
  /** Whether a branch already has an open PR (best-effort). */
  branchHasPR: (branch: string) => Promise<GitResult<boolean>>
  /** Create a PR for a branch (defaults to current); pushes it first. Returns URL. */
  createPR: (branch?: string) => Promise<GitResult<string>>
  /** Fetch from the remote (updates ahead/behind). */
  fetch: () => Promise<GitResult<void>>
  /** Pull (fetch + merge) the current branch. */
  pull: () => Promise<GitResult<MergeResult>>
  /** Pull (fetch + merge) then push; reports whether the merge conflicted. */
  sync: () => Promise<GitResult<MergeResult>>
  /** Append the paths to the repo's committed .gitignore. */
  addToGitignore: (paths: string[]) => Promise<GitResult<void>>
  /**
   * Hide the paths from the changes list without touching .gitignore:
   * untracked files go into .git/info/exclude, tracked files get
   * `git update-index --skip-worktree`.
   */
  hideLocally: (paths: string[]) => Promise<GitResult<void>>
  /** Rename a branch. */
  renameBranch: (oldName: string, newName: string) => Promise<GitResult<void>>
  /** Delete a branch (force uses -D). */
  deleteBranch: (name: string, force: boolean) => Promise<GitResult<void>>
  /** Merge a branch into the current one; reports whether it conflicted. */
  mergeBranch: (name: string) => Promise<GitResult<MergeResult>>
  /** Open PRs in the repo (best-effort via gh), keyed by head branch. */
  listPRs: () => Promise<GitResult<PullRequest[]>>
  /** Open the repo folder in the user's code editor (VS Code, …). */
  openInEditor: () => Promise<GitResult<void>>
  /** Open a URL in the default browser. */
  openExternal: (url: string) => Promise<GitResult<void>>
}

/** Bridge for the embedded terminal (main process runs a shell session). */
export interface TermApi {
  /** Run a command; output arrives via onData, completion via onExit. */
  run: (command: string) => void
  /** Send SIGINT to the currently running command. */
  interrupt: () => void
  /** The terminal's current working directory. */
  cwd: () => Promise<string>
  /** Subscribe to output chunks. Returns an unsubscribe function. */
  onData: (cb: (chunk: string) => void) => () => void
  /** Subscribe to command completion. Returns an unsubscribe function. */
  onExit: (cb: (info: { code: number; cwd: string }) => void) => () => void
}

/** Bridge for native-menu commands dispatched to the renderer. */
export interface MenuApi {
  /** Fired when a menu item / accelerator invokes a command by id. */
  onCommand: (cb: (id: string) => void) => () => void
}
