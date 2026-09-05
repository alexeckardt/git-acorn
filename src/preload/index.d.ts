import type { GitApi, MenuApi, TermApi, WindowApi } from '../shared/types'

declare global {
  interface Window {
    gitApi: GitApi
    termApi: TermApi
    menuApi: MenuApi
    windowApi: WindowApi
  }
}

export {}
