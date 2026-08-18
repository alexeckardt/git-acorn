import { contextBridge, ipcRenderer } from 'electron'
import type { DiffSource, GitApi, TermApi } from '../shared/types'

const api: GitApi = {
  openRepoDialog: () => ipcRenderer.invoke('repo:open'),
  setRepo: (path) => ipcRenderer.invoke('repo:set', path),
  currentRepo: () => ipcRenderer.invoke('repo:current'),
  status: () => ipcRenderer.invoke('git:status'),
  log: (opts) => ipcRenderer.invoke('git:log', opts),
  commitDetail: (hash) => ipcRenderer.invoke('git:commitDetail', hash),
  diff: (source: DiffSource) => ipcRenderer.invoke('git:diff', source),
  stage: (paths) => ipcRenderer.invoke('git:stage', paths),
  unstage: (paths) => ipcRenderer.invoke('git:unstage', paths),
  stageAll: () => ipcRenderer.invoke('git:stageAll'),
  unstageAll: () => ipcRenderer.invoke('git:unstageAll'),
  discard: (paths) => ipcRenderer.invoke('git:discard', paths),
  commit: (summary, description) => ipcRenderer.invoke('git:commit', summary, description),
  addToGitignore: (paths) => ipcRenderer.invoke('git:addToGitignore', paths),
  hideLocally: (paths) => ipcRenderer.invoke('git:hideLocally', paths)
}

contextBridge.exposeInMainWorld('gitApi', api)

const termApi: TermApi = {
  run: (command) => ipcRenderer.send('term:run', command),
  interrupt: () => ipcRenderer.send('term:interrupt'),
  cwd: () => ipcRenderer.invoke('term:cwd'),
  onData: (cb) => {
    const l = (_e: unknown, chunk: string) => cb(chunk)
    ipcRenderer.on('term:data', l)
    return () => ipcRenderer.removeListener('term:data', l)
  },
  onExit: (cb) => {
    const l = (_e: unknown, info: { code: number; cwd: string }) => cb(info)
    ipcRenderer.on('term:exit', l)
    return () => ipcRenderer.removeListener('term:exit', l)
  },
  onToggle: (cb) => {
    const l = () => cb()
    ipcRenderer.on('menu:toggleTerminal', l)
    return () => ipcRenderer.removeListener('menu:toggleTerminal', l)
  }
}

contextBridge.exposeInMainWorld('termApi', termApi)
