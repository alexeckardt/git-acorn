import { useEffect, useState } from 'react'

// Custom min/maximize/close buttons for the frameless title bar on Windows and
// Linux (macOS uses its native inset traffic lights instead). The buttons drive
// the real window through the windowApi bridge.
export default function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.windowApi.isMaximized().then(setMaximized)
    return window.windowApi.onMaximizeChange(setMaximized)
  }, [])

  return (
    <div className="window-controls">
      <button
        className="win-ctrl"
        aria-label="Minimize"
        title="Minimize"
        onClick={() => window.windowApi.minimize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        className="win-ctrl"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        title={maximized ? 'Restore' : 'Maximize'}
        onClick={() => window.windowApi.maximizeToggle()}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2.5 2.5V0.5h7v7h-2M0.5 2.5h7v7h-7z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        )}
      </button>
      <button
        className="win-ctrl close"
        aria-label="Close"
        title="Close"
        onClick={() => window.windowApi.close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}
