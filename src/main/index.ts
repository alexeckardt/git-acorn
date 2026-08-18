import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import * as g from './git'
import type { DiffSource, GitResult } from '../shared/types'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Wrap a git operation so the renderer always receives {ok, data?, error?}. */
async function wrap<T>(fn: () => Promise<T>): Promise<GitResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function registerIpc(): void {
  ipcMain.handle('repo:open', async () => {
    return wrap(async () => {
      const res = await dialog.showOpenDialog({
        title: 'Open a git repository',
        properties: ['openDirectory']
      })
      if (res.canceled || res.filePaths.length === 0) {
        throw new Error('Cancelled')
      }
      return g.setRepo(res.filePaths[0])
    })
  })

  ipcMain.handle('repo:set', (_e, path: string) => wrap(() => g.setRepo(path)))
  ipcMain.handle('repo:current', () => wrap(async () => g.currentRepo()))

  ipcMain.handle('git:status', () => wrap(() => g.status()))
  ipcMain.handle('git:log', (_e, opts) => wrap(() => g.log(opts)))
  ipcMain.handle('git:commitDetail', (_e, hash: string) => wrap(() => g.commitDetail(hash)))
  ipcMain.handle('git:diff', (_e, source: DiffSource) => wrap(() => g.diff(source)))

  ipcMain.handle('git:stage', (_e, paths: string[]) => wrap(() => g.stage(paths)))
  ipcMain.handle('git:unstage', (_e, paths: string[]) => wrap(() => g.unstage(paths)))
  ipcMain.handle('git:stageAll', () => wrap(() => g.stageAll()))
  ipcMain.handle('git:unstageAll', () => wrap(() => g.unstageAll()))
  ipcMain.handle('git:discard', (_e, paths: string[]) => wrap(() => g.discard(paths)))
  ipcMain.handle('git:commit', (_e, summary: string, description: string) =>
    wrap(() => g.commit(summary, description))
  )
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
