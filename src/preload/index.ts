import { contextBridge, ipcRenderer } from 'electron'
import type { DiffSource, GitApi, MenuApi, TermApi } from '../shared/types'

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
  hideLocally: (paths) => ipcRenderer.invoke('git:hideLocally', paths),
  getCommitColors: () => ipcRenderer.invoke('git:getCommitColors'),
  setCommitColor: (hash, color) => ipcRenderer.invoke('git:setCommitColor', hash, color),
  createBranch: (name) => ipcRenderer.invoke('git:createBranch', name),
  branches: () => ipcRenderer.invoke('git:branches'),
  switchBranch: (name) => ipcRenderer.invoke('git:switchBranch', name),
  defaultBranch: () => ipcRenderer.invoke('git:defaultBranch'),
  ghAvailable: () => ipcRenderer.invoke('git:ghAvailable'),
  branchHasPR: (branch) => ipcRenderer.invoke('git:branchHasPR', branch),
  createPR: (branch) => ipcRenderer.invoke('git:createPR', branch),
  fetch: () => ipcRenderer.invoke('git:fetch'),
  pull: () => ipcRenderer.invoke('git:pull'),
  sync: () => ipcRenderer.invoke('git:sync'),
  renameBranch: (oldName, newName) => ipcRenderer.invoke('git:renameBranch', oldName, newName),
  deleteBranch: (name, force) => ipcRenderer.invoke('git:deleteBranch', name, force),
  mergeBranch: (name) => ipcRenderer.invoke('git:mergeBranch', name),
  listPRs: () => ipcRenderer.invoke('git:listPRs'),
  prStatus: (branch) => ipcRenderer.invoke('git:prStatus', branch),
  mergePR: (branch) => ipcRenderer.invoke('git:mergePR', branch),
  openInEditor: () => ipcRenderer.invoke('git:openInEditor'),
  openExternal: (url) => ipcRenderer.invoke('git:openExternal', url)
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
  }
}

contextBridge.exposeInMainWorld('termApi', termApi)

const menuApi: MenuApi = {
  onCommand: (cb) => {
    const l = (_e: unknown, id: string) => cb(id)
    ipcRenderer.on('command:invoke', l)
    return () => ipcRenderer.removeListener('command:invoke', l)
  }
}

contextBridge.exposeInMainWorld('menuApi', menuApi)
