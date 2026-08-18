import type { GitApi, TermApi } from '../shared/types'

declare global {
  interface Window {
    gitApi: GitApi
    termApi: TermApi
  }
}

export {}
