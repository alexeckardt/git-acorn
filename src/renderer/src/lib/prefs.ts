import { useSyncExternalStore } from 'react'

// A tiny reactive preferences store backed by localStorage. Components read it
// with usePrefs() and re-render when any preference changes.

export type CommitWorkflow = 'desktop' | 'wizard'

export interface Preferences {
  /** Run the description writer when committing with an empty description. */
  autoDescribe: boolean
  /** Which flow Ctrl/Cmd+Enter (and the Commit button) triggers. */
  commitWorkflow: CommitWorkflow
  /** Prefix pre-selected when creating a new branch (e.g. "feat/", or ""). */
  defaultBranchPrefix: string
  /** When the current branch's PR closes, switch to its base and pull. */
  autoSwitchOnPRClose: boolean
}

const DEFAULTS: Preferences = {
  autoDescribe: true,
  commitWorkflow: 'desktop',
  defaultBranchPrefix: '',
  autoSwitchOnPRClose: true
}

const KEY = 'git-acorn.prefs'
const LEGACY_AUTO_KEY = 'git-acorn.autoDescribe'

function load(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* fall through to defaults */
  }
  // Migrate the old standalone auto-describe key, if present.
  const legacy = localStorage.getItem(LEGACY_AUTO_KEY)
  if (legacy !== null) return { ...DEFAULTS, autoDescribe: legacy === '1' }
  return { ...DEFAULTS }
}

let prefs: Preferences = load()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* storage unavailable */
  }
}

export function getPrefs(): Preferences {
  return prefs
}

export function setPref<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  prefs = { ...prefs, [key]: value }
  persist()
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function usePrefs(): Preferences {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs)
}
