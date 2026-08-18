import type { GitApi, MenuApi, TermApi } from '../shared/types'

declare global {
  interface Window {
    gitApi: GitApi
    termApi: TermApi
    menuApi: MenuApi
  }
}

export {}
