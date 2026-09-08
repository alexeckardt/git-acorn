import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../shared/types'

// A small floating banner that announces an available update, shows download
// progress, then prompts a restart to apply it. Driven entirely by the main
// process's update:status events — see src/main/updater.ts.
export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'none' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return window.updateApi.onStatus((s) => {
      setStatus(s)
      // A newly available or freshly downloaded update re-opens the prompt even
      // if an earlier notice was dismissed.
      if (s.state === 'available' || s.state === 'ready') setDismissed(false)
    })
  }, [])

  const visible =
    !dismissed &&
    (status.state === 'available' || status.state === 'downloading' || status.state === 'ready')
  if (!visible) return null

  return (
    <div className="update-banner">
      <span className="update-acorn" aria-hidden="true">
        🌱
      </span>
      <div className="update-body">
        {status.state === 'available' && (
          <>
            <div className="update-title">Version {status.version} is available</div>
            <div className="update-actions">
              <button className="update-btn primary" onClick={() => window.updateApi.download()}>
                Download
              </button>
              <button className="update-btn" onClick={() => setDismissed(true)}>
                Later
              </button>
            </div>
          </>
        )}

        {status.state === 'downloading' && (
          <>
            <div className="update-title">Downloading update… {status.percent}%</div>
            <div className="update-progress">
              <div className="update-progress-fill" style={{ width: `${status.percent}%` }} />
            </div>
          </>
        )}

        {status.state === 'ready' && (
          <>
            <div className="update-title">Version {status.version} is ready to install</div>
            <div className="update-actions">
              <button className="update-btn primary" onClick={() => window.updateApi.install()}>
                Restart &amp; update
              </button>
              <button className="update-btn" onClick={() => setDismissed(true)}>
                Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
