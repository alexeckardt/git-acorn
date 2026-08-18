import type { GitApi } from '../shared/types'

declare global {
  interface Window {
    gitApi: GitApi
  }
}

export {}
