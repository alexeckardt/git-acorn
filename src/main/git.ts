import { execFile } from 'node:child_process'
import { basename } from 'node:path'
import type {
  ChangedFile,
  Commit,
  CommitDetail,
  CommitFileChange,
  CommitRef,
  DiffSource,
  FileStatus,
  RepoInfo,
  RepoStatus
} from '../shared/types'

const US = '\x1f' // unit separator between fields
const RS = '\x1e' // record separator between commits

let repoPath: string | null = null

/** Run a git command in the current repo (or a given cwd) and return stdout. */
function git(args: string[], cwd?: string, opts?: { allowCode1?: boolean }): Promise<string> {
  const dir = cwd ?? repoPath
  if (!dir) return Promise.reject(new Error('No repository is open'))
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd: dir, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          // Diff commands (notably `--no-index`) exit 1 when differences exist;
          // that's success for our purposes, so surface stdout instead.
          if (opts?.allowCode1 && (err as { code?: number }).code === 1) {
            resolve(stdout.toString())
            return
          }
          reject(new Error(stderr?.toString().trim() || err.message))
          return
        }
        resolve(stdout.toString())
      }
    )
  })
}

/** Whether git currently tracks a path (i.e. it exists in the index/HEAD). */
async function isTracked(path: string): Promise<boolean> {
  try {
    await git(['ls-files', '--error-unmatch', '--', path])
    return true
  } catch {
    return false
  }
}

export function getRepoPath(): string | null {
  return repoPath
}

export function currentRepo(): RepoInfo | null {
  if (!repoPath) return null
  return { path: repoPath, name: basename(repoPath) }
}

