import { useEffect, useRef, useState } from 'react'

interface Props {
  visible: boolean
  onHide: () => void
  repoName?: string
}

type Entry =
  | { kind: 'cmd'; prompt: string; text: string }
  | { kind: 'out'; text: string }
  | { kind: 'note'; text: string }

const stripAnsi = (s: string): string =>
  // eslint-disable-next-line no-control-regex
  s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')

const baseName = (p: string): string => {
  const parts = p.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || '/'
}

export default function TerminalModal({ visible, onHide, repoName }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [cwd, setCwd] = useState('')

  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Wire up the main-process shell session.
  useEffect(() => {
    const offData = window.termApi.onData((chunk) => {
      if (chunk) setEntries((e) => [...e, { kind: 'out', text: stripAnsi(chunk) }])
    })
    const offExit = window.termApi.onExit(({ code, cwd: newCwd }) => {
      setCwd(newCwd)
      setRunning(false)
      if (code !== 0) setEntries((e) => [...e, { kind: 'note', text: `exit ${code}` }])
    })
    window.termApi.cwd().then(setCwd)
    return () => {
      offData()
      offExit()
    }
  }, [])

  // Keep scrolled to the bottom, and focus the input when shown.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [entries, visible])

  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 0)
  }, [visible])

  const prompt = `${cwd ? baseName(cwd) : '~'} ❯`

  function submit() {
    const cmd = input
    setEntries((e) => [...e, { kind: 'cmd', prompt, text: cmd }])
    setInput('')
    setHistoryIndex(null)
    if (cmd.trim()) {
      setHistory((h) => [...h, cmd])
      setRunning(true)
      window.termApi.run(cmd)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault()
      if (running) {
        window.termApi.interrupt()
        setEntries((en) => [...en, { kind: 'note', text: '^C' }])
      } else {
        onHide()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onHide()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!running) submit()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const idx = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(idx)
      setInput(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === null) return
      const idx = historyIndex + 1
      if (idx >= history.length) {
        setHistoryIndex(null)
        setInput('')
      } else {
        setHistoryIndex(idx)
        setInput(history[idx])
      }
    }
  }

  return (
    <div
      className="term-overlay"
      style={{ display: visible ? 'flex' : 'none' }}
      onMouseDown={(e) => e.target === e.currentTarget && onHide()}
    >
      <div className="term-window" onMouseDown={(e) => e.stopPropagation()}>
        <div className="term-header">
          <span className="term-title">Terminal{repoName ? ` — ${repoName}` : ''}</span>
          <button className="term-close" onClick={onHide} title="Close (⌃C or ⌘`)">
            ✕
          </button>
        </div>
        <div className="term-body" ref={bodyRef} onClick={() => inputRef.current?.focus()}>
          {entries.map((en, i) => {
            if (en.kind === 'cmd') {
              return (
                <div key={i} className="term-line">
                  <span className="term-prompt">{en.prompt}</span> {en.text}
                </div>
              )
            }
            if (en.kind === 'note') {
              return (
                <div key={i} className="term-note">
                  {en.text}
                </div>
              )
            }
            return (
              <pre key={i} className="term-out">
                {en.text}
              </pre>
            )
          })}
          <div className="term-input-line">
            <span className="term-prompt">{prompt}</span>
            <input
              ref={inputRef}
              className="term-input"
              value={input}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={running ? 'running… (⌃C to interrupt)' : ''}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
