import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import type { UpdateStatus } from '../shared/types'

// Auto-update wiring, backed by electron-updater against the GitHub Releases
// feed configured in package.json's build.publish. The renderer drives the flow
// through the `update:*` channels: it's told when a version is available, gets
// download progress, and is told when a downloaded update is ready to install.
//
// Platform reality: Windows (NSIS) and Linux (AppImage) apply updates unsigned.
// macOS requires the update to be code-signed + notarized, so on an unsigned
// build the check/download still run but the install step is a no-op — we simply
// never reach `update-downloaded` there.

let win: BrowserWindow | null = null
let downloading = false

function send(status: UpdateStatus): void {
  win?.webContents.send('update:status', status)
}

export function initAutoUpdate(window: BrowserWindow): void {
  win = window

  // We surface our own prompt, so don't let electron-updater auto-download or
  // auto-install behind the user's back.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => {
    downloading = false
    send({ state: 'ready', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    downloading = false
    send({ state: 'error', message: err?.message ?? String(err) })
  })

  // Check shortly after launch (dev builds have no update feed, so skip).
  if (!autoUpdater.isUpdaterActive()) return
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 3000)
}

/** Manually re-check (e.g. from a menu or the update banner's retry). */
export function checkForUpdates(): void {
  if (!autoUpdater.isUpdaterActive()) return
  autoUpdater.checkForUpdates().catch((e) => send({ state: 'error', message: e?.message ?? String(e) }))
}

/** Begin downloading an available update; progress arrives via `update:status`. */
export function downloadUpdate(): void {
  if (downloading) return
  downloading = true
  autoUpdater.downloadUpdate().catch((e) => {
    downloading = false
    send({ state: 'error', message: e?.message ?? String(e) })
  })
}

/** Quit and install a downloaded update. */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
