import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isMac } from './lib/commands'
import './styles.css'

// Tag the root with the platform so CSS can target it — chiefly to restyle the
// chunky native scrollbars on Windows/Linux while leaving macOS its overlay ones.
document.documentElement.classList.add(
  isMac ? 'platform-mac' : /win/i.test(navigator.userAgent) ? 'platform-win' : 'platform-linux'
)

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
