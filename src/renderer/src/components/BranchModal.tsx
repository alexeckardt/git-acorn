import { useEffect, useRef, useState } from 'react'
import { PREFIXES, isPrefix, splitPrefix } from '../lib/branchDisplay'
import { getPrefs } from '../lib/prefs'
import Icon from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

type Option = { type: 'switch' | 'create'; name: string }

export default function BranchModal({ open, onClose, onDone }: Props) {
  const [all, setAll] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [prefix, setPrefix] = useState('')
  const [rest, setRest] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prefixMenu, setPrefixMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPrefix(getPrefs().defaultBranchPrefix)
    setRest('')
    setError(null)
    setHighlight(-1)
    setPrefixMenu(false)
    window.gitApi.branches().then((res) => {
      if (res.ok && res.data) {
        setAll(res.data.all)
        setCurrent(res.data.current)
      }
    })
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  if (!open) return null

  const createBranchName = (prefix:string, rest:string): string => {
    return (prefix + rest).trim().toLowerCase().replaceAll(" ", "-");
  }
  const fullName = createBranchName(prefix, rest);



  const search = rest.trim().toLowerCase()
  // Search ignores the prefix: match the typed remainder against the full name.
  const filtered = all.filter((b) => b !== current && b.toLowerCase().includes(search))
  const exactExists = all.includes(fullName)
  const showCreate = fullName !== '' && !exactExists
  const options: Option[] = [
    ...filtered.map((b) => ({ type: 'switch' as const, name: b })),
    ...(showCreate ? [{ type: 'create' as const, name: fullName }] : [])
  ]

  const activePrefix = PREFIXES.find((p) => p.key === prefix) ?? PREFIXES[0]

  async function act(opt: Option) {
    if (busy) return
    setBusy(true)
    setError(null)
    const res =
      opt.type === 'create'
        ? await window.gitApi.createBranch(opt.name)
        : await window.gitApi.switchBranch(opt.name)
    setBusy(false)
    if (res.ok) {
      onDone()
      onClose()
    } else {
      setError(res.error ?? 'Branch operation failed')
    }
  }

  function submit() {

    // Is Prefex?
    if (isPrefix(fullName)) {
      setError('Name Required.')
      return;
    }

    if (highlight >= 0 && options[highlight]) {
      act(options[highlight])
    } else if (fullName) {
      // A default prefix shouldn't hijack switching: if the typed name matches
      // an existing branch (prefixed or not), switch to it instead of creating.
      const existing = exactExists ? fullName : all.find((b) => b === rest.trim())
      act(existing ? { type: 'switch', name: existing } : { type: 'create', name: fullName })
    }
  }

  function onChange(v: string) {
    // Typing a known prefix (e.g. "feat/") absorbs it into the icon.
    const p = PREFIXES.find((pf) => pf.key && v.toLowerCase().startsWith(pf.key))
    if (p) {
      setPrefix(p.key)
      setRest(v.slice(p.key.length))
    } else {
      setRest(v)
    }
    setHighlight(-1)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(options.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(-1, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Backspace' && rest === '' && prefix !== '') {
      // Backspace with an empty field peels off the prefix chip.
      e.preventDefault()
      setPrefix('')
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="branch-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="small-modal-title">Switch or create branch</div>

        <div className="branch-input-row">
          <button
            className="branch-prefix-btn"
            title={`Prefix: ${activePrefix.label}. Click to change.`}
            onClick={() => setPrefixMenu((m) => !m)}
          >
            <Icon name={activePrefix.icon} />
          </button>
          <input
            ref={inputRef}
            className="branch-input"
            value={rest}
            placeholder="branch name — type to search or create"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onFocus={() => setPrefixMenu(false)}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {prefixMenu && (
            <div className="prefix-menu">
              {PREFIXES.map((p) => (
                <button
                  key={p.key || 'none'}
                  className={`prefix-item${p.key === prefix ? ' active' : ''}`}
                  onClick={() => {
                    setPrefix(p.key)
                    setPrefixMenu(false)
                    inputRef.current?.focus()
                  }}
                >
                  <Icon name={p.icon} />
                  <span className="prefix-label">{p.label}</span>
                  <code className="prefix-key">{p.key || '—'}</code>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="branch-options">
          {options.length === 0 && (
            <div className="empty-hint">Type a name to create a branch</div>
          )}
          {options.map((o, i) => {
            const { prefix: op, rest: orest } = splitPrefix(o.name)
            return (
              <button
                key={`${o.type}:${o.name}`}
                className={`branch-option${i === highlight ? ' active' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => act(o)}
                title={o.name}
              >
                <Icon name={op.icon} />
                <span className="branch-option-name">{orest}</span>
                {o.type === 'create' && <span className="branch-badge create">create</span>}
              </button>
            )
          })}
        </div>

        {error && <div className="small-modal-error">{error}</div>}
        <div className="branch-hint">
          {fullName
            ? exactExists
              ? `↵ Switch to ${fullName}`
              : `↵ Create ${fullName}`
            : `On ${current || '(detached)'}`}
          {busy && ' …'}
        </div>
      </div>
    </div>
  )
}
