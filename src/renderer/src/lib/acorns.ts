import { useSyncExternalStore } from 'react'

// A tiny reactive counter for how many acorns the little guys have dropped.
// Persists across sessions in localStorage; components read it with useAcorns().

const KEY = 'git-acorn.acorns'

function load(): number {
  try {
    const n = parseInt(localStorage.getItem(KEY) ?? '', 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

let count = load()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    localStorage.setItem(KEY, String(count))
  } catch {
    /* storage unavailable */
  }
}

export function getAcorns(): number {
  return count
}

export function addAcorns(n = 1): void {
  count += n
  persist()
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useAcorns(): number {
  return useSyncExternalStore(subscribe, getAcorns, getAcorns)
}
