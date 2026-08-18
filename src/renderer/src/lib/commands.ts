// A tiny command registry shared by keyboard shortcuts and native-menu items.
//
// Accelerators here must stay in sync with the menu in src/main/index.ts.
// The renderer owns key handling so shortcuts can be platform-aware (Cmd on
// macOS, Ctrl elsewhere) and suppressed while a text field is focused.

export interface Accel {
  /** The platform primary modifier: Cmd on macOS, Ctrl elsewhere. */
  mod?: boolean
  shift?: boolean
  alt?: boolean
  key: string
}

export interface CommandDef {
  id: string
  title: string
  accel?: Accel
  /** If true, the shortcut also fires while an input/textarea is focused. */
  allowInInput?: boolean
}

export const isMac =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

const defs = new Map<string, CommandDef>()
const handlers = new Map<string, () => void>()

export function defineCommands(list: CommandDef[]): void {
  for (const c of list) defs.set(c.id, c)
}

/** Provide the behaviour for a command. Returns an unregister function. */
export function registerCommand(id: string, handler: () => void): () => void {
  handlers.set(id, handler)
  return () => {
    if (handlers.get(id) === handler) handlers.delete(id)
  }
}

export function runCommand(id: string): boolean {
  const h = handlers.get(id)
  if (h) {
    h()
    return true
  }
  return false
}

export function commandList(): CommandDef[] {
  return [...defs.values()]
}

export function matchAccel(e: KeyboardEvent, a: Accel): boolean {
  const primary = isMac ? e.metaKey : e.ctrlKey
  const other = isMac ? e.ctrlKey : e.metaKey
  if (!!a.mod !== primary) return false
  if (other) return false // avoid accidental Ctrl+Cmd combos
  if (!!a.shift !== e.shiftKey) return false
  if (!!a.alt !== e.altKey) return false
  return e.key.toLowerCase() === a.key.toLowerCase()
}

export function isTextTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null
  if (!n) return false
  return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable === true
}

// The app's commands. Handlers are registered by the components that own them.
defineCommands([
  { id: 'open-repo', title: 'Open Repository…', accel: { mod: true, key: 'o' } },
  { id: 'refresh', title: 'Refresh', accel: { mod: true, key: 'r' } },
  { id: 'new-branch', title: 'New Branch…', accel: { mod: true, key: 'b' } },
  { id: 'toggle-terminal', title: 'Terminal', accel: { mod: true, key: '`' }, allowInInput: true },
  {
    id: 'describe-changes',
    title: 'Describe Changes…',
    accel: { mod: true, key: '.' },
    allowInInput: true
  },
  // Commit's Cmd/Ctrl+Enter is handled locally within the commit box; this entry
  // exists so the menu item can invoke it (the accelerator is display-only there).
  { id: 'commit', title: 'Commit' }
])

/**
 * Install the global keyboard listener. Returns a cleanup function.
 * Suppresses shortcuts while a text field is focused unless allowInInput.
 */
export function installShortcuts(): () => void {
  function onKey(e: KeyboardEvent): void {
    const inText = isTextTarget(document.activeElement)
    for (const c of commandList()) {
      if (!c.accel || !matchAccel(e, c.accel)) continue
      if (inText && !c.allowInInput) return // let the input handle the key
      e.preventDefault()
      runCommand(c.id)
      return
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
