import type { GitApi, MenuApi, TermApi, UpdateApi, WindowApi } from '../shared/types'

declare global {
  interface Window {
    gitApi: GitApi
    termApi: TermApi
    menuApi: MenuApi
    windowApi: WindowApi
    updateApi: UpdateApi
  }
}

export {}
