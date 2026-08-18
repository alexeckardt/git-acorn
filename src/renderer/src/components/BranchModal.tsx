import { ReactNode, useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

// Conventional branch prefixes, each with a Lucide outlined icon. The icon
// visually stands in for the prefix in the input and in the option list.
interface Prefix {
  key: string // e.g. "feat/", or "" for none
  label: string
  icon: string
}

const PREFIXES: Prefix[] = [
  { key: '', label: 'No prefix', icon: 'git-branch' },
  { key: 'feat/', label: 'Feature', icon: 'sparkles' },
  { key: 'fix/', label: 'Fix', icon: 'bug' },
  { key: 'chore/', label: 'Chore', icon: 'wrench' },
  { key: 'docs/', label: 'Docs', icon: 'book' },
  { key: 'refactor/', label: 'Refactor', icon: 'recycle' },
  { key: 'test/', label: 'Test', icon: 'flask' },
  { key: 'hotfix/', label: 'Hotfix', icon: 'flame' }
]
const isPrefix = (prefixString: string) => (PREFIXES.some(obj => obj.key == prefixString));

const ICON_PATHS: Record<string, ReactNode> = {
  'git-branch': (
    <>
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  sparkles: (
    <>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </>
  ),
  bug: (
    <>
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  book: (
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  ),
  recycle: (
    <>
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
      <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
      <path d="m14 16-3 3 3 3" />
      <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
      <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
      <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
    </>
  ),
  flask: (
    <>
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
      <path d="M6.453 15h11.094" />
      <path d="M8.5 2h7" />
    </>
  ),
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  )
}

function BranchIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[icon] ?? ICON_PATHS['git-branch']}
    </svg>
  )
}

/** Split a full branch name into a known prefix + the remainder. */
function splitPrefix(name: string): { prefix: Prefix; rest: string } {
  const match = PREFIXES.find((p) => p.key && name.toLowerCase().startsWith(p.key))
  if (match) return { prefix: match, rest: name.slice(match.key.length) }
  return { prefix: PREFIXES[0], rest: name }
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
    setPrefix('')
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
      act({ type: exactExists ? 'switch' : 'create', name: fullName })
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
            <BranchIcon icon={activePrefix.icon} />
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
                  <BranchIcon icon={p.icon} />
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
                <BranchIcon icon={op.icon} />
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
