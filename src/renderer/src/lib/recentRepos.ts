import { useSyncExternalStore } from 'react'

// A reactive, persisted list of recently opened repositories (most recent first).

export interface RepoEntry {
  path: string
  name: string
}

const KEY = 'git-acorn.recentRepos'
const MAX = 15

function load(): RepoEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        return arr.filter((e) => e && typeof e.path === 'string' && typeof e.name === 'string')
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return []
}

let list: RepoEntry[] = load()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }
}

function emit(): void {
  listeners.forEach((l) => l())
}

export function getRecentRepos(): RepoEntry[] {
  return list
}

export function addRecentRepo(entry: RepoEntry): void {
  list = [{ path: entry.path, name: entry.name }, ...list.filter((e) => e.path !== entry.path)].slice(
    0,
    MAX
  )
  persist()
  emit()
}

export function removeRecentRepo(path: string): void {
  const next = list.filter((e) => e.path !== path)
  if (next.length !== list.length) {
    list = next
    persist()
    emit()
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useRecentRepos(): RepoEntry[] {
  return useSyncExternalStore(subscribe, getRecentRepos, getRecentRepos)
}
