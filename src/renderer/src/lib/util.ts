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
