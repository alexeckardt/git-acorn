// Conventional branch prefixes and helpers for rendering branch names with
// icons standing in for the prefix (and `origin/` as a cloud).

export interface Prefix {
  key: string // e.g. "feat/", or "" for none
  label: string
  icon: string
}

export const PREFIXES: Prefix[] = [
  { key: '', label: 'No prefix', icon: 'git-branch' },
  { key: 'feat/', label: 'Feature', icon: 'sparkles' },
  { key: 'fix/', label: 'Fix', icon: 'bug' },
  { key: 'chore/', label: 'Chore', icon: 'wrench' },
  { key: 'docs/', label: 'Docs', icon: 'book' },
  { key: 'refactor/', label: 'Refactor', icon: 'recycle' },
  { key: 'test/', label: 'Test', icon: 'flask' },
  { key: 'hotfix/', label: 'Hotfix', icon: 'flame' }
]

export const isPrefix = (s: string): boolean => PREFIXES.some((p) => p.key === s)

/** Split a name into a known prefix + the remainder (for the branch picker). */
export function splitPrefix(name: string): { prefix: Prefix; rest: string } {
  const match = PREFIXES.find((p) => p.key && name.toLowerCase().startsWith(p.key))
  if (match) return { prefix: match, rest: name.slice(match.key.length) }
  return { prefix: PREFIXES[0], rest: name }
}

export interface BranchParts {
  /** True when the name starts with `origin/` (rendered as a cloud). */
  origin: boolean
  /** Icon name for a recognised prefix, else undefined. */
  prefixIcon?: string
  /** The remaining text to show. */
  text: string
}

/**
 * Parse a full ref name into display parts. Only `origin/` becomes a cloud;
 * other remotes are left intact. A known prefix (feat/, fix/, …) is replaced by
 * its icon, even when it follows `origin/`.
 */
export function parseBranchName(fullName: string): BranchParts {
  let rest = fullName
  let origin = false
  if (rest.startsWith('origin/')) {
    origin = true
    rest = rest.slice('origin/'.length)
  }
  const match = PREFIXES.find((p) => p.key && rest.toLowerCase().startsWith(p.key))
  if (match) {
    return { origin, prefixIcon: match.icon, text: rest.slice(match.key.length) }
  }
  return { origin, text: rest }
}
