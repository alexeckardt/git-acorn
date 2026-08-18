import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  shell
} from 'electron'
import { join } from 'node:path'
import * as g from './git'
import * as term from './terminal'
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

/** Open a file in the OS default app, surfacing "no repo" and similar errors. */
async function openPath(resolver: () => Promise<string>): Promise<void> {
  try {
    const p = await resolver()
    const err = await shell.openPath(p)
    if (err) dialog.showErrorBox('git-acorn', err)
  } catch (e) {
    dialog.showErrorBox('git-acorn', (e as Error).message)
  }
}

/** Dispatch a renderer command by id (the renderer owns key handling). */
function sendCommand(id: string): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('command:invoke', id)
}

/**
 * A menu item that invokes a renderer command. `registerAccelerator: false`
 * shows the shortcut in the menu but leaves the key to the renderer, so it can
 * be platform-aware and suppressed while a text field is focused. Accelerators
 * here must stay in sync with src/renderer/src/lib/commands.ts.
 */
function commandItem(
  label: string,
  id: string,
  accelerator?: string
): MenuItemConstructorOptions {
  return { label, accelerator, registerAccelerator: false, click: () => sendCommand(id) }
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Repository',
      submenu: [
        commandItem('Open Repository…', 'open-repo', 'CmdOrCtrl+O'),
        commandItem('Refresh', 'refresh', 'CmdOrCtrl+R'),
        { type: 'separator' },
        commandItem('New Branch…', 'new-branch', 'CmdOrCtrl+B'),
        { type: 'separator' },
        commandItem('Commit', 'commit', 'CmdOrCtrl+Enter'),
        commandItem('Describe Changes…', 'describe-changes', 'CmdOrCtrl+.')
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Open .gitignore',
          click: () => openPath(() => g.gitignorePath())
        },
        {
          label: 'Open Local Excludes (Hidden Files)',
          click: () => openPath(() => g.excludeFilePath())
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        commandItem('Terminal', 'toggle-terminal', 'CmdOrCtrl+`'),
        { type: 'separator' },
        { role: 'reload', accelerator: 'Shift+CmdOrCtrl+R' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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
      const info = await g.setRepo(res.filePaths[0])
      term.resetTerminal()
      return info
    })
  })

  ipcMain.handle('repo:set', (_e, path: string) =>
    wrap(async () => {
      const info = await g.setRepo(path)
      term.resetTerminal()
      return info
    })
  )
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
  ipcMain.handle('git:createBranch', (_e, name: string) => wrap(() => g.createBranch(name)))
  ipcMain.handle('git:addToGitignore', (_e, paths: string[]) =>
    wrap(() => g.addToGitignore(paths))
  )
  ipcMain.handle('git:hideLocally', (_e, paths: string[]) => wrap(() => g.hideLocally(paths)))

  // Terminal
  ipcMain.on('term:run', (e, command: string) => {
    term.runCommand(
      command,
      (chunk) => e.sender.send('term:data', chunk),
      (code, cwd) => e.sender.send('term:exit', { code, cwd })
    )
  })
  ipcMain.on('term:interrupt', () => term.interruptTerminal())
  ipcMain.handle('term:cwd', () => term.terminalCwd())
}

app.whenReady().then(() => {
  registerIpc()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
