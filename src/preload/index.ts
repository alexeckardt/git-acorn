import { contextBridge, ipcRenderer } from 'electron'
import type { DiffSource, GitApi } from '../shared/types'

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
  commit: (summary, description) => ipcRenderer.invoke('git:commit', summary, description)
}

contextBridge.exposeInMainWorld('gitApi', api)