/** Resolve a folder to its git top level and make it the active repo. */
export async function setRepo(candidate: string): Promise<RepoInfo> {
  const top = (await git(['rev-parse', '--show-toplevel'], candidate)).trim()
  if (!top) throw new Error('Not a git repository')
  repoPath = top
  return { path: top, name: basename(top) }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function mapStatusCode(code: string): FileStatus {
  switch (code) {
    case 'M':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    case 'U':
      return 'conflicted'
    default:
      return 'unknown'
  }
}

export async function status(): Promise<RepoStatus> {
  const out = await git([
    'status',
    '--porcelain=v2',
    '--branch',
    '--untracked-files=all',
    '-z'
  ])
  const tokens = out.split('\0')

  const result: RepoStatus = {
    branch: '(detached)',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: []
  }

  for (let i = 0; i < tokens.length; i++) {
    const line = tokens[i]
    if (!line) continue

    if (line.startsWith('# ')) {
      const header = line.slice(2)
      if (header.startsWith('branch.head ')) {
        result.branch = header.slice('branch.head '.length)
      } else if (header.startsWith('branch.upstream ')) {
        result.upstream = header.slice('branch.upstream '.length)
      } else if (header.startsWith('branch.ab ')) {
        const m = header.match(/\+(\d+)\s+-(\d+)/)
        if (m) {
          result.ahead = parseInt(m[1], 10)
          result.behind = parseInt(m[2], 10)
        }
      }
      continue
    }

    const type = line[0]
    if (type === '1') {
      // Ordinary change: "1 XY sub mH mI mW hH hI path" -> 8 fields before path.
      const xy = line.slice(2, 4)
      const path = afterFields(line, 8)
      addEntry(result, xy, path)
    } else if (type === '2') {
      // Rename/copy: "2 XY sub mH mI mW hH hI Xscore path" then origPath as next token.
      const xy = line.slice(2, 4)
      const path = afterFieldsRename(line)
      const origPath = tokens[++i] ?? ''
      addEntry(result, xy, path, origPath)
    } else if (type === 'u') {
      // Unmerged / conflicted.
      const path = afterFields(line, 10)
      result.unstaged.push({ path, status: 'conflicted', staged: false })
    } else if (type === '?') {
      result.unstaged.push({ path: line.slice(2), status: 'untracked', staged: false })
    }
    // '!' ignored entries are skipped.
  }

  return result
}

/** Return the substring after `count` space-separated fields (for porcelain v2). */
function afterFields(line: string, count: number): string {
  let idx = 0
  for (let f = 0; f < count; f++) {
    idx = line.indexOf(' ', idx) + 1
  }
  return line.slice(idx)
}

function afterFieldsRename(line: string): string {
  // Type 2 has one extra field (Xscore) before the path -> 9 fields total.
  return afterFields(line, 9)
}

function addEntry(result: RepoStatus, xy: string, path: string, origPath?: string): void {
  const x = xy[0] // staged (index)
  const y = xy[1] // unstaged (worktree)
  if (x !== '.') {
    result.staged.push({
      path,
      origPath,
      status: mapStatusCode(x),
      staged: true
    })
  }
  if (y !== '.') {
    result.unstaged.push({
      path,
      origPath,
      status: mapStatusCode(y),
      staged: false
    })
  }
}

// ---------------------------------------------------------------------------
// Log / graph
// ---------------------------------------------------------------------------

function parseRefs(raw: string): CommitRef[] {
  if (!raw) return []
  const refs: CommitRef[] = []
  for (const part of raw.split(',').map((s) => s.trim())) {
    if (!part) continue
    if (part.startsWith('HEAD -> ')) {
      refs.push({ name: 'HEAD', type: 'head' })
      refs.push({ name: part.slice('HEAD -> '.length), type: 'branch' })
    } else if (part === 'HEAD') {
      refs.push({ name: 'HEAD', type: 'head' })
    } else if (part.startsWith('tag: ')) {
      refs.push({ name: part.slice('tag: '.length), type: 'tag' })
    } else if (part.startsWith('origin/') || part.includes('/')) {
      refs.push({ name: part, type: 'remote' })
    } else {
      refs.push({ name: part, type: 'branch' })
    }
  }
  return refs
}

export async function log(opts?: { limit?: number; filePath?: string }): Promise<Commit[]> {
  const limit = opts?.limit ?? 500
  const format = [
    '%H',
    '%h',
    '%P',
    '%an',
    '%ae',
    '%at',
    '%D',
    '%s',
    '%b'
  ].join(US)

  // --topo-order keeps every parent below all of its children, so graph edges
  // always point downward.
  const args = ['log', '--topo-order', `--pretty=format:${format}${RS}`, `-n${limit}`]
  if (opts?.filePath) {
    args.push('--follow')
  } else {
    args.push('--all')
  }
  if (opts?.filePath) {
    args.push('--', opts.filePath)
  }

  let out: string
  try {
    out = await git(args)
  } catch (e) {
    // Empty repo (no commits yet) -> return nothing rather than erroring.
    const msg = (e as Error).message
    if (/does not have any commits|bad default revision/i.test(msg)) return []
    throw e
  }

  const records = out.split(RS)
  const commits: Commit[] = []
  for (const rec of records) {
    const trimmed = rec.replace(/^\n/, '')
    if (!trimmed.trim()) continue
    const f = trimmed.split(US)
    if (f.length < 9) continue
    commits.push({
      hash: f[0],
      shortHash: f[1],
      parents: f[2] ? f[2].split(' ').filter(Boolean) : [],
      author: f[3],
      authorEmail: f[4],
      date: parseInt(f[5], 10),
      refs: parseRefs(f[6]),
      subject: f[7],
      body: f[8].trim()
    })
  }
  return commits
}

// ---------------------------------------------------------------------------
// Commit detail
// ---------------------------------------------------------------------------

export async function commitDetail(hash: string): Promise<CommitDetail> {
  const meta = await singleCommit(hash)

  const numstat = await git(['show', '--format=', '--numstat', '-z', hash])
  const nameStatus = await git(['show', '--format=', '--name-status', '-z', hash])

  const statusByPath = parseNameStatus(nameStatus)
  const files = parseNumstat(numstat, statusByPath)

  return { commit: meta, files }
}

async function singleCommit(hash: string): Promise<Commit> {
  const format = ['%H', '%h', '%P', '%an', '%ae', '%at', '%D', '%s', '%b'].join(US)
  const out = await git(['show', '--no-patch', `--pretty=format:${format}`, hash])
  const f = out.split(US)
  return {
    hash: f[0],
    shortHash: f[1],
    parents: f[2] ? f[2].split(' ').filter(Boolean) : [],
    author: f[3],
    authorEmail: f[4],
    date: parseInt(f[5], 10),
    refs: parseRefs(f[6]),
    subject: f[7],
    body: (f[8] ?? '').trim()
  }
}

function parseNameStatus(z: string): Map<string, { status: FileStatus; origPath?: string }> {
  const map = new Map<string, { status: FileStatus; origPath?: string }>()
  const tokens = z.split('\0').filter((t) => t.length > 0)
  let i = 0
  while (i < tokens.length) {
    const code = tokens[i++]
    const letter = code[0]
    if (letter === 'R' || letter === 'C') {
      const orig = tokens[i++]
      const dest = tokens[i++]
      map.set(dest, { status: mapStatusCode(letter), origPath: orig })
    } else {
      const path = tokens[i++]
      if (path === undefined) break
      map.set(path, { status: mapStatusCode(letter) })
    }
  }
  return map
}

function parseNumstat(
  z: string,
  statusByPath: Map<string, { status: FileStatus; origPath?: string }>
): CommitFileChange[] {
  const files: CommitFileChange[] = []
  const tokens = z.split('\0').filter((t) => t.length > 0)
  let i = 0
  while (i < tokens.length) {
    const entry = tokens[i]
    // numstat -z lines look like: "12\t3\t" then path in next token(s) for renames.
    const parts = entry.split('\t')
    if (parts.length < 3) {
      i++
      continue
    }
    const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10)
    const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10)
    let path = parts[2]
    let origPath: string | undefined
    if (path === '') {
      // Rename: the two following tokens are origPath and newPath.
      origPath = tokens[++i]
      path = tokens[++i]
    }
    const st = statusByPath.get(path)
    files.push({
      path,
      origPath: origPath ?? st?.origPath,
      status: st?.status ?? 'modified',
      additions,
      deletions
    })
    i++
  }
  return files
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export async function diff(source: DiffSource): Promise<string> {
  switch (source.kind) {
    case 'workingUnstaged': {
      // Untracked (newly added) files produce no `git diff` output because git
      // isn't tracking them yet. Show the whole file as added via --no-index.
      if (!(await isTracked(source.path))) {
        return git(['diff', '--no-index', '--', '/dev/null', source.path], undefined, {
          allowCode1: true
        })
      }
      return git(['diff', '--', source.path])
    }
    case 'workingStaged':
      return git(['diff', '--cached', '--', source.path])
    case 'commit':
      return git(['show', '--format=', source.hash, '--', source.path])
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function stage(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await git(['add', '-A', '--', ...paths])
}

export async function unstage(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await git(['reset', '-q', '--', ...paths])
}

export async function stageAll(): Promise<void> {
  await git(['add', '-A'])
}

export async function unstageAll(): Promise<void> {
  await git(['reset', '-q'])
}

export async function discard(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  // Revert tracked changes...
  try {
    await git(['restore', '--', ...paths])
  } catch {
    /* path may be untracked; ignore */
  }
  // ...and remove untracked files/dirs.
  try {
    await git(['clean', '-fd', '--', ...paths])
  } catch {
    /* nothing to clean */
  }
}

export async function commit(summary: string, description: string): Promise<void> {
  const args = ['commit', '-m', summary]
  if (description.trim()) {
    args.push('-m', description)
  }
  await git(args)
}
