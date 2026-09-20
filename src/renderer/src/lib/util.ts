import type { FileStatus } from '../../../shared/types'

/** Single-letter badge + colour class for a file status. */
export function statusBadge(status: FileStatus): { letter: string; cls: string } {
  switch (status) {
    case 'modified':
      return { letter: 'M', cls: 'st-modified' }
    case 'added':
      return { letter: 'A', cls: 'st-added' }
    case 'deleted':
      return { letter: 'D', cls: 'st-deleted' }
    case 'renamed':
      return { letter: 'R', cls: 'st-renamed' }
    case 'copied':
      return { letter: 'C', cls: 'st-renamed' }
    case 'untracked':
      return { letter: 'U', cls: 'st-untracked' }
    case 'conflicted':
      return { letter: '!', cls: 'st-conflict' }
    default:
      return { letter: '?', cls: 'st-untracked' }
  }
}

/** Split a path into directory + filename for two-tone display. */
export function splitPath(path: string): { dir: string; name: string } {
  const idx = path.lastIndexOf('/')
  if (idx === -1) return { dir: '', name: path }
  return { dir: path.slice(0, idx + 1), name: path.slice(idx + 1) }
}

export function relativeTime(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return new Date(unixSeconds * 1000).toLocaleDateString()
}

export function fullDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString()
}

/** Deterministic colour from a string (for author avatars). */
export function colorFromString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return `hsl(${h} 55% 55%)`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Does `path` match a single describe-ignore pattern? Forgiving, gitignore-ish:
 *  - Extension shorthand: ".png", "png", "*.png" match any file with that ext.
 *  - Globs with `*` / `?` match against the basename or the full path.
 *  - Anything else is a case-insensitive substring of the full path
 *    (so "dist/", "assets", "package-lock.json" all work).
 */
export function matchesIgnorePattern(path: string, raw: string): boolean {
  const p = raw.trim().toLowerCase()
  if (!p) return false
  const name = (path.split('/').pop() || path).toLowerCase()
  const full = path.toLowerCase()

  // Extension shorthand — ".png" / "png" (but not "*.png", handled as a glob).
  const ext = p.match(/^\.?([a-z0-9]+)$/)
  if (ext && !p.includes('*') && !p.includes('/')) {
    return name.endsWith('.' + ext[1])
  }

  if (p.includes('*') || p.includes('?')) {
    const re = new RegExp(
      '^' +
        p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') +
        '$'
    )
    return re.test(name) || re.test(full)
  }

  return full.includes(p)
}

/** True when `path` matches any of the given ignore patterns. */
export function matchesAnyIgnore(path: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesIgnorePattern(path, p))
}

/**
 * Reorder / filter changed files for the describe walk-through given the
 * describe-ignore patterns. In "skip" mode ignored files are dropped; in
 * "last" mode they are moved to the bottom (stable within each group).
 */
export function applyDescribeIgnore<T extends { path: string }>(
  files: T[],
  patterns: string[],
  mode: 'skip' | 'last'
): T[] {
  if (patterns.length === 0) return files
  const kept: T[] = []
  const ignored: T[] = []
  for (const f of files) (matchesAnyIgnore(f.path, patterns) ? ignored : kept).push(f)
  return mode === 'skip' ? kept : [...kept, ...ignored]
}
